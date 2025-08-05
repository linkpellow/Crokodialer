"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = telnyxWebhook;
const express_1 = __importStar(require("express"));
const crypto_1 = __importDefault(require("crypto"));
const Call_1 = __importDefault(require("../models/Call"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../../.env') });
const WEBHOOK_SECRET = process.env.TELNYX_WEBHOOK_SECRET;
function telnyxWebhook(io) {
    const router = (0, express_1.Router)();
    // Raw body parser middleware
    router.use(express_1.default.raw({ type: 'application/json' }));
    router.post('/', async (req, res) => {
        try {
            if (WEBHOOK_SECRET) {
                const signature = req.headers['telnyx-signature-ed25519'];
                const timestamp = req.headers['telnyx-timestamp'];
                const rawBody = req.body;
                if (!signature || !timestamp) {
                    return res.status(400).send('Missing signature or timestamp');
                }
                const verified = crypto_1.default.verify(null, Buffer.from(timestamp + '.' + rawBody.toString()), {
                    key: WEBHOOK_SECRET,
                    format: 'pem',
                    type: 'spki'
                }, Buffer.from(signature, 'base64'));
                if (!verified) {
                    return res.status(400).send('Invalid signature');
                }
            }
            else {
                console.warn('TELNYX_WEBHOOK_SECRET not set – skipping signature verification');
            }
            const event = JSON.parse(req.body.toString());
            const eventType = event.data?.event_type;
            const payload = event.data?.payload;
            const callControlId = payload?.call_control_id;
            if (!callControlId)
                return res.status(200).send('no call_control_id');
            // Determine new status from event
            const statusMap = {
                'call.initiated': 'ringing',
                'call.ringing': 'ringing',
                'call.answered': 'active',
                'call.hangup': 'ended'
            };
            const newStatus = statusMap[eventType];
            if (newStatus) {
                await Call_1.default.findOneAndUpdate({ callControlId }, { status: newStatus });
                io.to(`call_${callControlId}`).emit('call-status', { status: newStatus, eventType });
            }
            return res.status(200).json({ received: true });
        }
        catch (err) {
            console.error('Telnyx webhook error:', err);
            return res.status(500).send('server error');
        }
    });
    return router;
}
