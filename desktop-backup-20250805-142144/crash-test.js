// Minimal crash test for Electron app
const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  console.log('🔍 [CRASH TEST] Creating window...');
  
  mainWindow = new BrowserWindow({
    width: 320,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      allowRunningInsecureContent: true,
      enableRemoteModule: true
    }
  });

  console.log('🔍 [CRASH TEST] Loading index.html...');
  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    console.log('✅ [CRASH TEST] Window ready to show');
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    console.log('🔍 [CRASH TEST] Window closed');
    mainWindow = null;
  });

  // Open DevTools for debugging
  mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  console.log('🔍 [CRASH TEST] App ready, creating window...');
  createWindow();
});

app.on('window-all-closed', () => {
  console.log('🔍 [CRASH TEST] All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  console.log('🔍 [CRASH TEST] App activated');
  if (mainWindow === null) {
    createWindow();
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ [CRASH TEST] Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ [CRASH TEST] Unhandled Rejection:', reason);
});

console.log('🔍 [CRASH TEST] Main process started'); 