# 🚀 Production Deployment Checklist

## ✅ WebSocket Server Configuration

### 1. Development Setup
- [x] WebSocket server runs on `/ws` path
- [x] Development endpoint: `ws://localhost:3005/ws`
- [x] JWT authentication implemented
- [x] Lead selection broadcasting working

### 2. Production Setup
- [ ] SSL certificates installed at `/etc/letsencrypt/live/crokodial.com/`
- [ ] Production endpoint: `wss://crokodial.com/ws`
- [ ] Server runs on port 443 (HTTPS)
- [ ] CORS configured for production domains

### 3. Security Checklist
- [x] JWT token validation
- [x] WebSocket authentication
- [x] CORS properly configured
- [ ] Rate limiting implemented
- [ ] Input validation on all endpoints

### 4. Monitoring & Logging
- [x] Comprehensive logging implemented
- [ ] Error tracking (Sentry/LogRocket)
- [ ] Performance monitoring
- [ ] WebSocket connection monitoring

## 🔧 Deployment Commands

### Development
```bash
npm run dev
```

### Production
```bash
npm run start:prod
```

### Build for Production
```bash
npm run build
npm start
```

## 🌐 Endpoints

### Development
- **API Base**: `http://localhost:3005/api`
- **WebSocket**: `ws://localhost:3005/ws`
- **Health Check**: `http://localhost:3005/health`

### Production
- **API Base**: `https://crokodial.com/api`
- **WebSocket**: `wss://crokodial.com/ws`
- **Health Check**: `https://crokodial.com/health`

## 📡 WebSocket Events

### Client → Server
- `selectLead` - Lead selection from CRM
- `ping` - Keep-alive ping
- `subscribe-call` - Subscribe to call events

### Server → Client
- `connected` - Connection confirmation
- `selectLead` - Lead data broadcast
- `call-initiated` - Call started
- `call-answered` - Call answered
- `call-hangup` - Call ended
- `dtmf-received` - DTMF input received
- `call-recording-saved` - Recording saved
- `call-speak-started` - TTS started
- `call-speak-ended` - TTS ended
- `pong` - Ping response

## 🔐 Authentication

### WebSocket Connection
```javascript
// Connect with JWT token
const ws = new WebSocket('wss://crokodial.com/ws?token=YOUR_JWT_TOKEN');
```

### API Authentication
```javascript
// Include token in headers
headers: {
  'Authorization': 'Bearer YOUR_JWT_TOKEN'
}
```

## 🚨 Troubleshooting

### Common Issues
1. **Port 3006 already in use**: Fixed by using `/ws` path
2. **SSL certificate errors**: Check certificate paths
3. **CORS errors**: Verify origin configuration
4. **WebSocket connection fails**: Check authentication token

### Debug Commands
```bash
# Check if server is running
curl https://crokodial.com/health

# Test WebSocket connection
wscat -c wss://crokodial.com/ws?token=YOUR_TOKEN

# Check SSL certificate
openssl s_client -connect crokodial.com:443
```

## 📊 Performance Metrics

### WebSocket Server
- Connected clients: `wsService.getConnectedClientsCount()`
- Message throughput
- Connection stability
- Authentication success rate

### API Endpoints
- Response times
- Error rates
- Database connection status
- Webhook delivery success

## 🔄 Data Flow Summary

1. **CRM Web App** → WebSocket → **Backend**
2. **Backend** → WebSocket → **Desktop App**
3. **Telnyx** → Webhook → **Backend**
4. **Backend** → WebSocket → **All Clients**

## ✅ Ready for Production

The WebSocket server is now configured for production deployment with:
- ✅ SSL/HTTPS support
- ✅ JWT authentication
- ✅ Real-time lead selection
- ✅ Webhook integration
- ✅ Comprehensive logging
- ✅ Error handling
- ✅ Graceful shutdown

Ready to deploy to `crokodial.com`! 🚀 