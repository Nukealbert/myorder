import { ParsedOrder } from '../main/modules/pdf/parsers/amazon.parser';
import { ImportBatch } from '../main/database/repositories/batch.repository';
import { Order } from '../main/database/repositories/order.repository';
import { ShipmentDetails } from '../main/database/repositories/shipment.repository';
import { PinCodeRecord } from '../main/database/repositories/pincode.repository';

export interface AppSettings {
  sellerHeader: string;
  defaultOutputFolder: string;
  barcodeWidth: number;
  barcodeHeight: number;
  defaultMarketplace: string;
  weightUnit: string;
  retainWeight: boolean;
  pinCodeDbVersion: string;
}

export interface DesktopAPI {
  // Batch & Import
  selectPdf(): Promise<{ filePath: string; fileName: string } | null>;
  parsePdf(filePath: string): Promise<{ pages: ParsedOrder[]; pageCount: number }>;
  importBatch(batchData: {
    marketplace: string;
    sourceFilename: string;
    fileHash: string;
    pageCount: number;
    orders: Omit<Order, 'id' | 'created_at'>[];
  }): Promise<number>;
  getBatches(): Promise<ImportBatch[]>;
  getLatestBatch(): Promise<ImportBatch | null>;
  getBatchOrders(batchId: number): Promise<Order[]>;
  getBatchShipments(batchId: number): Promise<ShipmentDetails[]>;
  updateBatchStatus(batchId: number, status: string): Promise<void>;
  deleteBatch(batchId: number): Promise<void>;

  // PDF Modification
  generateProcessedPdf(
    srcPath: string,
    destPath: string,
    pagesData: { pageNumber: number; orderId: string; sellerHeader: string }[]
  ): Promise<void>;
  selectSavePath(defaultName: string): Promise<string | null>;

  // Dispatch & Shipments
  findOrderInBatch(batchId: number, externalOrderId: string): Promise<Order | null>;
  createShipment(shipment: {
    batch_id: number;
    order_id: number;
    post_id: string;
    weight_grams: number;
    post_office: string;
    district: string;
    state: string;
  }): Promise<number>;
  deleteShipment(shipmentId: number): Promise<void>;

  // PIN Code
  lookupPinCode(pinCode: string): Promise<PinCodeRecord | null>;
  savePinCodeCorrection(record: PinCodeRecord): Promise<void>;
  searchPinCodes(query: string, limit: number, offset: number): Promise<{ rows: PinCodeRecord[]; total: number }>;

  // Export
  exportExcel(batchId: number, outputPath: string): Promise<{ filePath: string; rowCount: number }>;
  selectExcelSavePath(defaultName: string): Promise<string | null>;

  // Settings
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<void>;
  backupDatabase(): Promise<string>;
  restoreDatabase(): Promise<boolean>;

  // Utilities
  openFile(filePath: string): Promise<void>;
}

declare global {
  interface Window {
    desktop: DesktopAPI;
  }
}
