import { OrderSchema } from '../../../../shared/schemas/order.schema';

export interface ParsedOrder {
  external_order_id: string;
  customer_name: string;
  phone: string;
  pin_code: string;
  address: string;
  order_date: string;
  page_number: number;
  extraction_status: 'VALID' | 'WARNING' | 'INVALID';
  extraction_error: string | null;
}

export const amazonParser = {
  async canParse(text: string): Promise<boolean> {
    const lowerText = text.toLowerCase();
    return lowerText.includes('amazon') || lowerText.includes('invoice') || lowerText.includes('tax invoice');
  },

  async parsePage(text: string, pageNumber: number): Promise<ParsedOrder> {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    let external_order_id = '';
    let phone = '';
    let pin_code = '';
    let customer_name = '';
    let addressLines: string[] = [];
    let order_date = '';

    // 1. Extract Order ID
    const orderIdRegex = /\b\d{3}-\d{7}-\d{7}\b/;
    const orderIdMatch = text.match(orderIdRegex);
    if (orderIdMatch) {
      external_order_id = orderIdMatch[0];
    } else {
      // Fallback: look for lines containing Order ID and get the number
      for (const line of lines) {
        if (line.toLowerCase().includes('order id') || line.toLowerCase().includes('order no')) {
          const match = line.match(/\d{3}-\d{7}-\d{7}/);
          if (match) {
            external_order_id = match[0];
            break;
          }
        }
      }
    }

    // 2. Extract Phone Number
    const phoneRegex = /(?:phone|mobile|mob|ph|tel)[:\s]*(\d{10})\b/i;
    const phoneMatch = text.match(phoneRegex);
    if (phoneMatch) {
      phone = phoneMatch[1];
    } else {
      // Fallback: search for any standalone 10-digit number
      const standalonePhoneMatches = text.match(/\b\d{10}\b/g);
      if (standalonePhoneMatches) {
        // filter out any numbers that could be dates or invoice numbers if possible
        phone = standalonePhoneMatches[0];
      }
    }

    // 3. Extract Order Date
    // Match common formats like: Tue, May 26, 2026, 07.07.2026, 07-07-2026, 07/07/2026, or "07 July 2026"
    const dateLabelRegex = /(?:order date|invoice date|date)[:\s]*(?:[a-zA-Z]{3,10},\s+)?([a-zA-Z]{3,10}\s+\d{1,2},\s+\d{4}|[0-9]{1,2}[./-][0-9]{1,2}[./-][0-9]{4}|[0-9]{1,2}\s+[A-Za-z]{3,10}\s+[0-9]{4})/i;
    const dateMatch = text.match(dateLabelRegex);
    if (dateMatch) {
      order_date = dateMatch[1];
    } else {
      // Fallback: search for any date pattern
      const genericDateRegex = /\b(?:[a-zA-Z]{3,10},\s+)?([a-zA-Z]{3,10}\s+\d{1,2},\s+\d{4}|[0-9]{1,2}[./-][0-9]{1,2}[./-][0-9]{4}|[0-9]{1,2}\s+[A-Za-z]{3,10}\s+[0-9]{4})\b/i;
      const genericDateMatch = text.match(genericDateRegex);
      if (genericDateMatch) {
        order_date = genericDateMatch[1] || genericDateMatch[0];
      }
    }

    // 4. Extract Shipping Address & Customer Name
    // We search for "Shipping Address" or "Ship To" or "Delivery Address"
    let shippingIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const lineLower = lines[i].toLowerCase();
      if (
        lineLower.includes('shipping address') ||
        lineLower.includes('ship to') ||
        lineLower.includes('delivery address') ||
        lineLower.includes('ship-to')
      ) {
        shippingIndex = i;
        break;
      }
    }

    if (shippingIndex !== -1) {
      // Usually, the first non-empty line after the shipping address header is the customer name
      let searchIdx = shippingIndex + 1;
      // Skip labels or lines like "Billing Address" if they are immediately adjacent
      while (searchIdx < lines.length && (lines[searchIdx].toLowerCase().includes('same as') || lines[searchIdx].length === 0)) {
        searchIdx++;
      }

      if (searchIdx < lines.length) {
        customer_name = lines[searchIdx];
        
        // Collect subsequent lines as the address until we see another common block header
        searchIdx++;
        const stopKeywords = [
          'billing address', 'sold by', 'invoice no', 'invoice number', 'gstin', 
          'tax invoice', 'original', 'duplicate', 'pan', 'order id', 'order details',
          'description', 'sl no', 'total'
        ];

        while (searchIdx < lines.length) {
          const currentLine = lines[searchIdx];
          const currentLineLower = currentLine.toLowerCase();
          
          if (stopKeywords.some(keyword => currentLineLower.includes(keyword)) || currentLine.includes('===') || currentLine.includes('---')) {
            break;
          }
          
          addressLines.push(currentLine);
          searchIdx++;
        }
      }
    }

    const address = addressLines.join(', ');

    // 5. Extract PIN code
    // Search the address block first, then the whole page text
    const pinRegex = /\b\d{6}\b/;
    const addressText = addressLines.join(' ');
    const addressPinMatch = addressText.match(pinRegex);
    
    if (addressPinMatch) {
      pin_code = addressPinMatch[0];
    } else {
      const pagePinMatches = text.match(/\b\d{6}\b/g);
      if (pagePinMatches) {
        // filter out phone numbers if any
        const filteredPins = pagePinMatches.filter(pin => pin !== phone.substring(0, 6) && pin !== phone.substring(4, 10));
        if (filteredPins.length > 0) {
          pin_code = filteredPins[0];
        }
      }
    }

    // Default formatting / cleaning
    if (!customer_name && lines.length > 0) {
      // Fallback customer name search
      customer_name = lines[0];
    }

    const orderData = {
      external_order_id,
      customer_name,
      phone,
      pin_code,
      address,
      order_date,
      page_number: pageNumber
    };

    // Validate using Zod
    const validationResult = OrderSchema.safeParse(orderData);
    let extraction_status: 'VALID' | 'WARNING' | 'INVALID' = 'VALID';
    let extraction_error: string | null = null;

    if (!validationResult.success) {
      extraction_status = 'INVALID';
      // Join errors
      extraction_error = validationResult.error.issues.map(issue => issue.message).join(', ');
      
      // Let's degrade to WARNING if we got the core order ID and address but phone or PIN is invalid,
      // so the user can easily see and correct it on screen.
      if (external_order_id) {
        extraction_status = 'WARNING';
      }
    }

    return {
      external_order_id,
      customer_name,
      phone,
      pin_code,
      address,
      order_date,
      page_number: pageNumber,
      extraction_status,
      extraction_error
    };
  }
};
