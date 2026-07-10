import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { ShipmentDetails } from '../../database/repositories/shipment.repository';

export const excelExporter = {
  async exportShipments(shipments: ShipmentDetails[], outputPath: string): Promise<void> {
    const data: any[][] = [
      [
        'Post ID',
        'Order ID',
        'PIN Code',
        'Post Office',
        'District',
        'State',
        'Phone Number',
        'Customer Name',
        'Order Date',
        'Weight (grams)',
        'Dispatch Date'
      ]
    ];

    for (const s of shipments) {
      const dispatchDate = s.created_at ? s.created_at.split('T')[0] : '';
      data.push([
        s.post_id,
        s.external_order_id,
        s.pin_code,
        s.post_office,
        s.district,
        s.state,
        s.phone,
        s.customer_name,
        s.order_date,
        s.weight_grams,
        dispatchDate
      ]);
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);

    // Set formatting: A (Post ID), B (Order ID), C (PIN Code), G (Phone Number) as text ('s')
    // and J (Weight) as number ('n')
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:K1');
    for (let r = 1; r <= range.e.r; r++) {
      // Post ID
      const cellPostId = ws[XLSX.utils.encode_cell({ r, c: 0 })];
      if (cellPostId) {
        cellPostId.t = 's';
        cellPostId.z = '@';
      }

      // Order ID
      const cellOrderId = ws[XLSX.utils.encode_cell({ r, c: 1 })];
      if (cellOrderId) {
        cellOrderId.t = 's';
        cellOrderId.z = '@';
      }

      // PIN Code
      const cellPin = ws[XLSX.utils.encode_cell({ r, c: 2 })];
      if (cellPin) {
        cellPin.t = 's';
        cellPin.z = '@';
      }

      // Phone Number
      const cellPhone = ws[XLSX.utils.encode_cell({ r, c: 6 })];
      if (cellPhone) {
        cellPhone.t = 's';
        cellPhone.z = '@';
      }

      // Weight
      const cellWeight = ws[XLSX.utils.encode_cell({ r, c: 9 })];
      if (cellWeight) {
        cellWeight.t = 'n';
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, 'Dispatches');
    
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    fs.writeFileSync(outputPath, excelBuffer);
  }
};
