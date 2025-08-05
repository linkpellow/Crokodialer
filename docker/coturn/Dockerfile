FROM coturn/coturn:latest

# Copy custom configuration
COPY turnserver.conf /etc/turnserver.conf

# Expose TURN/STUN ports
EXPOSE 3478/tcp 3478/udp
EXPOSE 5349/tcp 5349/udp
EXPOSE 49152-65535/udp

# Run coturn
CMD ["turnserver", "-c", "/etc/turnserver.conf"] 