// @ts-nocheck
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { createServer } from 'http';
import path from 'path';
import { verifyToken, TokenPayload } from './utils/jwt';
import { fusionPBX } from './services/fusionpbx';
import { WebSocketService } from './services/websocket';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

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

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI is not defined in environment variables');
  process.exit(1);
}

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    
    // Start server
    const PORT = process.env.PORT || 4000;
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws`);

      // Start WebSocket service
      const wsService = new WebSocketService(server);
      console.log('✅ WebSocket service initialized on /ws path');

      // Connect to FusionPBX ESL (optional)
      if (process.env.FUSIONPBX_ENABLED !== 'false') {
        try {
          fusionPBX.connect();
          console.log('FusionPBX bridge enabled');
        } catch (error) {
          console.log('FusionPBX bridge disabled (connection failed)');
        }
      } else {
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
  await mongoose.connection.close();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}); 