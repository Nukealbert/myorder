import { ipcMain, dialog, BrowserWindow, app } from 'electron';
import * as path from 'path';
import { shipmentRepository } from '../database/repositories/shipment.repository';
import { batchRepository } from '../database/repositories/batch.repository';
import { excelExporter } from '../modules/excel/excel-exporter';
import { getDb } from '../database/database';

export function registerExportHandlers() {
  // Show save dialog for Excel sheet
  ipcMain.handle('export:select-save-path', async (event, defaultName: string) => {
    const webContents = event.sender;
    const window = BrowserWindow.fromWebContents(webContents);
    if (!window) return null;

    const result = await dialog.showSaveDialog(window, {
      title: 'Export Dispatch to Excel',
      defaultPath: path.join(app.getPath('documents'), defaultName),
      filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    return result.filePath;
  });

  // Export dispatches of a batch to Excel and update database state
  ipcMain.handle('export:excel', async (_, batchId: number, outputPath: string) => {
    const db = getDb();
    
    // 1. Retrieve all shipments with order details for the batch
    const shipments = shipmentRepository.getByBatchId(batchId);
    if (shipments.length === 0) {
      throw new Error('No shipments found in this batch to export.');
    }

    // 2. Export to Excel
    await excelExporter.exportShipments(shipments, outputPath);

    // 3. Update database state in a single transaction
    const now = new Date().toISOString();
    
    const runTransaction = db.transaction(() => {
      // Mark shipments as exported
      shipmentRepository.markAsExported(batchId);

      // Update batch status to EXPORTED
      batchRepository.updateStatus(batchId, 'EXPORTED');

      // Save export history
      db.prepare(`
        INSERT INTO export_history (batch_id, file_path, row_count, exported_at)
        VALUES (?, ?, ?, ?)
      `).run(batchId, outputPath, shipments.length, now);
    });

    runTransaction();

    return {
      filePath: outputPath,
      rowCount: shipments.length
    };
  });

  // Utility handler to open files or folders in Windows Explorer
  ipcMain.handle('utils:open-file', async (_, filePath: string) => {
    const { shell } = require('electron');
    if (fs.existsSync(filePath)) {
      await shell.openPath(filePath);
    } else {
      throw new Error(`File does not exist: ${filePath}`);
    }
  });
}

import * as fs from 'fs';
