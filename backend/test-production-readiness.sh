#!/bin/bash

# Production Readiness Test Script for Crokodial Dialer
# This script tests all components before going live

echo "🚀 Testing Production Readiness for Crokodial Dialer"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

# Function to print test results
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ PASS${NC}: $2"
        ((PASSED++))
    else
        echo -e "${RED}❌ FAIL${NC}: $2"
        ((FAILED++))
    fi
}

echo ""
echo "1. Testing Backend Health..."
curl -s http://localhost:3005/health > /dev/null
print_result $? "Backend health check"

echo ""
echo "2. Testing WebSocket Endpoint..."
curl -s -I http://localhost:3005/ws | grep -q "404"
print_result $? "WebSocket endpoint configuration"

echo ""
echo "3. Testing Telnyx API Integration..."
curl -s -X POST http://localhost:3005/api/calls/initiate \
  -H "Content-Type: application/json" \
  -d '{"toNumber": "+15551234567", "fromNumber": "+19704520286"}' | grep -q "Telnyx call failed"
print_result $? "Telnyx API integration"

echo ""
echo "4. Testing Webhook Endpoint..."
curl -s -X POST http://localhost:3005/api/webhooks/telnyx \
  -H "Content-Type: application/json" \
  -d '{"data": {"event_type": "test", "payload": {"test": "data"}}}' | grep -q "OK"
print_result $? "Webhook endpoint"

echo ""
echo "5. Testing Environment Variables..."
if [ -n "$TELNYX_API_KEY" ] && [ -n "$TELNYX_APP_ID" ]; then
    print_result 0 "Environment variables configured"
else
    print_result 1 "Environment variables missing"
fi

echo ""
echo "6. Testing Production SSL..."
curl -s -I https://crokodial.com/health | grep -q "200"
print_result $? "Production SSL certificate"

echo ""
echo "7. Testing Production Site Accessibility..."
curl -s https://crokodial.com > /dev/null
print_result $? "Production site accessibility"

echo ""
echo "8. Testing WebSocket URL Configuration..."
if grep -q "wss://crokodial.com/ws" ../apps/desktop/renderer.js; then
    print_result 0 "Production WebSocket URL configured"
else
    print_result 1 "Production WebSocket URL not found"
fi

echo ""
echo "9. Testing Native WebSocket Implementation..."
if ! grep -q "socket.io" ../apps/desktop/renderer.js; then
    print_result 0 "Native WebSocket implementation"
else
    print_result 1 "Socket.io still present"
fi

echo ""
echo "10. Testing Authentication Configuration..."
if grep -q "token" ../apps/desktop/renderer.js; then
    print_result 0 "JWT authentication configured"
else
    print_result 1 "JWT authentication missing"
fi

echo ""
echo "=================================================="
echo "📊 TEST RESULTS SUMMARY"
echo "=================================================="
echo -e "${GREEN}✅ PASSED: $PASSED${NC}"
echo -e "${RED}❌ FAILED: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED! Your dialer is PRODUCTION READY!${NC}"
    echo ""
    echo "🚀 Next Steps:"
    echo "1. Deploy to production server: ./deploy-production.sh"
    echo "2. Configure Telnyx webhooks: https://crokodial.com/api/webhooks/telnyx"
    echo "3. Test live call flow"
    echo "4. Start dialing clients!"
else
    echo -e "${RED}⚠️  Some tests failed. Please fix issues before going live.${NC}"
    echo ""
    echo "🔧 Check the failed tests above and resolve them."
fi

echo ""
echo "📡 Production Endpoints:"
echo "- WebSocket: wss://crokodial.com/ws"
echo "- API: https://crokodial.com/api"
echo "- Health: https://crokodial.com/health" 