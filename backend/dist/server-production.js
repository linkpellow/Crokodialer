"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const https_1 = __importDefault(require("https"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// import { verifyToken, TokenPayload } from './utils/jwt'; // Unused import
const fusionpbx_1 = require("./services/fusionpbx");
const websocket_1 = require("./services/websocket");
// Load environment variables
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../.env') });
// Import routes
const auth_1 = __importDefault(require("./routes/auth"));
const calls_1 = __importDefault(require("./routes/calls"));
const leads_1 = __importDefault(require("./routes/leads"));
const ui_config_1 = __importDefault(require("./routes/ui-config"));
const webhooks_1 = __importDefault(require("./routes/webhooks"));
// Create Express app
const app = (0, express_1.default)();
// Middleware
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGINS?.split(',') || ['https://crokodial.com'],
    credentials: true
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Routes
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', message: 'Crokodial Backend is running' });
});
app.use('/api/auth', auth_1.default);
app.use('/api/calls', calls_1.default);
app.use('/api/leads', leads_1.default);
app.use('/api/ui-config', ui_config_1.default);
app.use('/api/webhooks', webhooks_1.default);
// SSL Configuration
const sslOptions = {
    cert: fs_1.default.readFileSync('/etc/letsencrypt/live/crokodial.com/fullchain.pem'),
    key: fs_1.default.readFileSync('/etc/letsencrypt/live/crokodial.com/privkey.pem')
};
// Create HTTPS server
const server = https_1.default.createServer(sslOptions, app);
// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error('MONGODB_URI is not defined in environment variables');
    process.exit(1);
}
mongoose_1.default.connect(MONGODB_URI)
    .then(() => {
    console.log('Connected to MongoDB');
    // Start server
    const PORT = 443; // Standard HTTPS port
    server.listen(PORT, () => {
        console.log(`🚀 Production server running on port ${PORT}`);
        console.log(`Health check: https://crokodial.com/health`);
        console.log(`WebSocket endpoint: wss://crokodial.com/ws`);
        // Start WebSocket service
        new websocket_1.WebSocketService(server);
        console.log('✅ WebSocket service initialized on /ws path');
        // Connect to FusionPBX ESL (optional)
        if (process.env.FUSIONPBX_ENABLED !== 'false') {
            try {
                fusionpbx_1.fusionPBX.connect();
                console.log('FusionPBX bridge enabled');
            }
            catch (error) {
                console.log('FusionPBX bridge disabled (connection failed)');
            }
        }
        else {
            console.log('FusionPBX bridge disabled (FUSIONPBX_ENABLED=false)');
        }
    });
})
    .catch((error) => {
    console.error('MongoDB connection error:', error);
    process.exit(1);
});
// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    await mongoose_1.default.connection.close();
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
