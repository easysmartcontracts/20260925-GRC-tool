import { Request, Response, NextFunction } from 'express';

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // GET, HEAD, OPTIONS requests do not change state
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  // Bypass CSRF for requests using Bearer token authentication
  // Bearer tokens are immune to CSRF because they are not automatically sent by the browser
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return next();
  }

  const cookieToken = req.cookies['csrf_token'];
  const headerToken = req.headers['x-csrf-token'];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    console.error('CSRF validation failed');
    return res.status(403).json({ error: 'CSRF token mismatch or missing' });
  }

  next();
}
