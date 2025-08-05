const { app, BrowserWindow, ipcMain, protocol } = require('electron');
const path = require('path');
const WebSocket = require('ws');

let mainWindow;
let pendingCallUrl = null;
let wss = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 320,
    height: 700,
    resizable: false,
    movable: true, // ✅ FIX: Make window draggable
    title: 'Crokodialer', // ✅ FIX: Set window title
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false, // Temporarily disable for debugging
      allowRunningInsecureContent: true,
      enableRemoteModule: true,
      // ✅ FIX: Add audio permissions for sound playback
      permissions: ['microphone', 'speaker', 'audioCapture', 'audioOutput']
    },
    titleBarStyle: 'default', // ✅ FIX: Show native Mac title bar
    backgroundColor: '#1a1a1a',
    show: true, // Show window immediately
    alwaysOnTop: false // ✅ FIX: Allow window to be moved behind other windows
  });



  mainWindow.loadFile('index.html');

  // Show window when ready to prevent flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools for debugging
  mainWindow.webContents.openDevTools();

  // Handle pending call if app was launched via protocol
  if (pendingCallUrl) {
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow.webContents.send('incoming-call', { phoneNumber: pendingCallUrl });
      pendingCallUrl = null;
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle page load errors gracefully
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.log('Page failed to load:', errorDescription);
    // Don't show error screen, just retry
    setTimeout(() => {
      mainWindow.loadFile('index.html');
    }, 1000);
  });
}

// WebSocket server setup removed - Electron app will connect to backend WebSocket instead
function setupWebSocketServer() {
  console.log('✅ [Crokodialer Main] WebSocket server setup skipped - connecting to backend instead');
}

app.whenReady().then(() => {
  // Register protocol handlers
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient('tel', process.execPath, [path.resolve(process.argv[1])]);
      app.setAsDefaultProtocolClient('crokodial', process.execPath, [path.resolve(process.argv[1])]);
    }
  } else {
    app.setAsDefaultProtocolClient('tel');
    app.setAsDefaultProtocolClient('crokodial');
  }

  // Handle protocol calls
  app.on('open-url', (event, url) => {
    event.preventDefault();
    console.log('Protocol call received:', url);
    
    if (url.startsWith('tel:')) {
      const phoneNumber = url.replace('tel:', '');
      pendingCallUrl = phoneNumber;
      
      if (mainWindow) {
        mainWindow.webContents.send('incoming-call', { phoneNumber });
      }
    } else if (url.startsWith('crokodial:')) {
      const phoneNumber = url.replace('crokodial:', '');
      pendingCallUrl = phoneNumber;
      
      if (mainWindow) {
        mainWindow.webContents.send('incoming-call', { phoneNumber });
      }
    }
  });

  // Handle command line arguments for protocol calls
  if (process.platform === 'darwin') {
    const url = process.argv.find(arg => arg.startsWith('tel:') || arg.startsWith('crokodial:'));
    if (url) {
      const phoneNumber = url.replace(/^(tel|crokodial):/, '');
      pendingCallUrl = phoneNumber;
    }
  }

  createWindow();
  setupWebSocketServer();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (wss) {
    wss.close();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Handle uncaught exceptions to prevent crashes
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't crash the app, just log the error
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't crash the app, just log the error
});

// Handle API calls from renderer
ipcMain.handle('api-request', async (event, { method, url, data, headers }) => {
  try {
    const axios = require('axios');
    const response = await axios({ method, url, data, headers });
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}); 