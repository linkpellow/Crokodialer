import express, { Router, Request, Response } from 'express';
import crypto from 'crypto';
import Call from '../models/Call';
import { Server as IOServer } from 'socket.io';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const WEBHOOK_SECRET = process.env.TELNYX_WEBHOOK_SECRET;

export default function telnyxWebhook(io: IOServer) {
  const router = Router();

  // Raw body parser middleware
  router.use(
    express.raw({ type: 'application/json' }) as unknown as (
      req: Request,
      res: Response,
      next: () => void
    ) => void
  );

  router.post('/', async (req: Request, res: Response) => {
    try {
      if (WEBHOOK_SECRET) {
        const signature = req.headers['telnyx-signature-ed25519'] as string | undefined;
        const timestamp = req.headers['telnyx-timestamp'] as string | undefined;
        const rawBody = req.body as Buffer;

        if (!signature || !timestamp) {
          return res.status(400).send('Missing signature or timestamp');
        }

        const verified = crypto.verify(
          null,
          Buffer.from(timestamp + '.' + rawBody.toString()),
          {
            key: WEBHOOK_SECRET,
            format: 'pem',
            type: 'spki'
          },
          Buffer.from(signature, 'base64')
        );

        if (!verified) {
          return res.status(400).send('Invalid signature');
        }
      } else {
        console.warn('TELNYX_WEBHOOK_SECRET not set – skipping signature verification');
      }

      const event = JSON.parse((req.body as Buffer).toString());
      const eventType = event.data?.event_type;
      const payload = event.data?.payload;
      const callControlId = payload?.call_control_id;

      if (!callControlId) return res.status(200).send('no call_control_id');

      // Determine new status from event
      const statusMap: Record<string, 'ringing' | 'active' | 'ended'> = {
        'call.initiated': 'ringing',
        'call.ringing': 'ringing',
        'call.answered': 'active',
        'call.hangup': 'ended'
      };

      const newStatus = statusMap[eventType];
      if (newStatus) {
        await Call.findOneAndUpdate({ callControlId }, { status: newStatus });
        io.to(`call_${callControlId}`).emit('call-status', { status: newStatus, eventType });
      }

      return res.status(200).json({ received: true });

    } catch (err) {
      console.error('Telnyx webhook error:', err);
      return res.status(500).send('server error');
    }
  });

  return router;
}
 