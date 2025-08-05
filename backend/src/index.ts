// @ts-nocheck
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import path from 'path';
import { verifyToken, TokenPayload } from './utils/jwt';
import { fusionPBX } from './services/fusionpbx';
import { WebSocketService } from './services/websocket';
import connectDB from './config/database';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

console.log('🔧 Environment Configuration:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('MONGODB_URI:', process.env.MONGODB_URI ? '***configured***' : 'NOT SET');
console.log('TELNYX_API_KEY:', process.env.TELNYX_API_KEY ? `${process.env.TELNYX_API_KEY.slice(0, 10)}...` : 'NOT SET');

// Import routes
import authRoutes from './routes/auth';
import callsRoutes from './routes/calls';
import leadsRoutes from './routes/leads';
import uiConfigRoutes from './routes/ui-config';
import webhookRoutes from './routes/webhooks';

// Create Express app
const app = express();

// Create HTTP server
const server = createServer(app);

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3006', 'http://localhost:3007'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Crokodial Backend is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/calls', callsRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/ui-config', uiConfigRoutes);
app.use('/api/webhooks', webhookRoutes);

// Connect to database and start server
async function startServer() {
  try {
    // Connect to MongoDB (with fallback for development)
    await connectDB();
    
    // Start server
    const PORT = process.env.PORT || 4000;
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`🔌 WebSocket endpoint: ws://localhost:${PORT}/ws`);

      // Start WebSocket service
      const wsService = new WebSocketService(server);
      console.log('✅ WebSocket service initialized on /ws path');

      // Connect to FusionPBX ESL (optional)
      if (process.env.FUSIONPBX_ENABLED !== 'false') {
        try {
          fusionPBX.connect();
          console.log('✅ FusionPBX bridge enabled');
        } catch (error) {
          console.log('⚠️ FusionPBX bridge disabled (connection failed)');
        }
      } else {
        console.log('⚠️ FusionPBX bridge disabled (FUSIONPBX_ENABLED=false)');
      }
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    
    // In development, continue even if database fails
    if (process.env.NODE_ENV === 'development') {
      console.log('⚠️ Starting server without database in development mode');
      const PORT = process.env.PORT || 4000;
      server.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT} (no database)`);
        console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      });
    } else {
      process.exit(1);
    }
  }
}

// Start the server
startServer();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
}); 