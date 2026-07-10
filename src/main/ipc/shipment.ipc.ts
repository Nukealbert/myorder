import { ipcMain } from 'electron';
import { shipmentRepository } from '../database/repositories/shipment.repository';
import { orderRepository } from '../database/repositories/order.repository';
import { pincodeRepository } from '../database/repositories/pincode.repository';
import { getDb } from '../database/database';

export function registerShipmentHandlers() {
  // Find order in batch for scanning
  ipcMain.handle('shipment:find-order', async (_, batchId: number, externalOrderId: string) => {
    const db = getDb();
    
    // First find the order
    const order = orderRepository.getByExternalId('Amazon', externalOrderId);
    if (!order || order.batch_id !== batchId) {
      return null;
    }
    
    return order;
  });

  // Create shipment with complete business validation rules
  ipcMain.handle('shipment:create', async (_, shipmentData: {
    batch_id: number;
    order_id: number;
    post_id: string;
    weight_grams: number;
    post_office: string;
    district: string;
    state: string;
  }) => {
    const db = getDb();

    // 1. Validate weight
    if (!shipmentData.weight_grams || shipmentData.weight_grams <= 0) {
      throw new Error('Enter a weight greater than 0 grams.');
    }

    // 2. Validate Order ID existence
    const order = db.prepare('SELECT id, external_order_id, pin_code FROM orders WHERE id = ?').get(shipmentData.order_id) as { id: number; external_order_id: string; pin_code: string } | undefined;
    if (!order) {
      throw new Error(`Order ID was not found in the database.`);
    }

    // 3. Check duplicate Order ID (order already dispatched)
    const existingShipmentByOrder = shipmentRepository.getByOrderId(shipmentData.order_id);
    if (existingShipmentByOrder) {
      throw new Error(`This order was already assigned to Post ID ${existingShipmentByOrder.post_id}.`);
    }

    // 4. Check duplicate Post ID
    const existingShipmentByPost = shipmentRepository.getByPostId(shipmentData.post_id);
    if (existingShipmentByPost) {
      throw new Error(`Post ID ${shipmentData.post_id} is already assigned to Order ${existingShipmentByPost.external_order_id}.`);
    }

    // 5. Store shipment
    let shipmentId: number | null = null;
    const runTransaction = db.transaction(() => {
      shipmentId = shipmentRepository.create({
        batch_id: shipmentData.batch_id,
        order_id: shipmentData.order_id,
        post_id: shipmentData.post_id,
        weight_grams: shipmentData.weight_grams,
        post_office: shipmentData.post_office,
        district: shipmentData.district,
        state: shipmentData.state
      });

      // Update batch status to 'DISPATCHING'
      db.prepare("UPDATE import_batches SET status = 'DISPATCHING' WHERE id = ? AND status = 'READY'").run(shipmentData.batch_id);
    });

    runTransaction();
    return shipmentId;
  });

  // Delete shipment
  ipcMain.handle('shipment:delete', async (_, shipmentId: number) => {
    shipmentRepository.delete(shipmentId);
  });

  // PIN Code Lookup
  ipcMain.handle('pincode:lookup', async (_, pinCode: string) => {
    return pincodeRepository.lookup(pinCode);
  });

  // Save manual PIN Code Correction
  ipcMain.handle('pincode:save-correction', async (_, record: {
    pin_code: string;
    office_name: string;
    district: string;
    state: string;
  }) => {
    pincodeRepository.saveCorrection(record);
  });

  // Search PIN codes
  ipcMain.handle('pincode:search', async (_, query: string, limit: number, offset: number) => {
    return pincodeRepository.search(query, limit, offset);
  });
}
