# Coturn Docker Setup

This directory contains Docker configuration for running a local TURN server for development and testing.

## Quick Start

1. Start the TURN server:
```bash
docker-compose up -d
```

2. Check logs:
```bash
docker-compose logs -f
```

3. Stop the server:
```bash
docker-compose down
```

## Configuration

The local configuration uses:
- Username: `testuser`
- Password: `testpass`
- Ports: 3478 (TURN/STUN), 5349 (TLS)

## Testing

Test the TURN server with:
```bash
# Install coturn-utils if not already installed
sudo apt install coturn-utils

# Test from host
turnutils_uclient -u testuser -w testpass 127.0.0.1
```

## Production Deployment

For production deployment on your VPS:
1. Use the deployment script: `scripts/deploy-turn-server.sh`
2. Or follow the manual setup in `docs/deployment/turn-server-setup.md`

## Environment Variables

Update your `.env` file for local testing:
```env
STUN_SERVER=stun:localhost:3478
TURN_SERVER=turn:localhost:3478
TURN_USERNAME=testuser
TURN_PASSWORD=testpass
```

## Troubleshooting

- If ports are already in use, stop other services or change ports in `turnserver.conf`
- Check Docker logs: `docker-compose logs coturn`
- Ensure Docker has sufficient permissions for network access 