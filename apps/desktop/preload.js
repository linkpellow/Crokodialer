// Preload script for Crokodialer Desktop
// This script runs before the renderer process and has access to Node.js APIs

// Import TelnyxRTC from the npm package
const { TelnyxRTC } = require('@telnyx/webrtc');

// Expose TelnyxRTC to the renderer process
// This makes it available as window.TelnyxRTC in the renderer
window.TelnyxRTC = TelnyxRTC;

console.log('✅ [PRELOAD] TelnyxRTC exposed to window:', typeof window.TelnyxRTC);

// Note: contextBridge is not used because contextIsolation is disabled in main.js
// If you want to use contextBridge, enable contextIsolation in the BrowserWindow webPreferences