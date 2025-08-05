import express from 'express';
import { EventEmitter } from 'events';

// Create a global event emitter for internal app communication
export const WebhookEvents = new EventEmitter();

const router = express.Router();

// Middleware to parse raw body for signature verification
router.use(express.json({
  verify: (req: any, _res: any, buf: any) => {
    req.rawBody = buf;
  }
}));

// Telnyx webhook endpoint
router.post('/telnyx', (req: any, res: any) => {
  const event = req.body.data?.event_type;
  const payload = req.body.data?.payload;

  console.log(`[WEBHOOK] ${event}`, payload);

  if (!event || !payload) {
    console.error('[WEBHOOK] Invalid webhook payload');
    return res.sendStatus(400);
  }

  // Emit events for internal app communication
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
      console.log('[WEBHOOK] Unhandled event:', event);
      WebhookEvents.emit('error', { event, payload });
  }

  return res.sendStatus(200);
});

export default router;