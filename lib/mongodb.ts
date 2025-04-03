import mongoose from 'mongoose';

// Get MongoDB URI with fallback for development
const MONGODB_URI = process.env.MONGODB_URI || (process.env.NODE_ENV === 'development' 
  ? 'mongodb://localhost:27017/webpage-creator'
  : '');

let cachedConnection: typeof mongoose | null = null;

// Flag to check if we're in development mode
const isDevelopment = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development';

export async function connectToDatabase() {
  // If we're in development and there's no MongoDB URI, use a mock implementation
  if (!MONGODB_URI) {
    if (isDevelopment) {
      console.warn('MongoDB URI not defined, using mock database in development mode');
      return mongoose; // Return mongoose instance without connecting
    } else {
      throw new Error('Please define the MONGODB_URI environment variable');
    }
  }

  if (cachedConnection) {
    return cachedConnection;
  }

  try {
    const connection = await mongoose.connect(MONGODB_URI);
    cachedConnection = connection;
    return connection;
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    
    if (isDevelopment) {
      console.warn('Failed to connect to MongoDB, using mock database in development mode');
      return mongoose; // Return mongoose instance without connecting
    }
    
    throw error;
  }
} 