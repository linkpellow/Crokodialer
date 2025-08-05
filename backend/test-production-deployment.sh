#!/bin/bash

# Test Production Deployment Script
# This script tests the production server configuration locally

echo "🧪 Testing production deployment configuration..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the backend directory."
    exit 1
fi

# Check if SSL certificates exist (for production)
echo "🔍 Checking SSL certificates..."
if [ -f "/etc/letsencrypt/live/crokodial.com/fullchain.pem" ]; then
    echo "✅ SSL certificates found"
else
    echo "⚠️  SSL certificates not found - this is expected in development"
    echo "   In production, certificates should be at:"
    echo "   - /etc/letsencrypt/live/crokodial.com/fullchain.pem"
    echo "   - /etc/letsencrypt/live/crokodial.com/privkey.pem"
fi

# Load environment variables
echo "🔍 Loading environment variables..."
if [ -f "../.env" ]; then
    export $(grep -v '^#' ../.env | xargs)
    echo "✅ Environment variables loaded from ../.env"
elif [ -f ".env" ]; then
    export $(grep -v '^#' .env | xargs)
    echo "✅ Environment variables loaded from .env"
else
    echo "❌ Error: .env file not found"
    exit 1
fi

# Check environment variables
echo "🔍 Checking environment variables..."
if [ -z "$MONGODB_URI" ]; then
    echo "❌ Error: MONGODB_URI not set"
    exit 1
fi

if [ -z "$JWT_SECRET" ]; then
    echo "❌ Error: JWT_SECRET not set"
    exit 1
fi

echo "✅ Environment variables check passed"

# Test TypeScript compilation
echo "🔨 Testing TypeScript compilation..."
if npx tsc --noEmit; then
    echo "✅ TypeScript compilation successful"
else
    echo "❌ TypeScript compilation failed"
    exit 1
fi

# Test production server startup (without actually starting)
echo "🧪 Testing production server configuration..."
if node -e "
const fs = require('fs');
const path = require('path');

// Test if production server file exists
const serverFile = path.join(__dirname, 'src/server-production.ts');
if (!fs.existsSync(serverFile)) {
    console.error('❌ Production server file not found');
    process.exit(1);
}

// Test if required modules can be imported
try {
    require('dotenv');
    require('express');
    require('https');
    require('fs');
    require('mongoose');
    console.log('✅ All required modules available');
} catch (error) {
    console.error('❌ Module import error:', error.message);
    process.exit(1);
}

console.log('✅ Production server configuration test passed');
"; then
    echo "✅ Production server configuration test passed"
else
    echo "❌ Production server configuration test failed"
    exit 1
fi

echo ""
echo "🎉 Production deployment test completed successfully!"
echo ""
echo "📋 Deployment Checklist:"
echo "✅ TypeScript compilation"
echo "✅ Environment variables"
echo "✅ Required modules"
echo "✅ Production server file"
echo ""
echo "🚀 Ready for production deployment!"
echo "   Run: ./deploy-production.sh"
echo ""
echo "🔗 Expected endpoints:"
echo "   - HTTPS API: https://crokodial.com/api"
echo "   - WebSocket: wss://crokodial.com/ws"
echo "   - Health: https://crokodial.com/health" 