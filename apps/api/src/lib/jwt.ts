import jwt from 'jsonwebtoken';
import { env } from '../env';

type TokenType = 'access' | 'refresh';

export function signToken(userId: string, type: TokenType): string {
  const expiresIn = type === 'access' ? `${env.ACCESS_TOKEN_EXPIRE_MINUTES}m` : `${env.REFRESH_TOKEN_EXPIRE_DAYS}d`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return jwt.sign({ sub: userId, type }, env.SECRET_KEY, { expiresIn } as any);
}

export function verifyToken(token: string): { sub: string; type: TokenType } {
  return jwt.verify(token, env.SECRET_KEY) as { sub: string; type: TokenType };
}

export function generateApiKey(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { randomBytes } = require('crypto');
  return `erp_${(randomBytes(32) as Buffer).toString('hex')}`;
}
