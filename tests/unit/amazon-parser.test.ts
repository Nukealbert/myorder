import { describe, it, expect } from 'vitest';
import { amazonParser } from '../../src/main/modules/pdf/parsers/amazon.parser';

describe('Amazon Invoice Parser Unit Tests', () => {
  it('should parse a valid Amazon invoice text successfully', async () => {
    const mockInvoiceText = `
      Tax Invoice
      Amazon.in
      Order ID: 402-6294517-3943550
      Order Date: 07 July 2026
      
      Shipping Address:
      Kundan Kumar
      123 Post Office Lane, Tanakpur
      Champawat, UTTARAKHAND
      PIN: 262122
      
      Phone: 8923951063
      
      Description: Book
      Sl No: 1
      Total: INR 500
    `;

    const result = await amazonParser.parsePage(mockInvoiceText, 1);

    expect(result.external_order_id).toBe('402-6294517-3943550');
    expect(result.customer_name).toBe('Kundan Kumar');
    expect(result.phone).toBe('8923951063');
    expect(result.pin_code).toBe('262122');
    expect(result.order_date).toBe('07 July 2026');
    expect(result.extraction_status).toBe('VALID');
    expect(result.extraction_error).toBeNull();
  });

  it('should parse Amazon weekday prepended dates successfully', async () => {
    const mockInvoiceText = `
      Tax Invoice
      Amazon.in
      Order ID: 402-6294517-3943550
      Order Date: Tue, May 26, 2026
      
      Shipping Address:
      Kundan Kumar
      123 Post Office Lane, Tanakpur
      Champawat, UTTARAKHAND
      PIN: 262122
      
      Phone: 8923951063
    `;

    const result = await amazonParser.parsePage(mockInvoiceText, 1);
    expect(result.order_date).toBe('May 26, 2026');
    expect(result.extraction_status).toBe('VALID');
  });

  it('should degrade to WARNING when phone number is missing/invalid', async () => {
    const mockInvoiceText = `
      Tax Invoice
      Amazon
      Order ID: 402-3993927-5441160
      Order Date: 07.07.2026
      
      Shipping Address:
      John Doe
      Noida Sector 62
      Uttar Pradesh
      PIN: 201301
      
      Phone: InvalidPhone
    `;

    const result = await amazonParser.parsePage(mockInvoiceText, 1);

    expect(result.external_order_id).toBe('402-3993927-5441160');
    expect(result.customer_name).toBe('John Doe');
    expect(result.pin_code).toBe('201301');
    expect(result.extraction_status).toBe('WARNING');
    expect(result.extraction_error).toContain('Phone number must be exactly 10 digits');
  });

  it('should mark status as INVALID when order ID cannot be parsed', async () => {
    const mockInvoiceText = `
      Tax Invoice
      Amazon
      Order date: 07.07.2026
      
      Shipping Address:
      Kundan Kumar
      Kanpur Cantt
      Uttar Pradesh
      PIN: 208019
      Phone: 9335630680
    `;

    const result = await amazonParser.parsePage(mockInvoiceText, 1);

    expect(result.extraction_status).toBe('INVALID');
    expect(result.extraction_error).toContain('Order ID must be in format 000-0000000-0000000');
  });
});
