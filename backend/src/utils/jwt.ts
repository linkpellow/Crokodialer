import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-this';
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '7d';

export interface TokenPayload {
  userId: string;
  email?: string;
  _id?: string; // Support for legacy tokens that use _id
}

export function generateToken(payload: TokenPayload): string {
  // Cast payload to any to satisfy jsonwebtoken v8 typings in strict mode
  return jwt.sign(payload as any, JWT_SECRET, {
    expiresIn: JWT_EXPIRATION
  }) as string;
}

export function verifyToken(token: string): TokenPayload {
  const payload = jwt.verify(token, JWT_SECRET) as any;
  
  // Handle both userId and _id formats
  if (payload._id && !payload.userId) {
    return {
      userId: payload._id,
      email: payload.email,
      _id: payload._id
    };
  }
  
  return payload as TokenPayload;
}

export function decodeToken(token: string): TokenPayload | null {
  try {
    return jwt.decode(token) as TokenPayload;
  } catch {
    return null;
  }
} 