# SFX Webhook Mapping Implementation

## Overview

This document describes the implementation of sound effects (SFX) mapping for Telnyx webhook events in the Crokodial Dialer application.

## Webhook Event to SFX File Mapping

| Telnyx Webhook Event | SFX File Name | Description |
|--------------------- |---------------|-------------|
| `call.initiated` | `call-initiated.wav` | Played when a call is initiated |
| `call.answered` | `call-answered.wav` | Played when a call is answered |
| `call.hangup` | `call-hangup.wav` | Played when a call ends |
| `call.inbound` | `call-inbound.wav` | Played when receiving an inbound call |
| `error` (custom) | `error.wav` | Played for any unhandled webhook events |

## Implementation Details

### Backend Webhook Handling

The webhook events are processed in `src/routes/webhooks.ts`:

```typescript
// Only handle the specific events we want
switch (event) {
  case 'call.initiated':
    WebhookEvents.emit('call-initiated', payload);
    break;
  case 'call.answered':
    WebhookEvents.emit('call-answered', payload);
    break;
  case 'call.hangup':
    WebhookEvents.emit('call-hangup', payload);
    break;
  case 'call.inbound':
    WebhookEvents.emit('call-inbound', payload);
    break;
  default:
    WebhookEvents.emit('error', { event, payload });
}
```

### WebSocket Broadcasting with SFX

The WebSocket service in `src/services/websocket.ts` broadcasts events with SFX information:

```typescript
const sfxMapping = {
  'call-initiated': 'call-initiated.wav',
  'call-answered': 'call-answered.wav',
  'call-hangup': 'call-hangup.wav',
  'call-inbound': 'call-inbound.wav',
  'error': 'error.wav'
};

WebhookEvents.on('call-initiated', (payload) => {
  this.broadcastToAll({
    event: 'call-initiated',
    data: payload,
    sfx: sfxMapping['call-initiated']
  });
});
```

### WebSocket Message Format

When a webhook event is received, the WebSocket message includes:

```json
{
  "event": "call-initiated",
  "data": {
    "call_id": "call_123",
    "direction": "outbound"
  },
  "sfx": "call-initiated.wav"
}
```

## Client-Side Implementation

### Electron App Integration

The Electron app should listen for WebSocket messages and play the corresponding SFX:

```javascript
// In Electron renderer process
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  if (message.sfx) {
    // Play the SFX file
    playSFX(message.sfx);
  }
  
  // Handle the event data
  handleCallEvent(message.event, message.data);
};

function playSFX(sfxFile) {
  const audio = new Audio(`./SFX/${sfxFile}`);
  audio.play().catch(error => {
    console.error('Error playing SFX:', error);
  });
}
```

### SFX File Requirements

- **Format**: WAV files
- **Location**: `SFX/` directory
- **Naming**: Must match the mapping exactly
- **Size**: Optimized for quick loading

## Testing

### Test Webhook Events

Run the test script to verify webhook event handling:

```bash
cd backend
node test-webhook-sfx.js
```

### Test with Real Webhooks

Send test webhook payloads to `/api/webhooks/telnyx`:

```bash
curl -X POST http://localhost:3005/api/webhooks/telnyx \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "event_type": "call.initiated",
      "payload": {
        "call_id": "test-call-1",
        "direction": "outbound"
      }
    }
  }'
```

## SFX Files Available

| File Name | Size | Description |
|-----------|------|-------------|
| `call-initiated.wav` | 9.9MB | Call initiation sound |
| `call-answered.wav` | 3.1MB | Call answered sound |
| `call-hangup.wav` | 539KB | Call hangup sound |
| `call-inbound.wav` | 1.3MB | Inbound call sound |
| `error.wav` | 165KB | Error sound |
| `buttons.wav` | 29KB | Button click sound (UI only) |

## Error Handling

### Unhandled Events
Any webhook event not in the mapping will trigger the `error` event and play `error.wav`.

### Missing SFX Files
If an SFX file is missing, the client should:
1. Log a warning
2. Continue processing the event
3. Optionally play a fallback sound

### Audio Playback Errors
Handle audio playback failures gracefully:
```javascript
audio.play().catch(error => {
  console.warn(`Failed to play SFX: ${sfxFile}`, error);
  // Continue with event processing
});
```

## Performance Considerations

### Audio Preloading
Consider preloading SFX files for better performance:
```javascript
const sfxCache = {};

function preloadSFX() {
  const sfxFiles = ['call-initiated.wav', 'call-answered.wav', 'call-hangup.wav', 'call-inbound.wav', 'error.wav'];
  
  sfxFiles.forEach(file => {
    sfxCache[file] = new Audio(`./SFX/${file}`);
  });
}
```

### Volume Control
Allow users to control SFX volume:
```javascript
function playSFX(sfxFile, volume = 0.5) {
  const audio = sfxCache[sfxFile] || new Audio(`./SFX/${sfxFile}`);
  audio.volume = volume;
  audio.play();
}
```

## Deployment Notes

### Production Deployment
1. Ensure SFX files are included in the deployment
2. Verify file permissions allow audio playback
3. Test webhook endpoints with real Telnyx events

### Monitoring
- Log SFX playback attempts
- Monitor for missing SFX files
- Track webhook event processing

## Troubleshooting

### Common Issues
1. **SFX not playing**: Check file paths and permissions
2. **Webhook not received**: Verify endpoint URL and authentication
3. **Audio errors**: Check browser/Electron audio permissions

### Debug Commands
```bash
# Test webhook endpoint
curl -X POST http://localhost:3005/api/webhooks/telnyx -H "Content-Type: application/json" -d '{"data":{"event_type":"call.initiated","payload":{"call_id":"test"}}}'

# Check SFX files
ls -la SFX/

# Test WebSocket connection
node test-websocket.js
```

## Status: ✅ IMPLEMENTED

The SFX webhook mapping is fully implemented and ready for testing with real Telnyx webhook events. 