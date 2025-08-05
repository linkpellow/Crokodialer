const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const axios = require('axios');

console.log('🧪 Testing Webhook Event Broadcasting');
console.log('=====================================');
console.log('');

// Generate test JWT token
const payload = {
  email: 'test@crokodial.com',
  userId: 'test-dialer-user'
};

const token = jwt.sign(payload, '7f41db3a78344878e86de1e7ed96e9d3d56f23a8449388ec1bffb70eaf6ce02e', { expiresIn: '1h' });

// Test webhook events
const testEvents = [
  {
    name: 'call.initiated',
    payload: {
      data: {
        event_type: 'call.initiated',
        payload: {
          call_id: 'test-call-1',
          direction: 'outbound',
          from: '+15551234567',
          to: '+15551234567'
        }
      }
    },
    expectedSfx: 'call-initiated.wav'
  },
  {
    name: 'call.answered',
    payload: {
      data: {
        event_type: 'call.answered',
        payload: {
          call_id: 'test-call-1',
          status: 'answered',
          duration: 0
        }
      }
    },
    expectedSfx: 'call-answered.wav'
  },
  {
    name: 'call.hangup',
    payload: {
      data: {
        event_type: 'call.hangup',
        payload: {
          call_id: 'test-call-1',
          status: 'completed',
          duration: 120
        }
      }
    },
    expectedSfx: 'call-hangup.wav'
  },
  {
    name: 'call.inbound',
    payload: {
      data: {
        event_type: 'call.inbound',
        payload: {
          call_id: 'test-call-2',
          direction: 'inbound',
          from: '+15551234567',
          to: '+15551234567'
        }
      }
    },
    expectedSfx: 'call-inbound.wav'
  }
];

async function testWebhookBroadcasting() {
  console.log('📋 Testing Webhook Event Broadcasting');
  console.log('=====================================');
  
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:3005/ws?token=${token}`);
    let receivedEvents = [];
    
    ws.on('open', () => {
      console.log('✅ Connected to WebSocket server');
      console.log('⏳ Waiting for webhook events...');
      
      // Send webhook events after connection
      setTimeout(async () => {
        for (let i = 0; i < testEvents.length; i++) {
          const event = testEvents[i];
          
          try {
            console.log(`📤 Sending webhook: ${event.name}`);
            
            const response = await axios.post('http://localhost:3005/api/webhooks/telnyx', event.payload, {
              headers: {
                'Content-Type': 'application/json'
              }
            });
            
            if (response.status === 200) {
              console.log(`   ✅ Webhook sent successfully`);
            } else {
              console.log(`   ❌ Webhook failed: ${response.status}`);
            }
            
            // Wait a bit between webhooks
            await new Promise(resolve => setTimeout(resolve, 500));
            
          } catch (error) {
            console.log(`   ❌ Error sending webhook: ${error.message}`);
          }
        }
        
        // Close after sending all webhooks
        setTimeout(() => {
          ws.close();
          resolve(receivedEvents);
        }, 2000);
        
      }, 1000);
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        // Only process webhook events (not connection messages)
        if (message.event && message.sfx) {
          console.log(`📨 Received webhook event: ${message.event}`);
          console.log(`   - SFX: ${message.sfx}`);
          console.log(`   - Call ID: ${message.data.call_id}`);
          console.log(`   - Direction: ${message.data.direction || 'N/A'}`);
          console.log(`   - Status: ${message.data.status || 'N/A'}`);
          
          receivedEvents.push({
            event: message.event,
            sfx: message.sfx,
            data: message.data
          });
        } else if (message.event === 'connected') {
          console.log('📨 Connected to WebSocket server');
        }
        
      } catch (error) {
        console.log('📨 Raw message:', data.toString());
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

async function runTest() {
  try {
    console.log('🚀 Starting webhook broadcasting test...');
    console.log('');
    
    const receivedEvents = await testWebhookBroadcasting();
    
    console.log('\n📋 Test Results:');
    console.log('================');
    
    if (receivedEvents.length === 0) {
      console.log('❌ No webhook events received');
      console.log('   This could mean:');
      console.log('   - WebSocket service is not listening to webhook events');
      console.log('   - Webhook events are not being broadcasted');
      console.log('   - There is a timing issue');
    } else {
      console.log(`✅ Received ${receivedEvents.length} webhook events`);
      
      // Verify SFX mapping
      let correctMapping = 0;
      receivedEvents.forEach((event, index) => {
        const expectedEvent = testEvents.find(e => e.name.replace('.', '-') === event.event);
        if (expectedEvent && expectedEvent.expectedSfx === event.sfx) {
          console.log(`   ✅ Event ${index + 1}: ${event.event} → ${event.sfx}`);
          correctMapping++;
        } else {
          console.log(`   ❌ Event ${index + 1}: ${event.event} → ${event.sfx} (expected ${expectedEvent?.expectedSfx})`);
        }
      });
      
      console.log(`\n📊 Summary:`);
      console.log(`   - Total events received: ${receivedEvents.length}`);
      console.log(`   - Correct SFX mapping: ${correctMapping}/${receivedEvents.length}`);
      
      if (correctMapping === receivedEvents.length) {
        console.log(`   ✅ All events have correct SFX mapping!`);
      } else {
        console.log(`   ⚠️  Some events have incorrect SFX mapping`);
      }
    }
    
    console.log('\n🎯 Next Steps:');
    console.log('   1. Check backend logs for webhook processing');
    console.log('   2. Verify WebSocket service is listening to webhook events');
    console.log('   3. Test with real Telnyx webhook events');
    console.log('   4. Verify dialer UI updates correctly');
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
runTest(); 