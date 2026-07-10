import { ipcMain } from 'electron';
import { batchRepository } from '../database/repositories/batch.repository';
import { orderRepository } from '../database/repositories/order.repository';
import { getDb } from '../database/database';

export function registerOrderHandlers() {
  // Import Batch and its associated orders inside a transaction
  ipcMain.handle('batch:import', async (_, batchData: {
    marketplace: string;
    sourceFilename: string;
    fileHash: string;
    pageCount: number;
    orders: any[];
  }) => {
    const db = getDb();
    
    // 1. Check if the file hash already exists to prevent duplicate imports
    const existingBatch = db.prepare('SELECT id FROM import_batches WHERE file_hash = ?').get(batchData.fileHash) as { id: number } | undefined;
    if (existingBatch) {
      throw new Error(`Duplicate import: This file has already been imported in batch ID ${existingBatch.id}`);
    }

    // 2. Count valid/invalid orders
    const validCount = batchData.orders.filter(o => o.extraction_status === 'VALID').length;
    const invalidCount = batchData.orders.length - validCount;
    
    // Status is NEEDS_REVIEW if there are warnings or invalid records, otherwise READY
    const status = invalidCount > 0 ? 'NEEDS_REVIEW' : 'READY';

    // 3. Create the batch and insert orders inside a single transaction
    let batchId: number | null = null;
    
    const runImportTransaction = db.transaction(() => {
      // Create batch
      batchId = batchRepository.create({
        marketplace: batchData.marketplace,
        source_filename: batchData.sourceFilename,
        file_hash: batchData.fileHash,
        page_count: batchData.pageCount,
        valid_order_count: validCount,
        invalid_order_count: invalidCount,
        status: status
      });

      // Assign batch_id to each order and save
      const ordersWithBatch = batchData.orders.map(order => ({
        ...order,
        batch_id: batchId
      }));

      orderRepository.createMany(ordersWithBatch);
    });

    runImportTransaction();

    return batchId;
  });

  // Get all batches
  ipcMain.handle('batch:get-all', async () => {
    return batchRepository.getAll();
  });

  // Get latest batch
  ipcMain.handle('batch:get-latest', async () => {
    return batchRepository.getLatest();
  });

  // Get orders of a batch
  ipcMain.handle('batch:get-orders', async (_, batchId: number) => {
    return orderRepository.getByBatchId(batchId);
  });

  // Update batch status
  ipcMain.handle('batch:update-status', async (_, batchId: number, status: string) => {
    batchRepository.updateStatus(batchId, status);
  });

  // Delete batch
  ipcMain.handle('batch:delete', async (_, batchId: number) => {
    batchRepository.delete(batchId);
  });
}
