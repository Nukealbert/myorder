import { getDb } from '../database';

export interface Shipment {
  id: number;
  batch_id: number;
  order_id: number;
  post_id: string;
  weight_grams: number;
  post_office: string;
  district: string;
  state: string;
  created_at: string;
  updated_at: string;
  exported_at: string | null;
}

export interface ShipmentDetails extends Shipment {
  external_order_id: string;
  customer_name: string;
  phone: string;
  pin_code: string;
  address: string;
  order_date: string;
}

export const shipmentRepository = {
  create(shipment: Omit<Shipment, 'id' | 'created_at' | 'updated_at' | 'exported_at'>): number {
    const db = getDb();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO shipments (
        batch_id, order_id, post_id, weight_grams,
        post_office, district, state, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      shipment.batch_id,
      shipment.order_id,
      shipment.post_id,
      shipment.weight_grams,
      shipment.post_office,
      shipment.district,
      shipment.state,
      now,
      now
    );
    return result.lastInsertRowid as number;
  },

  getByBatchId(batchId: number): ShipmentDetails[] {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT s.*, o.external_order_id, o.customer_name, o.phone, o.pin_code, o.address, o.order_date
      FROM shipments s
      JOIN orders o ON s.order_id = o.id
      WHERE s.batch_id = ?
      ORDER BY s.created_at DESC
    `);
    return stmt.all(batchId) as ShipmentDetails[];
  },

  getByPostId(postId: string): ShipmentDetails | null {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT s.*, o.external_order_id, o.customer_name, o.phone, o.pin_code, o.address, o.order_date
      FROM shipments s
      JOIN orders o ON s.order_id = o.id
      WHERE s.post_id = ?
    `);
    return (stmt.get(postId) as ShipmentDetails) || null;
  },

  getByOrderId(orderId: number): ShipmentDetails | null {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT s.*, o.external_order_id, o.customer_name, o.phone, o.pin_code, o.address, o.order_date
      FROM shipments s
      JOIN orders o ON s.order_id = o.id
      WHERE s.order_id = ?
    `);
    return (stmt.get(orderId) as ShipmentDetails) || null;
  },

  delete(id: number): void {
    const db = getDb();
    const stmt = db.prepare('DELETE FROM shipments WHERE id = ?');
    stmt.run(id);
  },

  markAsExported(batchId: number): void {
    const db = getDb();
    const now = new Date().toISOString();
    const stmt = db.prepare('UPDATE shipments SET exported_at = ? WHERE batch_id = ? AND exported_at IS NULL');
    stmt.run(now, batchId);
  }
};
