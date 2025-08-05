// Preload script for Crokodialer Desktop
// This script runs before the renderer process and has access to Node.js APIs

console.log('🚀 [PRELOAD] Starting preload script...');

try {
  // Import TelnyxRTC from the npm package
  const { TelnyxRTC } = require('@telnyx/webrtc');
  
  // Expose TelnyxRTC to the renderer process
  // This makes it available as window.TelnyxRTC in the renderer
  window.TelnyxRTC = TelnyxRTC;
  
  console.log('✅ [PRELOAD] TelnyxRTC exposed to window:', typeof window.TelnyxRTC);
  console.log('✅ [PRELOAD] TelnyxRTC constructor available:', typeof TelnyxRTC);
  
  // Test TelnyxRTC instantiation
  try {
    const testClient = new TelnyxRTC({
      login_token: 'test_token_for_validation',
      ringtoneFile: null
    });
    console.log('✅ [PRELOAD] TelnyxRTC instantiation test successful');
    testClient.disconnect(); // Clean up
  } catch (testError) {
    console.warn('⚠️ [PRELOAD] TelnyxRTC instantiation test failed (expected with test token):', testError.message);
  }
  
} catch (error) {
  console.error('❌ [PRELOAD] Failed to load TelnyxRTC:', error);
  console.error('❌ [PRELOAD] Error details:', error.stack);
  
  // Provide a fallback so the app doesn't crash
  window.TelnyxRTC = null;
  console.log('⚠️ [PRELOAD] TelnyxRTC set to null due to loading error');
}

// Add additional debugging
window.addEventListener('DOMContentLoaded', () => {
  console.log('📄 [PRELOAD] DOM Content Loaded');
  console.log('🔍 [PRELOAD] Final TelnyxRTC check:', typeof window.TelnyxRTC);
  
  if (window.TelnyxRTC) {
    console.log('✅ [PRELOAD] TelnyxRTC successfully available in renderer');
  } else {
    console.error('❌ [PRELOAD] TelnyxRTC NOT available in renderer');
  }
});

console.log('✅ [PRELOAD] Preload script completed');

// Note: contextBridge is not used because contextIsolation is disabled in main.js
// If you want to use contextBridge, enable contextIsolation in the BrowserWindow webPreferences