import { getDb } from '../database';

export interface ImportBatch {
  id: number;
  marketplace: string;
  source_filename: string;
  file_hash: string;
  page_count: number;
  valid_order_count: number;
  invalid_order_count: number;
  status: string;
  created_at: string;
  completed_at: string | null;
}

export const batchRepository = {
  create(batch: Omit<ImportBatch, 'id' | 'created_at' | 'completed_at'>): number {
    const db = getDb();
    const createdAt = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO import_batches (
        marketplace, source_filename, file_hash, page_count,
        valid_order_count, invalid_order_count, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      batch.marketplace,
      batch.source_filename,
      batch.file_hash,
      batch.page_count,
      batch.valid_order_count,
      batch.invalid_order_count,
      batch.status,
      createdAt
    );
    return result.lastInsertRowid as number;
  },

  getById(id: number): ImportBatch | null {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM import_batches WHERE id = ?');
    return (stmt.get(id) as ImportBatch) || null;
  },

  getAll(): ImportBatch[] {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM import_batches ORDER BY created_at DESC');
    return stmt.all() as ImportBatch[];
  },

  getLatest(): ImportBatch | null {
    const db = getDb();
    const stmt = db.prepare("SELECT * FROM import_batches WHERE status != 'ARCHIVED' ORDER BY created_at DESC LIMIT 1");
    return (stmt.get() as ImportBatch) || null;
  },

  updateStatus(id: number, status: string): void {
    const db = getDb();
    const completedAt = status === 'EXPORTED' || status === 'ARCHIVED' ? new Date().toISOString() : null;
    if (completedAt) {
      const stmt = db.prepare('UPDATE import_batches SET status = ?, completed_at = ? WHERE id = ?');
      stmt.run(status, completedAt, id);
    } else {
      const stmt = db.prepare('UPDATE import_batches SET status = ? WHERE id = ?');
      stmt.run(status, id);
    }
  },

  delete(id: number): void {
    const db = getDb();
    const stmt = db.prepare('DELETE FROM import_batches WHERE id = ?');
    stmt.run(id);
  }
};
