import { ipcMain, dialog, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { pdfReader } from '../modules/pdf/pdf-reader';
import { amazonParser } from '../modules/pdf/parsers/amazon.parser';
import { pdfWriter } from '../modules/pdf/pdf-writer';

export function registerPdfHandlers() {
  // File selector for PDF
  ipcMain.handle('batch:select-pdf', async (event) => {
    const webContents = event.sender;
    const window = BrowserWindow.fromWebContents(webContents);
    if (!window) return null;

    const result = await dialog.showOpenDialog(window, {
      title: 'Import Amazon Invoice PDF',
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
      properties: ['openFile']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const filePath = result.filePaths[0];
    const fileName = path.basename(filePath);
    return { filePath, fileName };
  });

  // Extract text and parse page by page
  ipcMain.handle('batch:parse-pdf', async (_, filePath: string) => {
    const rawPages = await pdfReader.extractText(filePath);
    const parsedOrders = [];

    for (const rawPage of rawPages) {
      const order = await amazonParser.parsePage(rawPage.text, rawPage.pageNumber);
      parsedOrders.push(order);
    }

    return {
      pages: parsedOrders,
      pageCount: rawPages.length
    };
  });

  // Show save dialog for processed PDF
  ipcMain.handle('pdf:select-save-path', async (event, defaultName: string) => {
    const webContents = event.sender;
    const window = BrowserWindow.fromWebContents(webContents);
    if (!window) return null;

    const result = await dialog.showSaveDialog(window, {
      title: 'Save Processed PDF',
      defaultPath: path.join(app.getPath('documents'), defaultName),
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    return result.filePath;
  });

  // Draw headers and barcodes on invoice pages
  ipcMain.handle('pdf:generate', async (_, srcPath: string, destPath: string, pagesData: any[]) => {
    await pdfWriter.addHeadersAndBarcodes(srcPath, destPath, pagesData);
  });
}

import { app } from 'electron';
