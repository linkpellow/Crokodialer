import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../utils/jwt';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      res.status(401).json({ error: 'No authorization header' });
      return;
    }
    
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;
    
    if (!token) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    
    const payload = verifyToken(token);
    // Handle both userId and _id formats
    const userId = payload.userId || payload._id;
    req.user = { ...payload, userId, id: userId } as any;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
} 

export default authenticate; 