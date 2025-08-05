import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod: MongoMemoryServer | null = null;

async function startInMemoryDB(): Promise<string> {
  try {
    console.log('🚀 Starting in-memory MongoDB for development...');
    
    mongod = await MongoMemoryServer.create({
      instance: {
        dbName: 'crokodial_dev'
      }
    });
    
    const uri = mongod.getUri();
    console.log('✅ In-memory MongoDB started at:', uri);
    return uri;
  } catch (error) {
    console.error('❌ Failed to start in-memory MongoDB:', error);
    throw error;
  }
}

const connectDB = async () => {
  try {
    let mongoUri = process.env.MONGODB_URI;
    
    // If no MongoDB URI provided or it's development, use in-memory DB
    if (!mongoUri || process.env.NODE_ENV === 'development') {
      try {
        mongoUri = await startInMemoryDB();
        console.log('📝 Using in-memory MongoDB for development');
      } catch (error) {
        console.warn('⚠️ Failed to start in-memory MongoDB, will try to connect to local MongoDB');
        mongoUri = 'mongodb://127.0.0.1:27017/crokodial_dev';
      }
    }

    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error: any) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    
    // Don't exit the process for database connection errors in development
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      console.log('⚠️ Continuing without database in development mode');
    }
  }
};

mongoose.connection.on('connected', () => {
  console.log('✅ Mongoose connected to DB');
});

mongoose.connection.on('error', (err) => {
  console.error(`❌ Mongoose connection error: ${err}`);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ Mongoose disconnected');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down gracefully...');
  
  await mongoose.connection.close();
  console.log('✅ Mongoose connection closed');
  
  if (mongod) {
    await mongod.stop();
    console.log('✅ In-memory MongoDB stopped');
  }
  
  process.exit(0);
});

export default connectDB; 