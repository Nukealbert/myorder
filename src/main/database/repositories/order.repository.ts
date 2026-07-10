import { getDb } from '../database';

export interface Order {
  id: number;
  batch_id: number;
  marketplace: string;
  external_order_id: string;
  customer_name: string;
  phone: string;
  pin_code: string;
  address: string;
  order_date: string;
  page_number: number;
  extraction_status: 'VALID' | 'WARNING' | 'INVALID';
  extraction_error: string | null;
  created_at: string;
}

export const orderRepository = {
  createMany(orders: Omit<Order, 'id' | 'created_at'>[]): void {
    const db = getDb();
    const createdAt = new Date().toISOString();
    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO orders (
        batch_id, marketplace, external_order_id, customer_name,
        phone, pin_code, address, order_date, page_number,
        extraction_status, extraction_error, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((items) => {
      for (const item of items) {
        insertStmt.run(
          item.batch_id,
          item.marketplace,
          item.external_order_id,
          item.customer_name,
          item.phone,
          item.pin_code,
          item.address,
          item.order_date,
          item.page_number,
          item.extraction_status,
          item.extraction_error,
          createdAt
        );
      }
    });

    transaction(orders);
  },

  getByBatchId(batchId: number): Order[] {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM orders WHERE batch_id = ? ORDER BY page_number ASC');
    return stmt.all(batchId) as Order[];
  },

  getByExternalId(marketplace: string, externalOrderId: string): Order | null {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM orders WHERE marketplace = ? AND external_order_id = ?');
    return (stmt.get(marketplace, externalOrderId) as Order) || null;
  },

  updateOrder(order: Pick<Order, 'id' | 'customer_name' | 'phone' | 'pin_code' | 'address' | 'extraction_status' | 'extraction_error'>): void {
    const db = getDb();
    const stmt = db.prepare(`
      UPDATE orders
      SET customer_name = ?, phone = ?, pin_code = ?, address = ?,
          extraction_status = ?, extraction_error = ?
      WHERE id = ?
    `);
    stmt.run(
      order.customer_name,
      order.phone,
      order.pin_code,
      order.address,
      order.extraction_status,
      order.extraction_error,
      order.id
    );
  }
};
