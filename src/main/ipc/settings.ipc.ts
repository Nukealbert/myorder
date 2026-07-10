import { ipcMain, app, dialog, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { AppSettings } from '../../preload/desktop-api.types';

const getSettingsPath = () => {
  return path.join(app.getPath('userData'), 'settings.json');
};

const getDefaultSettings = (): AppSettings => {
  return {
    sellerHeader: 'GYAN POST (BOOKS)',
    defaultOutputFolder: app.getPath('documents'),
    barcodeWidth: 140,
    barcodeHeight: 35,
    defaultMarketplace: 'Amazon',
    weightUnit: 'grams',
    retainWeight: false,
    pinCodeDbVersion: '1.0.0 (Offline Seed)'
  };
};

export function loadSettings(): AppSettings {
  const filePath = getSettingsPath();
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      const saved = JSON.parse(data);
      return { ...getDefaultSettings(), ...saved };
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
  return getDefaultSettings();
}

export function saveSettingsInternal(settings: AppSettings): void {
  const filePath = getSettingsPath();
  try {
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
}

export function registerSettingsHandlers() {
  ipcMain.handle('settings:get', async () => {
    return loadSettings();
  });

  ipcMain.handle('settings:save', async (_, settings: AppSettings) => {
    saveSettingsInternal(settings);
  });

  ipcMain.handle('settings:backup', async () => {
    const { getDatabasePath, getBackupsDirectory } = require('../database/database');
    const dbPath = getDatabasePath();
    const backupsDir = getBackupsDirectory();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilePath = path.join(backupsDir, `app-manual-${timestamp}.db`);
    fs.copyFileSync(dbPath, backupFilePath);
    return backupFilePath;
  });

  ipcMain.handle('settings:restore', async (event) => {
    const webContents = event.sender;
    const window = BrowserWindow.fromWebContents(webContents);
    if (!window) return false;

    const { getDatabasePath, getBackupsDirectory, initDatabase } = require('../database/database');
    const backupsDir = getBackupsDirectory();

    const result = await dialog.showOpenDialog(window, {
      title: 'Select Backup Database to Restore',
      defaultPath: backupsDir,
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
      properties: ['openFile']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return false;
    }

    const backupPath = result.filePaths[0];
    const dbPath = getDatabasePath();

    try {
      const { getDb } = require('../database/database');
      const db = getDb();
      db.close();

      fs.copyFileSync(backupPath, dbPath);
      initDatabase();
      return true;
    } catch (err) {
      console.error('Restore database failed:', err);
      return false;
    }
  });
}
