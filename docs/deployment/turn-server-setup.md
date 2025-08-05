# TURN Server Setup Guide

This guide will help you set up a TURN server using coturn on your FusionPBX VPS for WebRTC connectivity.

## Prerequisites

- Ubuntu/Debian-based VPS (same server as FusionPBX)
- Root or sudo access
- Public IP address
- Domain name (optional but recommended)

## Step 1: Install coturn

Connect to your VPS via SSH and run:

```bash
sudo apt update
sudo apt install coturn -y
```

## Step 2: Configure coturn

1. Enable coturn by editing the default configuration:

```bash
sudo nano /etc/default/coturn
```

Uncomment the line:
```
TURNSERVER_ENABLED=1
```

2. Create/edit the main configuration file:

```bash
sudo nano /etc/turnserver.conf
```

3. Use the template from `config/coturn/turnserver.conf.template` and replace:
   - `YOUR_PUBLIC_SERVER_IP` with your VPS public IP
   - `yourdomain.com` with your domain or IP
   - `turnuser:turnpassword` with secure credentials

Example configuration:
```
listening-port=3478
tls-listening-port=5349

listening-ip=178.156.169.6
relay-ip=178.156.169.6

min-port=49152
max-port=65535

fingerprint
lt-cred-mech
realm=crokodial.com
user=crokodial:SecurePassword123!

total-quota=100
bps-capacity=0
stale-nonce

no-loopback-peers
no-multicast-peers
```

## Step 3: Configure Firewall

Open required ports:

```bash
# TURN/STUN ports
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
sudo ufw allow 5349/tcp
sudo ufw allow 5349/udp

# Media relay ports
sudo ufw allow 49152:65535/udp

# Enable firewall if not already enabled
sudo ufw enable
```

## Step 4: Start and Enable coturn

```bash
sudo systemctl enable coturn
sudo systemctl restart coturn
```

Check status:
```bash
sudo systemctl status coturn
```

## Step 5: Configure Application

Update your application's `.env` file:

```env
# WebRTC Configuration
STUN_SERVER=stun:stun.l.google.com:19302
TURN_SERVER=turn:178.156.169.6:3478
TURN_USERNAME=crokodial
TURN_PASSWORD=SecurePassword123!
```

## Step 6: Testing

1. Check if coturn is listening:
```bash
sudo netstat -nlup | grep turnserver
```

2. Test TURN server connectivity:
```bash
# From another machine
turnutils_uclient -u crokodial -w SecurePassword123! 178.156.169.6
```

3. Monitor logs:
```bash
sudo journalctl -u coturn -f
```

## Optional: TLS Configuration

For production, consider setting up TLS:

1. Obtain SSL certificates (e.g., using Let's Encrypt)
2. Update turnserver.conf:
```
cert=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
pkey=/etc/letsencrypt/live/yourdomain.com/privkey.pem
```

3. Update application to use `turns:` instead of `turn:`

## Troubleshooting

### Common Issues

1. **Connection refused**: Check firewall rules and ensure coturn is running
2. **Authentication failed**: Verify credentials match in both server and client config
3. **No relay candidates**: Check relay-ip configuration and port range

### Debug Mode

Enable verbose logging in turnserver.conf:
```
verbose
log-file=/var/log/turnserver/turnserver.log
```

### Performance Tuning

For high traffic:
```
# Increase file descriptors
ulimit -n 65536

# In turnserver.conf
total-quota=1000
max-bps=0
```

## Security Best Practices

1. Use strong credentials
2. Regularly update coturn
3. Monitor access logs
4. Consider rate limiting
5. Use TLS in production
6. Restrict access by IP if possible

## Maintenance

### Backup Configuration
```bash
sudo cp /etc/turnserver.conf /etc/turnserver.conf.backup
```

### Update coturn
```bash
sudo apt update
sudo apt upgrade coturn
```

### Monitor Resources
```bash
# Check connections
sudo turnutils_uclient -u crokodial -w SecurePassword123! 127.0.0.1

# Check resource usage
htop
```

## Integration with FusionPBX

Since this TURN server runs on the same VPS as FusionPBX:

1. Ensure ports don't conflict with FusionPBX
2. Monitor combined resource usage
3. Consider separate VPS for production scale

## Next Steps

1. Test WebRTC calls through the TURN server
2. Monitor bandwidth usage
3. Set up monitoring/alerting
4. Document credentials securely
5. Plan for scaling if needed 