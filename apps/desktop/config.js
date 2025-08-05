// Environment-based configuration for Crokodialer Desktop App
// SAFE: Check if process.env exists before accessing it
const isDevelopment = (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') || false;

const config = {
  // API Configuration
  api: {
    baseUrl: isDevelopment 
      ? 'http://localhost:3005/api' 
      : 'https://crokodial.com/api',
    socketUrl: isDevelopment 
      ? 'http://localhost:3005' 
      : 'https://crokodial.com',
    wsUrl: isDevelopment 
      ? 'ws://localhost:3005' 
      : 'wss://crokodial.com'
  },
  
  // App Configuration
  app: {
    name: 'Crokodialer',
    version: '1.0.0',
    environment: isDevelopment ? 'development' : 'production'
  },
  
  // Debug Configuration
  debug: {
    enabled: isDevelopment,
    devTools: isDevelopment
  }
};

module.exports = config; 