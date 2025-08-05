"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookEvents = void 0;
const express_1 = __importDefault(require("express"));
const events_1 = require("events");
// Create a global event emitter for internal app communication
exports.WebhookEvents = new events_1.EventEmitter();
const router = express_1.default.Router();
// Middleware to parse raw body for signature verification
router.use(express_1.default.json({
    verify: (req, _res, buf) => {
        req.rawBody = buf;
    }
}));
// Telnyx webhook endpoint
router.post('/telnyx', (req, res) => {
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
            exports.WebhookEvents.emit('call-initiated', payload);
            break;
        case 'call.answered':
            exports.WebhookEvents.emit('call-answered', payload);
            break;
        case 'call.hangup':
            exports.WebhookEvents.emit('call-hangup', payload);
            break;
        case 'call.inbound':
            exports.WebhookEvents.emit('call-inbound', payload);
            break;
        default:
            console.log('[WEBHOOK] Unhandled event:', event);
            exports.WebhookEvents.emit('error', { event, payload });
    }
    return res.sendStatus(200);
});
exports.default = router;
