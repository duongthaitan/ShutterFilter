import { app, BrowserWindow, Menu } from 'electron';
import path from 'path';
import fs from 'fs';
import { setupIpcHandlers } from './ipcHandlers';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  // Completely disable top native application menu (File, Edit, View, Window, Help)
  Menu.setApplicationMenu(null);

  // App custom camera icon path
  let iconPath = path.join(__dirname, '../../assets/icon.png');
  if (!fs.existsSync(iconPath)) {
    iconPath = path.join(__dirname, '../assets/icon.png');
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 900,
    minHeight: 650,
    title: 'ShutterFilter by Tandev.foto',
    icon: iconPath,
    autoHideMenuBar: true,
    backgroundColor: '#0a0a0c',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Explicitly remove menu bar
  mainWindow.removeMenu();

  setupIpcHandlers();

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
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
