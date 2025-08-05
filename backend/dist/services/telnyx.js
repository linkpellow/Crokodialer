"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startOutboundCall = startOutboundCall;
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../.env') });
const TELNYX_API_KEY = process.env.TELNYX_API_KEY;
const TELNYX_CONNECTION_ID = process.env.TELNYX_APP_ID || process.env.TELNYX_CONNECTION_ID; // Use APP_ID first, then fallback to CONNECTION_ID
console.log('Telnyx API Key loaded:', TELNYX_API_KEY ? 'YES' : 'NO');
console.log('Telnyx Connection ID loaded:', TELNYX_CONNECTION_ID ? 'YES' : 'NO');
console.log('Telnyx API Key (first 10 chars):', TELNYX_API_KEY ? TELNYX_API_KEY.substring(0, 10) + '...' : 'NOT SET');
console.log('Telnyx Connection ID:', TELNYX_CONNECTION_ID || 'NOT SET');
if (!TELNYX_API_KEY) {
    console.warn('TELNYX_API_KEY not set – Telnyx outbound calling will be disabled.');
}
async function startOutboundCall({ fromNumber, toNumber }) {
    if (!TELNYX_API_KEY || !TELNYX_CONNECTION_ID) {
        throw new Error('Telnyx environment vars not configured');
    }
    const url = 'https://api.telnyx.com/v2/calls';
    const payload = {
        connection_id: TELNYX_CONNECTION_ID,
        to: toNumber,
        from: fromNumber,
    };
    try {
        console.log('Making Telnyx API request with payload:', JSON.stringify(payload, null, 2));
        console.log('Authorization header:', `Bearer ${TELNYX_API_KEY.substring(0, 10)}...`);
        const resp = await axios_1.default.post(url, payload, {
            headers: {
                'Authorization': `Bearer ${TELNYX_API_KEY.trim()}`,
                'Content-Type': 'application/json'
            }
        });
        const data = resp.data?.data;
        return {
            call_control_id: data?.call_control_id,
            call_leg_id: data?.call_leg_id
        };
    }
    catch (error) {
        console.error('Telnyx API error:', error.response?.data || error.message);
        throw error;
    }
}
