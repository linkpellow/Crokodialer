const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

// Generate a test JWT token for production testing
const payload = {
  email: 'test@crokodial.com',
  userId: 'test-production-user'
};

const token = jwt.sign(payload, '7f41db3a78344878e86de1e7ed96e9d3d56f23a8449388ec1bffb70eaf6ce02e', { expiresIn: '1h' });

console.log('🔗 Testing Production WebSocket Server');
console.log('=====================================');
console.log('');

console.log('📋 Test Configuration:');
console.log(`   URL: wss://crokodial.com/ws`);
console.log(`   Token: ${token.substring(0, 50)}...`);
console.log('');

// Test WebSocket connection
function testWebSocketConnection() {
  return new Promise((resolve, reject) => {
    console.log('🔌 Attempting to connect to wss://crokodial.com/ws...');
    
    const ws = new WebSocket(`wss://crokodial.com/ws?token=${token}`);
    
    const timeout = setTimeout(() => {
      console.log('⏰ Connection timeout after 10 seconds');
      ws.close();
      reject(new Error('Connection timeout'));
    }, 10000);
    
    ws.on('open', () => {
      console.log('✅ WebSocket connection established!');
      clearTimeout(timeout);
      
      // Send a ping message
      const pingMessage = {
        type: 'ping',
        data: {}
      };
      
      console.log('📤 Sending ping message...');
      ws.send(JSON.stringify(pingMessage));
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('📨 Received message:', JSON.stringify(message, null, 2));
        
        if (message.event === 'connected') {
          console.log('✅ Authentication successful!');
        } else if (message.event === 'pong') {
          console.log('✅ Ping/pong test successful!');
          ws.close();
          resolve(true);
        }
      } catch (error) {
        console.log('📨 Received raw message:', data.toString());
      }
    });
    
    ws.on('close', (code, reason) => {
      console.log(`🔌 Connection closed. Code: ${code}, Reason: ${reason}`);
      clearTimeout(timeout);
      if (code === 1000) {
        resolve(true);
      } else {
        reject(new Error(`Connection closed with code ${code}`));
      }
    });
    
    ws.on('error', (error) => {
      console.log('❌ WebSocket error:', error.message);
      clearTimeout(timeout);
      reject(error);
    });
  });
}

// Test without authentication (should fail)
function testUnauthenticatedConnection() {
  return new Promise((resolve, reject) => {
    console.log('🔌 Testing unauthenticated connection (should fail)...');
    
    const ws = new WebSocket('wss://crokodial.com/ws');
    
    const timeout = setTimeout(() => {
      console.log('⏰ Connection timeout');
      ws.close();
      reject(new Error('Connection timeout'));
    }, 5000);
    
    ws.on('open', () => {
      console.log('❌ Unexpected: Unauthenticated connection succeeded');
      clearTimeout(timeout);
      ws.close();
      reject(new Error('Unauthenticated connection should have failed'));
    });
    
    ws.on('close', (code, reason) => {
      console.log(`✅ Expected: Connection closed. Code: ${code}, Reason: ${reason}`);
      clearTimeout(timeout);
      if (code === 1008) {
        resolve(true);
      } else {
        reject(new Error(`Unexpected close code: ${code}`));
      }
    });
    
    ws.on('error', (error) => {
      console.log('✅ Expected: WebSocket error:', error.message);
      clearTimeout(timeout);
      resolve(true);
    });
  });
}

// Run tests
async function runTests() {
  console.log('🧪 Starting WebSocket Production Tests');
  console.log('=====================================');
  console.log('');
  
  try {
    // Test 1: Authenticated connection
    console.log('📋 Test 1: Authenticated WebSocket Connection');
    console.log('---------------------------------------------');
    await testWebSocketConnection();
    console.log('✅ Test 1 PASSED');
    console.log('');
    
    // Test 2: Unauthenticated connection (should fail)
    console.log('📋 Test 2: Unauthenticated WebSocket Connection');
    console.log('-----------------------------------------------');
    await testUnauthenticatedConnection();
    console.log('✅ Test 2 PASSED');
    console.log('');
    
    console.log('🎉 All tests passed!');
    console.log('');
    console.log('📋 Summary:');
    console.log('   ✅ WebSocket server is running on wss://crokodial.com/ws');
    console.log('   ✅ Authentication is working correctly');
    console.log('   ✅ Ping/pong functionality is working');
    console.log('   ✅ Unauthenticated connections are properly rejected');
    console.log('');
    console.log('🚀 Production WebSocket server is ready!');
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
    console.log('');
    console.log('🔍 Troubleshooting:');
    console.log('   1. Check if the production server is running');
    console.log('   2. Verify SSL certificates are properly configured');
    console.log('   3. Check firewall settings');
    console.log('   4. Verify domain DNS is pointing to the server');
    process.exit(1);
  }
}

// Run the tests
runTests(); 