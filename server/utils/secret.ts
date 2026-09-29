import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

let resolvedSecret = process.env.JWT_SECRET;

export function getJwtSecret(): string {
  if (resolvedSecret) {
    return resolvedSecret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_SECRET environment variable is not set in production.');
  }

  // Development mode fallback: persist to local secret file so restarts don't invalidate tokens
  const secretPath = path.resolve('.jwt_secret');
  try {
    if (fs.existsSync(secretPath)) {
      resolvedSecret = fs.readFileSync(secretPath, 'utf8').trim();
      if (resolvedSecret) return resolvedSecret;
    }
    resolvedSecret = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(secretPath, resolvedSecret, 'utf8');
    return resolvedSecret;
  } catch (e) {
    if (!resolvedSecret) {
      resolvedSecret = crypto.randomBytes(32).toString('hex');
    }
    return resolvedSecret;
  }
}

