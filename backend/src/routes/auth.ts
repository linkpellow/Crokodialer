import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { authenticate } from '../middleware/auth';

const router = Router();

const generateToken = (payload: { userId: string; email: string }) => {
  return jwt.sign(payload, process.env.JWT_SECRET || 'fallback-secret', { expiresIn: '24h' });
};

// Register
router.post('/register', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const user = new User({ email, password });
    await user.save();

    const token = generateToken({ userId: (user as any)._id.toString(), email: user.email });
    return res.status(201).json({ token, user: { id: (user as any)._id, email: user.email } });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken({ userId: (user as any)._id.toString(), email: user.email });
    return res.json({ token, user: { id: (user as any)._id, email: user.email } });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// Validate token
router.get('/validate', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await User.findById((req as any).user.userId).select('-password').lean();
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    return res.json({ user });
  } catch (error) {
    console.error('Token validation error:', error);
    return res.status(500).json({ error: 'Token validation failed' });
  }
});

// Get Telnyx JWT for WebRTC
router.get('/telnyx-jwt', authenticate, async (_req: Request, res: Response) => {
  try {
    // Generate JWT using Telnyx API
    const telnyxApiKey = process.env.TELNYX_API_KEY;
    const telephonyCredentialId = process.env.TELNYX_WEBRTC_CREDENTIAL_ID || 'default'; // You'll need to add this to .env
    
    const response = await fetch(`https://api.telnyx.com/v2/telephony_credentials/${telephonyCredentialId}/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${telnyxApiKey}`,
        'Accept': 'text/plain'
      }
    });

    if (!response.ok) {
      throw new Error(`Telnyx API error: ${response.status}`);
    }

    const telnyxJwt = await response.text();
    
    res.json({ 
      jwt: telnyxJwt,
      expires_in: 86400 // 24 hours in seconds
    });
  } catch (error) {
    console.error('Telnyx JWT generation error:', error);
    res.status(500).json({ error: 'Failed to generate Telnyx JWT' });
  }
});

export default router;
