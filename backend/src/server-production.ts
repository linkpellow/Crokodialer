import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import https from 'https';
import fs from 'fs';
import path from 'path';
// import { verifyToken, TokenPayload } from './utils/jwt'; // Unused import
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

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['https://crokodial.com'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/health', (_req: express.Request, res: express.Response) => {
  res.json({ status: 'ok', message: 'Crokodial Backend is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/calls', callsRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/ui-config', uiConfigRoutes);
app.use('/api/webhooks', webhookRoutes);

// SSL Configuration
const sslOptions = {
  cert: fs.readFileSync('/etc/letsencrypt/live/crokodial.com/fullchain.pem'),
  key: fs.readFileSync('/etc/letsencrypt/live/crokodial.com/privkey.pem')
};

// Create HTTPS server
const server = https.createServer(sslOptions, app);

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
    const PORT = 443; // Standard HTTPS port
    server.listen(PORT, () => {
      console.log(`🚀 Production server running on port ${PORT}`);
      console.log(`Health check: https://crokodial.com/health`);
      console.log(`WebSocket endpoint: wss://crokodial.com/ws`);

      // Start WebSocket service
      new WebSocketService(server);
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