"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketService = void 0;
const ws_1 = require("ws");
const jwt_1 = require("../utils/jwt");
const webhooks_1 = require("../routes/webhooks");
class WebSocketService {
    constructor(server) {
        this.clients = new Map();
        // Create WebSocket server attached to the Express server on /ws path
        this.wss = new ws_1.WebSocketServer({
            server,
            path: '/ws',
            perMessageDeflate: false // Disable compression for better performance
        });
        this.setupWebSocketServer();
        this.setupWebhookIntegration();
        console.log('🚀 WebSocket server configured on /ws path');
    }
    setupWebSocketServer() {
        this.wss.on('connection', (ws, request) => {
            console.log('🔌 [WEBSOCKET] Dialer client connected');
            // Extract token from query parameters or headers
            const url = new URL(request.url || '', `http://localhost`);
            const token = url.searchParams.get('token') ||
                request.headers.authorization?.split(' ')[1];
            if (!token) {
                console.error('❌ [WEBSOCKET] No token provided');
                ws.close(1008, 'Authentication required');
                return;
            }
            try {
                const payload = (0, jwt_1.verifyToken)(token);
                const clientId = `${payload.email}-${Date.now()}`;
                this.clients.set(clientId, { ws, user: payload });
                console.log(`✅ [WEBSOCKET] Dialer client authenticated: ${payload.email}`);
                // Send welcome message
                ws.send(JSON.stringify({
                    event: 'connected',
                    data: { clientId, user: payload.email }
                }));
                ws.on('message', (message) => {
                    try {
                        const parsed = JSON.parse(message.toString());
                        console.log(`📨 [WEBSOCKET] Received message from ${clientId}:`, parsed);
                        this.handleClientMessage(clientId, parsed);
                    }
                    catch (error) {
                        console.error('❌ [WEBSOCKET] Error parsing message:', error);
                    }
                });
                ws.on('close', () => {
                    console.log(`🔌 [WEBSOCKET] Dialer client disconnected: ${payload.email}`);
                    this.clients.delete(clientId);
                });
                ws.on('error', (error) => {
                    console.error('❌ [WEBSOCKET] Dialer client error:', error);
                    this.clients.delete(clientId);
                });
            }
            catch (error) {
                console.error('❌ [WEBSOCKET] Invalid token:', error);
                ws.close(1008, 'Invalid token');
            }
        });
        this.wss.on('error', (error) => {
            console.error('❌ [WEBSOCKET] Server error:', error);
        });
    }
    handleClientMessage(clientId, message) {
        console.log(`📨 [WEBSOCKET] Processing message from ${clientId}:`, message);
        switch (message.type) {
            case 'selectLead':
                this.handleSelectLead(clientId, message.data);
                break;
            case 'ping':
                this.sendToClient(clientId, { event: 'pong', data: { timestamp: Date.now() } });
                break;
            case 'subscribe-call':
                this.sendToClient(clientId, {
                    event: 'subscribed',
                    data: { callId: message.data.callId }
                });
                break;
            default:
                console.log(`📨 [WEBSOCKET] Unhandled event: ${message.type}`);
        }
    }
    handleSelectLead(_clientId, leadData) {
        console.log(`📞 [WEBSOCKET] Received selectLead event: ${leadData.name} (${leadData.leadId})`);
        console.log(`📞 [WEBSOCKET] Full lead data received:`, JSON.stringify(leadData, null, 2));
        console.log(`📞 [WEBSOCKET] Lead name field value: "${leadData.name}"`);
        console.log(`📞 [WEBSOCKET] Lead name field type: ${typeof leadData.name}`);
        console.log(`📞 [WEBSOCKET] Lead name field length: ${leadData.name?.length}`);
        // Broadcast to all connected clients
        const messageToSend = {
            type: 'selectLead',
            data: leadData
        };
        console.log(`📤 [WEBSOCKET] Broadcasting message:`, JSON.stringify(messageToSend, null, 2));
        this.broadcastMessage(messageToSend);
        console.log(`📤 [WEBSOCKET] Broadcasted selectLead to ${this.clients.size} clients`);
    }
    setupWebhookIntegration() {
        // SFX file mapping for Telnyx webhook events
        const sfxMapping = {
            'call-initiated': 'call-initiated.wav',
            'call-answered': 'call-answered.wav',
            'call-hangup': 'call-hangup.wav',
            'call-inbound': 'call-inbound.wav',
            'error': 'error.wav'
        };
        // Listen to webhook events and broadcast to connected clients with SFX mapping
        webhooks_1.WebhookEvents.on('call-initiated', (payload) => {
            console.log(`🔊 [SFX] Playing: ${sfxMapping['call-initiated']}`);
            this.broadcastToAll({
                event: 'call-initiated',
                data: payload,
                sfx: sfxMapping['call-initiated']
            });
        });
        webhooks_1.WebhookEvents.on('call-answered', (payload) => {
            console.log(`🔊 [SFX] Playing: ${sfxMapping['call-answered']}`);
            this.broadcastToAll({
                event: 'call-answered',
                data: payload,
                sfx: sfxMapping['call-answered']
            });
        });
        webhooks_1.WebhookEvents.on('call-hangup', (payload) => {
            console.log(`🔊 [SFX] Playing: ${sfxMapping['call-hangup']}`);
            this.broadcastToAll({
                event: 'call-hangup',
                data: payload,
                sfx: sfxMapping['call-hangup']
            });
        });
        webhooks_1.WebhookEvents.on('call-inbound', (payload) => {
            console.log(`🔊 [SFX] Playing: ${sfxMapping['call-inbound']}`);
            this.broadcastToAll({
                event: 'call-inbound',
                data: payload,
                sfx: sfxMapping['call-inbound']
            });
        });
        webhooks_1.WebhookEvents.on('error', (payload) => {
            console.log(`🔊 [SFX] Playing: ${sfxMapping['error']}`);
            this.broadcastToAll({
                event: 'error',
                data: payload,
                sfx: sfxMapping['error']
            });
        });
    }
    broadcastMessage(message) {
        const messageStr = JSON.stringify(message);
        let sentCount = 0;
        this.clients.forEach((client, clientId) => {
            if (client.ws.readyState === ws_1.WebSocket.OPEN) {
                try {
                    client.ws.send(messageStr);
                    sentCount++;
                }
                catch (error) {
                    console.error(`❌ [WEBSOCKET] Error sending to client ${clientId}:`, error);
                    this.clients.delete(clientId);
                }
            }
            else {
                // Remove disconnected clients
                console.log(`🧹 [WEBSOCKET] Removing disconnected client: ${clientId}`);
                this.clients.delete(clientId);
            }
        });
        console.log(`📤 [WEBSOCKET] Successfully sent message to ${sentCount} clients`);
    }
    broadcastToAll(message) {
        this.broadcastMessage(message);
    }
    sendToClient(clientId, message) {
        const client = this.clients.get(clientId);
        if (client && client.ws.readyState === ws_1.WebSocket.OPEN) {
            try {
                client.ws.send(JSON.stringify(message));
            }
            catch (error) {
                console.error(`❌ [WEBSOCKET] Error sending to client ${clientId}:`, error);
                this.clients.delete(clientId);
            }
        }
    }
    getConnectedClientsCount() {
        return this.clients.size;
    }
    close() {
        this.wss.close();
    }
}
exports.WebSocketService = WebSocketService;
