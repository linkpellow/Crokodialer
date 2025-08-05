#!/bin/bash

# Production Deployment Script for Crokodial Backend
# This script deploys the backend to production

echo "🚀 Starting production deployment..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the backend directory."
    exit 1
fi

# Load environment variables from .env file
echo "🔍 Loading environment variables from .env file..."
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

if [ -z "$TELNYX_API_KEY" ]; then
    echo "❌ Error: TELNYX_API_KEY not set"
    exit 1
fi

if [ -z "$TELNYX_APP_ID" ]; then
    echo "❌ Error: TELNYX_APP_ID not set"
    exit 1
fi

echo "✅ Environment variables check passed"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build step skipped - running TypeScript directly
echo "🔨 Skipping build - running TypeScript directly"

# Start production server
echo "🚀 Starting production server..."
echo "📡 WebSocket endpoint: wss://crokodial.com/ws"
echo "🌐 API endpoint: https://crokodial.com/api"
echo "🏥 Health check: https://crokodial.com/health"

# Start the production server
echo "🚀 Starting production server..."
npx ts-node src/server-production.ts 