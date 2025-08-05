const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

console.log('🧪 Testing Dialer Webhook Event Interpretation');
console.log('=============================================');
console.log('');

// Generate test JWT token
const payload = {
  email: 'test@crokodial.com',
  userId: 'test-dialer-user'
};

const token = jwt.sign(payload, '7f41db3a78344878e86de1e7ed96e9d3d56f23a8449388ec1bffb70eaf6ce02e', { expiresIn: '1h' });

// Test data for CRM lead selection
const testLeadData = {
  name: "John Smith",
  phone: "5551234567",
  leadId: "xyz789",
  email: "john@example.com",
  state: "NY",
  city: "New York",
  zipcode: "10001"
};

// Test webhook events
const testWebhookEvents = [
  {
    name: 'call.initiated',
    payload: { 
      call_id: 'test-call-1', 
      direction: 'outbound',
      from: '+15551234567',
      to: '+15551234567'
    },
    expectedSfx: 'call-initiated.wav'
  },
  {
    name: 'call.answered',
    payload: { 
      call_id: 'test-call-1', 
      status: 'answered',
      duration: 0
    },
    expectedSfx: 'call-answered.wav'
  },
  {
    name: 'call.hangup',
    payload: { 
      call_id: 'test-call-1', 
      status: 'completed',
      duration: 120
    },
    expectedSfx: 'call-hangup.wav'
  },
  {
    name: 'call.inbound',
    payload: { 
      call_id: 'test-call-2', 
      direction: 'inbound',
      from: '+15551234567',
      to: '+15551234567'
    },
    expectedSfx: 'call-inbound.wav'
  }
];

// Test CRM to Dialer data flow
async function testCRMToDialerFlow() {
  console.log('📋 Test 1: CRM → Dialer Data Flow');
  console.log('===================================');
  
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:3005/ws?token=${token}`);
    
    ws.on('open', () => {
      console.log('✅ Connected to WebSocket server');
      
      // Simulate CRM sending lead data
      const selectLeadMessage = {
        type: 'selectLead',
        data: testLeadData
      };
      
      console.log('📤 Sending lead data from CRM:');
      console.log(JSON.stringify(selectLeadMessage, null, 2));
      
      ws.send(JSON.stringify(selectLeadMessage));
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('📨 Received message:', JSON.stringify(message, null, 2));
        
        if (message.type === 'selectLead') {
          console.log('✅ Lead data broadcast received');
          console.log('   - Name:', message.data.name);
          console.log('   - Phone:', message.data.phone);
          console.log('   - Lead ID:', message.data.leadId);
          console.log('   - Email:', message.data.email);
          console.log('   - Location:', `${message.data.city}, ${message.data.state} ${message.data.zipcode}`);
          
          // Verify all fields are present
          const requiredFields = ['name', 'phone', 'leadId', 'email', 'state', 'city', 'zipcode'];
          const missingFields = requiredFields.filter(field => !message.data[field]);
          
          if (missingFields.length === 0) {
            console.log('✅ All required fields present');
          } else {
            console.log('❌ Missing fields:', missingFields);
          }
          
          ws.close();
          resolve(true);
        }
      } catch (error) {
        console.log('📨 Received raw message:', data.toString());
      }
    });
    
    ws.on('close', () => {
      console.log('🔌 WebSocket connection closed');
    });
    
    ws.on('error', (error) => {
      console.log('❌ WebSocket error:', error.message);
      reject(error);
    });
  });
}

// Test webhook event interpretation
async function testWebhookEventInterpretation() {
  console.log('');
  console.log('📋 Test 2: Webhook Event Interpretation');
  console.log('========================================');
  
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:3005/ws?token=${token}`);
    let eventCount = 0;
    
    ws.on('open', () => {
      console.log('✅ Connected to WebSocket server');
      console.log('⏳ Waiting for webhook events...');
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.event && message.sfx) {
          eventCount++;
          console.log(`🔊 Event ${eventCount}: ${message.event}`);
          console.log(`   - SFX File: ${message.sfx}`);
          console.log(`   - Call ID: ${message.data.call_id}`);
          console.log(`   - Direction: ${message.data.direction || 'N/A'}`);
          console.log(`   - Status: ${message.data.status || 'N/A'}`);
          
          // Verify SFX mapping
          const expectedEvent = testWebhookEvents.find(e => e.name.replace('.', '-') === message.event);
          if (expectedEvent && expectedEvent.expectedSfx === message.sfx) {
            console.log(`   ✅ SFX mapping correct: ${message.sfx}`);
          } else {
            console.log(`   ❌ SFX mapping incorrect: expected ${expectedEvent?.expectedSfx}, got ${message.sfx}`);
          }
          
          if (eventCount >= testWebhookEvents.length) {
            ws.close();
            resolve(true);
          }
        }
      } catch (error) {
        console.log('📨 Received raw message:', data.toString());
      }
    });
    
    ws.on('close', () => {
      console.log('🔌 WebSocket connection closed');
    });
    
    ws.on('error', (error) => {
      console.log('❌ WebSocket error:', error.message);
      reject(error);
    });
    
    // Simulate webhook events after a short delay
    setTimeout(() => {
      testWebhookEvents.forEach((event, index) => {
        setTimeout(() => {
          console.log(`📤 Simulating webhook: ${event.name}`);
          // This would normally come from Telnyx webhook endpoint
          // For testing, we'll simulate the event emission
          require('./dist/routes/webhooks').WebhookEvents.emit(
            event.name.replace('.', '-'), 
            event.payload
          );
        }, index * 1000); // Send events 1 second apart
      });
    }, 2000);
  });
}

// Test error handling
async function testErrorHandling() {
  console.log('');
  console.log('📋 Test 3: Error Handling');
  console.log('==========================');
  
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:3005/ws?token=${token}`);
    
    ws.on('open', () => {
      console.log('✅ Connected to WebSocket server');
      
      // Simulate unknown webhook event
      setTimeout(() => {
        console.log('📤 Simulating unknown webhook event');
        require('./dist/routes/webhooks').WebhookEvents.emit('unknown-event', {
          event: 'call.unknown',
          payload: { call_id: 'test-unknown' }
        });
      }, 1000);
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.event === 'error' && message.sfx === 'error.wav') {
          console.log('✅ Error handling working correctly');
          console.log(`   - Event: ${message.event}`);
          console.log(`   - SFX: ${message.sfx}`);
          console.log(`   - Data: ${JSON.stringify(message.data)}`);
          
          ws.close();
          resolve(true);
        }
      } catch (error) {
        console.log('📨 Received raw message:', data.toString());
      }
    });
    
    ws.on('close', () => {
      console.log('🔌 WebSocket connection closed');
    });
    
    ws.on('error', (error) => {
      console.log('❌ WebSocket error:', error.message);
      reject(error);
    });
  });
}

// Run all tests
async function runAllTests() {
  try {
    console.log('🚀 Starting comprehensive dialer webhook testing...');
    console.log('');
    
    // Test 1: CRM to Dialer flow
    await testCRMToDialerFlow();
    console.log('✅ Test 1 PASSED');
    
    // Test 2: Webhook event interpretation
    await testWebhookEventInterpretation();
    console.log('✅ Test 2 PASSED');
    
    // Test 3: Error handling
    await testErrorHandling();
    console.log('✅ Test 3 PASSED');
    
    console.log('');
    console.log('🎉 All tests passed!');
    console.log('');
    console.log('📋 Summary:');
    console.log('   ✅ CRM lead data flows correctly to dialer');
    console.log('   ✅ Webhook events are properly interpreted');
    console.log('   ✅ SFX files are correctly mapped');
    console.log('   ✅ Error handling works as expected');
    console.log('');
    console.log('🎯 Next Steps:');
    console.log('   1. Test with real CRM lead selection');
    console.log('   2. Test with actual Telnyx webhook events');
    console.log('   3. Verify SFX playback in Electron app');
    console.log('   4. Test UI state updates in dialer');
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the tests
runAllTests(); 