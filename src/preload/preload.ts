import { contextBridge, ipcRenderer } from 'electron';
import { DesktopAPI } from './desktop-api.types';

const api: DesktopAPI = {
  // Batch & Import
  selectPdf: () => ipcRenderer.invoke('batch:select-pdf'),
  parsePdf: (filePath) => ipcRenderer.invoke('batch:parse-pdf', filePath),
  importBatch: (batchData) => ipcRenderer.invoke('batch:import', batchData),
  getBatches: () => ipcRenderer.invoke('batch:get-all'),
  getLatestBatch: () => ipcRenderer.invoke('batch:get-latest'),
  getBatchOrders: (batchId) => ipcRenderer.invoke('batch:get-orders', batchId),
  getBatchShipments: (batchId) => ipcRenderer.invoke('batch:get-shipments', batchId),
  updateBatchStatus: (batchId, status) => ipcRenderer.invoke('batch:update-status', batchId, status),
  deleteBatch: (batchId) => ipcRenderer.invoke('batch:delete', batchId),

  // PDF Modification
  generateProcessedPdf: (srcPath, destPath, pagesData) =>
    ipcRenderer.invoke('pdf:generate', srcPath, destPath, pagesData),
  selectSavePath: (defaultName) => ipcRenderer.invoke('pdf:select-save-path', defaultName),

  // Dispatch & Shipments
  findOrderInBatch: (batchId, externalOrderId) =>
    ipcRenderer.invoke('shipment:find-order', batchId, externalOrderId),
  createShipment: (shipment) => ipcRenderer.invoke('shipment:create', shipment),
  deleteShipment: (shipmentId) => ipcRenderer.invoke('shipment:delete', shipmentId),

  // PIN Code
  lookupPinCode: (pinCode) => ipcRenderer.invoke('pincode:lookup', pinCode),
  savePinCodeCorrection: (record) => ipcRenderer.invoke('pincode:save-correction', record),
  searchPinCodes: (query, limit, offset) => ipcRenderer.invoke('pincode:search', query, limit, offset),

  // Export
  exportExcel: (batchId, outputPath) => ipcRenderer.invoke('export:excel', batchId, outputPath),
  selectExcelSavePath: (defaultName) => ipcRenderer.invoke('export:select-save-path', defaultName),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  backupDatabase: () => ipcRenderer.invoke('settings:backup'),
  restoreDatabase: () => ipcRenderer.invoke('settings:restore'),

  // Utilities
  openFile: (filePath) => ipcRenderer.invoke('utils:open-file', filePath)
};

contextBridge.exposeInMainWorld('desktop', api);
