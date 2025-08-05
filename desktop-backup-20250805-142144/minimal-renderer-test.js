// Minimal renderer test to isolate crash
console.log('🔍 [MINIMAL TEST] Renderer process started');

// Test 1: Basic require
try {
  console.log('🔍 [MINIMAL TEST] Testing config require...');
  const config = require('./config.js');
  console.log('✅ [MINIMAL TEST] Config loaded successfully');
} catch (error) {
  console.error('❌ [MINIMAL TEST] Config require failed:', error);
}

// Test 2: WebSocket
try {
  console.log('🔍 [MINIMAL TEST] Testing WebSocket...');
  const ws = new WebSocket('ws://localhost:3005/ws');
  console.log('✅ [MINIMAL TEST] WebSocket created successfully');
} catch (error) {
  console.error('❌ [MINIMAL TEST] WebSocket failed:', error);
}

// Test 3: Audio context
try {
  console.log('🔍 [MINIMAL TEST] Testing AudioContext...');
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  console.log('✅ [MINIMAL TEST] AudioContext created successfully');
} catch (error) {
  console.error('❌ [MINIMAL TEST] AudioContext failed:', error);
}

console.log('✅ [MINIMAL TEST] All tests completed'); 