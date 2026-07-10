import { create } from 'zustand';
import { AppSettings, DesktopAPI } from '../../preload/desktop-api.types';
import { ImportBatch } from '../../main/database/repositories/batch.repository';
import { Order } from '../../main/database/repositories/order.repository';
import { ShipmentDetails } from '../../main/database/repositories/shipment.repository';

// Safe access to window.desktop
const desktop = (window as any).desktop as DesktopAPI;

interface AppState {
  settings: AppSettings | null;
  activeBatch: ImportBatch | null;
  activeOrders: Order[];
  activeShipments: ShipmentDetails[];
  batches: ImportBatch[];
  loading: boolean;
  error: string | null;

  // Actions
  loadSettings: () => Promise<void>;
  updateSettings: (settings: AppSettings) => Promise<void>;
  loadBatches: () => Promise<void>;
  loadLatestBatch: () => Promise<void>;
  setActiveBatch: (batch: ImportBatch | null) => Promise<void>;
  loadBatchData: (batchId: number) => Promise<void>;
  importNewBatch: (batchData: {
    marketplace: string;
    sourceFilename: string;
    fileHash: string;
    pageCount: number;
    orders: Omit<Order, 'id' | 'created_at'>[];
  }) => Promise<number>;
  addShipment: (shipment: {
    batch_id: number;
    order_id: number;
    post_id: string;
    weight_grams: number;
    post_office: string;
    district: string;
    state: string;
  }) => Promise<void>;
  removeShipment: (shipmentId: number, batchId: number) => Promise<void>;
  archiveBatch: (batchId: number) => Promise<void>;
  deleteBatch: (batchId: number) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  settings: null,
  activeBatch: null,
  activeOrders: [],
  activeShipments: [],
  batches: [],
  loading: false,
  error: null,

  loadSettings: async () => {
    try {
      const settings = await desktop.getSettings();
      set({ settings });
    } catch (err: any) {
      set({ error: err.message || 'Failed to load settings' });
    }
  },

  updateSettings: async (settings: AppSettings) => {
    try {
      await desktop.saveSettings(settings);
      set({ settings });
    } catch (err: any) {
      set({ error: err.message || 'Failed to save settings' });
    }
  },

  loadBatches: async () => {
    try {
      const batches = await desktop.getBatches();
      set({ batches });
    } catch (err: any) {
      set({ error: err.message || 'Failed to load batches' });
    }
  },

  loadLatestBatch: async () => {
    try {
      const activeBatch = await desktop.getLatestBatch();
      set({ activeBatch });
      if (activeBatch) {
        await get().loadBatchData(activeBatch.id);
      } else {
        set({ activeOrders: [], activeShipments: [] });
      }
    } catch (err: any) {
      set({ error: err.message || 'Failed to load latest batch' });
    }
  },

  setActiveBatch: async (batch: ImportBatch | null) => {
    set({ activeBatch: batch });
    if (batch) {
      await get().loadBatchData(batch.id);
    } else {
      set({ activeOrders: [], activeShipments: [] });
    }
  },

  loadBatchData: async (batchId: number) => {
    set({ loading: true });
    try {
      const orders = await desktop.getBatchOrders(batchId);
      const shipments = await desktop.getBatchShipments(batchId);
      set({ activeOrders: orders, activeShipments: shipments });
    } catch (err: any) {
      set({ error: err.message || 'Failed to load batch data' });
    } finally {
      set({ loading: false });
    }
  },

  importNewBatch: async (batchData) => {
    set({ loading: true, error: null });
    try {
      const batchId = await desktop.importBatch(batchData);
      await get().loadBatches();
      const latestBatch = await desktop.getLatestBatch();
      set({ activeBatch: latestBatch });
      if (latestBatch) {
        await get().loadBatchData(latestBatch.id);
      }
      return batchId;
    } catch (err: any) {
      set({ error: err.message || 'Failed to import batch' });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  addShipment: async (shipment) => {
    set({ error: null });
    try {
      await desktop.createShipment(shipment);
      // Refresh active shipments
      await get().loadBatchData(shipment.batch_id);
    } catch (err: any) {
      set({ error: err.message || 'Failed to add shipment' });
      throw err;
    }
  },

  removeShipment: async (shipmentId, batchId) => {
    try {
      await desktop.deleteShipment(shipmentId);
      await get().loadBatchData(batchId);
    } catch (err: any) {
      set({ error: err.message || 'Failed to remove shipment' });
    }
  },

  archiveBatch: async (batchId) => {
    try {
      await desktop.updateBatchStatus(batchId, 'ARCHIVED');
      await get().loadBatches();
      if (get().activeBatch?.id === batchId) {
        await get().loadLatestBatch();
      }
    } catch (err: any) {
      set({ error: err.message || 'Failed to archive batch' });
    }
  },

  deleteBatch: async (batchId) => {
    try {
      await desktop.deleteBatch(batchId);
      await get().loadBatches();
      if (get().activeBatch?.id === batchId) {
        await get().loadLatestBatch();
      }
    } catch (err: any) {
      set({ error: err.message || 'Failed to delete batch' });
    }
  }
}));
