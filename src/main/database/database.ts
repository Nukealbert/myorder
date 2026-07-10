import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import seedPinCodes from './seed/pincodes.json';

let db: Database.Database | null = null;

export function getDatabasePath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'app.db');
}

export function getBackupsDirectory(): string {
  const userDataPath = app.getPath('userData');
  const backupsPath = path.join(userDataPath, 'backups');
  if (!fs.existsSync(backupsPath)) {
    fs.mkdirSync(backupsPath, { recursive: true });
  }
  return backupsPath;
}

export function getLogsDirectory(): string {
  const userDataPath = app.getPath('userData');
  const logsPath = path.join(userDataPath, 'logs');
  if (!fs.existsSync(logsPath)) {
    fs.mkdirSync(logsPath, { recursive: true });
  }
  return logsPath;
}

function runBackups() {
  try {
    const dbPath = getDatabasePath();
    if (!fs.existsSync(dbPath)) {
      return;
    }

    const backupsDir = getBackupsDirectory();
    const today = new Date().toISOString().split('T')[0];
    const backupFileName = `app-${today}.db`;
    const backupFilePath = path.join(backupsDir, backupFileName);

    // If backup for today already exists, don't recreate it
    if (!fs.existsSync(backupFilePath)) {
      fs.copyFileSync(dbPath, backupFilePath);
      console.log(`Database backup created: ${backupFilePath}`);
    }

    // Purge backups older than 7 days
    const backupFiles = fs.readdirSync(backupsDir)
      .filter(file => file.startsWith('app-') && file.endsWith('.db'))
      .map(file => ({
        name: file,
        path: path.join(backupsDir, file),
        birthtime: fs.statSync(path.join(backupsDir, file)).birthtimeMs
      }))
      .sort((a, b) => b.birthtime - a.birthtime);

    if (backupFiles.length > 7) {
      const filesToDelete = backupFiles.slice(7);
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
        console.log(`Deleted old backup file: ${file.name}`);
      }
    }
  } catch (error) {
    console.error('Failed to create database backup:', error);
  }
}

export function initDatabase(): Database.Database {
  if (db) return db;

  const dbPath = getDatabasePath();
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Run backups before opening the database (or immediately after, but opening works too)
  runBackups();

  db = new Database(dbPath, { verbose: console.log });
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Run Migrations
  migrate(db);

  return db;
}

export function getDb(): Database.Database {
  if (!db) {
    return initDatabase();
  }
  return db;
}

function migrate(database: Database.Database) {
  // Create tables
  database.exec(`
    CREATE TABLE IF NOT EXISTS import_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      marketplace TEXT NOT NULL,
      source_filename TEXT NOT NULL,
      file_hash TEXT NOT NULL,
      page_count INTEGER NOT NULL,
      valid_order_count INTEGER NOT NULL,
      invalid_order_count INTEGER NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      marketplace TEXT NOT NULL,
      external_order_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      pin_code TEXT NOT NULL,
      address TEXT NOT NULL,
      order_date TEXT NOT NULL,
      page_number INTEGER NOT NULL,
      extraction_status TEXT NOT NULL,
      extraction_error TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES import_batches(id) ON DELETE CASCADE,
      UNIQUE(marketplace, external_order_id)
    );

    CREATE TABLE IF NOT EXISTS shipments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      order_id INTEGER NOT NULL,
      post_id TEXT NOT NULL,
      weight_grams INTEGER NOT NULL,
      post_office TEXT NOT NULL,
      district TEXT NOT NULL,
      state TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      exported_at TEXT,
      FOREIGN KEY (batch_id) REFERENCES import_batches(id) ON DELETE CASCADE,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      UNIQUE(order_id),
      UNIQUE(post_id),
      CHECK(weight_grams > 0)
    );

    CREATE TABLE IF NOT EXISTS pin_codes (
      pin_code TEXT PRIMARY KEY,
      office_name TEXT NOT NULL,
      district TEXT NOT NULL,
      state TEXT NOT NULL,
      office_type TEXT,
      delivery_status TEXT
    );

    CREATE TABLE IF NOT EXISTS export_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      row_count INTEGER NOT NULL,
      exported_at TEXT NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES import_batches(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_pin_code ON pin_codes(pin_code);
  `);

  // Seed default PIN codes if empty or partially populated
  const countRow = database.prepare('SELECT COUNT(*) as count FROM pin_codes').get() as { count: number };
  if (countRow.count < 19000) {
    console.log('Seeding initial PIN codes directory...');

    const insertStmt = database.prepare(`
      INSERT OR IGNORE INTO pin_codes (pin_code, office_name, district, state, office_type, delivery_status)
      VALUES (@pin_code, @office_name, @district, @state, @office_type, @delivery_status)
    `);

    const transaction = database.transaction((items) => {
      for (const item of items) {
        insertStmt.run(item);
      }
    });

    transaction(seedPinCodes);
  }
}
