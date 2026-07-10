import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import started from 'electron-squirrel-startup';

// Import database and IPC handlers
import { initDatabase } from './database/database';
import { registerSettingsHandlers } from './ipc/settings.ipc';
import { registerPdfHandlers } from './ipc/pdf.ipc';
import { registerOrderHandlers } from './ipc/order.ipc';
import { registerShipmentHandlers } from './ipc/shipment.ipc';
import { registerExportHandlers } from './ipc/export.ipc';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

function createWindow(): void {
  // Create the browser window with security settings and dashboard proportions
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 720,
    title: 'Amazon Order Dispatch Register',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Load the application
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }
}

// Boot up sequence when Electron is ready
app.whenReady().then(() => {
  // 1. Initialize local SQLite Database & run migrations
  console.log('Initializing database...');
  initDatabase();

  // 2. Register all IPC communication channels
  console.log('Registering IPC handlers...');
  registerSettingsHandlers();
  registerPdfHandlers();
  registerOrderHandlers();
  registerShipmentHandlers();
  registerExportHandlers();

  // 3. Create the Main Window
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
