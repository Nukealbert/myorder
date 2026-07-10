import { getDb } from '../database';

export interface PinCodeRecord {
  pin_code: string;
  office_name: string;
  district: string;
  state: string;
  office_type?: string;
  delivery_status?: string;
}

export const pincodeRepository = {
  lookup(pinCode: string): PinCodeRecord | null {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM pin_codes WHERE pin_code = ?');
    return (stmt.get(pinCode) as PinCodeRecord) || null;
  },

  saveCorrection(record: PinCodeRecord): void {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO pin_codes (pin_code, office_name, district, state, office_type, delivery_status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      record.pin_code,
      record.office_name,
      record.district,
      record.state,
      record.office_type || 'SO',
      record.delivery_status || 'Delivery'
    );
  },

  search(query: string, limit: number, offset: number): { rows: PinCodeRecord[]; total: number } {
    const db = getDb();
    const countQuery = query
      ? 'SELECT COUNT(*) as count FROM pin_codes WHERE pin_code LIKE ? OR office_name LIKE ? OR district LIKE ? OR state LIKE ?'
      : 'SELECT COUNT(*) as count FROM pin_codes';
    const dataQuery = query
      ? 'SELECT * FROM pin_codes WHERE pin_code LIKE ? OR office_name LIKE ? OR district LIKE ? OR state LIKE ? ORDER BY pin_code ASC LIMIT ? OFFSET ?'
      : 'SELECT * FROM pin_codes ORDER BY pin_code ASC LIMIT ? OFFSET ?';

    const likeQuery = `%${query}%`;
    const totalStmt = db.prepare(countQuery);
    const dataStmt = db.prepare(dataQuery);

    const total = query
      ? (totalStmt.get(likeQuery, likeQuery, likeQuery, likeQuery) as { count: number }).count
      : (totalStmt.get() as { count: number }).count;

    const rows = query
      ? (dataStmt.all(likeQuery, likeQuery, likeQuery, likeQuery, limit, offset) as PinCodeRecord[])
      : (dataStmt.all(limit, offset) as PinCodeRecord[]);

    return { rows, total };
  }
};
