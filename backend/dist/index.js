"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const http_1 = require("http");
const path_1 = __importDefault(require("path"));
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
// Create HTTP server
const server = (0, http_1.createServer)(app);
// Middleware
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3006', 'http://localhost:3007'],
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
    const PORT = process.env.PORT || 4000;
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Health check: http://localhost:${PORT}/health`);
        console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws`);
        // Start WebSocket service
        const wsService = new websocket_1.WebSocketService(server);
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
