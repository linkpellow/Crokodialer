# Crokodial Desktop Dialer

A beautiful Electron-based desktop dialer application for the Crokodial CRM system.

## Features

- 🔐 Secure JWT authentication
- 📞 WebRTC-based calling
- 🎨 Modern dark UI design
- 🔊 Real-time audio communication
- 📱 Traditional dial pad interface
- 🔌 Socket.io for real-time signaling

## Prerequisites

1. Make sure the backend server is running:
   ```bash
   # From project root
   npm run dev:backend
   ```

2. Ensure you have a test user account. You can create one using:
   ```bash
   curl -X POST http://localhost:4000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"password123"}'
   ```

## Running the Desktop App

From the project root:
```bash
npm run dev:desktop
```

Or from the desktop app directory:
```bash
cd apps/desktop
npm run dev
```

## Usage

1. **Login**: Enter your email and password to authenticate
2. **Dial**: Use the dial pad to enter a phone number
3. **Call**: Press the green call button to initiate a call
4. **Hang Up**: Press the red hang up button to end the call

## Building for Distribution

To create distributable packages:
```bash
npm run build:desktop
```

This will create:
- `.dmg` file for macOS
- `.exe` installer for Windows
- `.AppImage` for Linux

## Development

The app consists of:
- `main.js` - Main Electron process
- `renderer.js` - UI logic and WebRTC handling
- `index.html` - HTML structure
- `styles.css` - Modern dark theme styling

## Troubleshooting

- **Can't connect**: Make sure the backend is running on port 4000
- **Microphone access**: The app will request microphone permissions on first call
- **Login issues**: Verify your credentials are correct and the backend is accessible 