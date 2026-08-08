import 'dotenv/config';
import express from 'express';
import path from 'path';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer as createViteServer } from 'vite';
import {
  createArchiveV2,
  getMemoriesForArchiveSession,
  addMemoryForSession,
  addEncryptedMemoryForSession,
  markMemoryReadForSession,
  deleteArchiveById,
  createSession,
  createSessionV2,
  getV2AuthSalt,
  getSession,
  verifySessionCsrf,
  destroySession,
  destroySessionsForArchive,
  runTimekeeperProcess,
  getPublicStats,
  getMachineMetrics
} from './server/db.js';

const SESSION_COOKIE = 'amnesia_session';
const CSRF_COOKIE = 'amnesia_csrf';

function getClientIp(req: { socket: { remoteAddress?: string }; get: (name: string) => string | undefined }): string {
  const cloudflareIp = req.get('CF-Connecting-IP');
  if (process.env.TRUST_CLOUDFLARE_PROXY === 'true' && cloudflareIp) return cloudflareIp;
  return req.socket.remoteAddress || 'unknown';
}

function getCookie(req: { headers: { cookie?: string } }, name: string): string | null {
  const cookies = req.headers.cookie?.split(';') || [];
  const item = cookies.find((cookie) => cookie.trim().startsWith(`${name}=`));
  return item ? decodeURIComponent(item.trim().slice(name.length + 1)) : null;
}

function cookieOptions(isProduction: boolean, maxAge: number): string {
  return `Path=/; Max-Age=${maxAge}; Priority=High; SameSite=Strict${isProduction ? '; Secure' : ''}`;
}

function setSessionCookies(res: { setHeader: (name: string, value: string[]) => void }, sessionToken: string, csrfToken: string, isProduction: boolean): void {
  res.setHeader('Set-Cookie', [
    `${SESSION_COOKIE}=${encodeURIComponent(sessionToken)}; HttpOnly; ${cookieOptions(isProduction, 86400)}`,
    `${CSRF_COOKIE}=${encodeURIComponent(csrfToken)}; ${cookieOptions(isProduction, 86400)}`
  ]);
}

function clearSessionCookies(res: { setHeader: (name: string, value: string[]) => void }, isProduction: boolean): void {
  res.setHeader('Set-Cookie', [
    `${SESSION_COOKIE}=; HttpOnly; ${cookieOptions(isProduction, 0)}`,
    `${CSRF_COOKIE}=; ${cookieOptions(isProduction, 0)}`
  ]);
}

function decodeBase64Url(value: unknown): Buffer | null {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    return Buffer.from(value, 'base64url');
  } catch {
    return null;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  const HOST = process.env.HOST || (process.env.NODE_ENV === 'production' ? '127.0.0.1' : '0.0.0.0');

  // Do not trust arbitrary X-Forwarded-For headers. Cloudflare's validated
  // client header is used for rate-limit keys only when explicitly enabled.
  app.set('trust proxy', false);

  // Middleware
  app.use(express.json({ limit: '100kb' }));

  const isProduction = process.env.NODE_ENV === 'production';
  app.use(
    helmet({
      contentSecurityPolicy: isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", 'https://fonts.googleapis.com'],
              styleSrcAttr: ["'unsafe-inline'"],
              fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
              imgSrc: ["'self'", 'data:'],
              connectSrc: ["'self'"],
              objectSrc: ["'none'"],
              baseUri: ["'self'"],
              frameAncestors: ["'none'"]
            }
          }
        : false,
      crossOriginEmbedderPolicy: false
      ,strictTransportSecurity: isProduction
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false
    })
  );

  // Rate Limiter
  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // Limit each IP to 200 requests per 15 minutes
    keyGenerator: (req) => getClientIp(req),
    // These endpoints have their own behavior-specific limits or are cheap
    // public reads, so telemetry cannot prevent archive creation.
    skip: (req) => {
      const path = req.originalUrl.split('?')[0];
      return (
        (req.method === 'GET' && (path === '/api/stats' || path === '/api/machine')) ||
        (req.method === 'POST' && (path === '/api/archive/create' || path === '/api/archive/create-v2' || path === '/api/archive/lookup-v2' || path === '/api/archive/open'))
      );
    },
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests from this IP, please try again later.' }
  });

  const createLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: isProduction ? 15 : 10000, // Keep production strict; allow local development testing.
    keyGenerator: (req) => getClientIp(req),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Creation rate limit exceeded. Please wait a while before creating another key.' }
  });

  const createV2Limiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: isProduction ? 15 : 10000,
    keyGenerator: (req) => getClientIp(req),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Creation rate limit exceeded. Please wait a while before creating another key.' }
  });

  const archiveOpenLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    keyGenerator: (req) => getClientIp(req),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many archive access attempts. Please wait a while before trying again.' }
  });

  const archiveLookupLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    keyGenerator: (req) => getClientIp(req),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many archive lookup attempts. Please wait a while before trying again.' }
  });

  const destructiveLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    keyGenerator: (req) => getClientIp(req),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many destructive requests. Please try again later.' }
  });

  const requireSession = (req: any, res: any, next: any) => {
    const sessionToken = getCookie(req, SESSION_COOKIE);
    const session = sessionToken ? getSession(sessionToken) : null;
    if (!session || !sessionToken) {
      return res.status(401).json({ error: 'Archive session expired. Please open the archive again.' });
    }
    res.locals.sessionToken = sessionToken;
    res.locals.archiveId = session.archiveId;
    next();
  };

  const requireCsrf = (req: any, res: any, next: any) => {
    const csrfToken = req.get('X-CSRF-Token');
    if (!csrfToken || !verifySessionCsrf(res.locals.sessionToken, csrfToken)) {
      return res.status(403).json({ error: 'CSRF validation failed.' });
    }
    next();
  };

  app.use('/api/', generalLimiter);

  // API Endpoints
  app.get('/api/stats', (req, res) => {
    try {
      const stats = getPublicStats();
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to retrieve stats' });
    }
  });

  app.post('/api/archive/create', createLimiter, (req, res) => {
    res.status(410).json({ error: 'Legacy archive creation is disabled. Use the V2 archive flow.' });
  });

  app.post('/api/archive/create-v2', createV2Limiter, (req, res) => {
    try {
      const { lookupVerifier, authVerifier, authSalt } = req.body;
      if (typeof lookupVerifier !== 'string' || typeof authVerifier !== 'string' || typeof authSalt !== 'string' ||
        !/^[A-Za-z0-9_-]+$/.test(lookupVerifier) || !/^[A-Za-z0-9_-]+$/.test(authVerifier) ||
        !/^[A-Za-z0-9_-]+$/.test(authSalt) || Buffer.from(authSalt, 'base64url').length !== 16) {
        return res.status(400).json({ error: 'Invalid archive authentication data.' });
      }
      const archive = createArchiveV2(lookupVerifier, authVerifier, authSalt);
      const session = createSessionV2(authVerifier, authSalt);
      if (!session) return res.status(500).json({ error: 'Could not establish archive session.' });
      setSessionCookies(res, session.sessionToken, session.csrfToken, isProduction);
      res.json(archive);
    } catch (err: any) {
      res.status(500).json({ error: 'Could not create memory archive. Please try again.' });
    }
  });

  app.post('/api/archive/lookup-v2', archiveLookupLimiter, (req, res) => {
    const { lookupVerifier } = req.body;
    if (typeof lookupVerifier !== 'string' || !/^[A-Za-z0-9_-]+$/.test(lookupVerifier)) {
      return res.status(400).json({ error: 'Invalid archive lookup data.' });
    }
    res.json({ version: 2, authSalt: getV2AuthSalt(lookupVerifier) });
  });

  app.post('/api/archive/open', archiveOpenLimiter, (req, res) => {
    try {
      const { key, version, authVerifier, authSalt } = req.body;
      if (version === 2) {
        if (typeof authVerifier !== 'string' || typeof authSalt !== 'string' || Buffer.from(authSalt, 'base64url').length !== 16) {
          return res.status(400).json({ error: 'Invalid archive authentication data.' });
        }
        const session = createSessionV2(authVerifier, authSalt);
        if (!session) return res.status(404).json({ error: 'No archive found matching this Memory Key.' });
        const data = getMemoriesForArchiveSession(session.archiveId);
        if (!data) return res.status(404).json({ error: 'No archive found matching this Memory Key.' });
        setSessionCookies(res, session.sessionToken, session.csrfToken, isProduction);
        return res.json(data);
      }
      if (!key || typeof key !== 'string') {
        return res.status(400).json({ error: 'Memory Key is required.' });
      }

      const session = createSession(key.trim());
      if (!session) {
        return res.status(404).json({ error: 'No archive found matching this Memory Key.' });
      }

      const data = getMemoriesForArchiveSession(session.archiveId);
      if (!data) return res.status(404).json({ error: 'No archive found matching this Memory Key.' });
      setSessionCookies(res, session.sessionToken, session.csrfToken, isProduction);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: 'Error opening archive.' });
    }
  });

  app.get('/api/archive/session', requireSession, (req, res) => {
    try {
      const data = getMemoriesForArchiveSession(res.locals.archiveId);
      if (!data) return res.status(404).json({ error: 'Archive session is no longer valid.' });
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: 'Error loading archive session.' });
    }
  });

  app.post('/api/archive/memory', requireSession, requireCsrf, (req, res) => {
    try {
      if (req.body.encryptionVersion === 2) {
        const { ciphertext, nonce, authTag, clientSalt, memoryId } = req.body;
        const nonceBytes = decodeBase64Url(nonce);
        const authTagBytes = decodeBase64Url(authTag);
        const clientSaltBytes = decodeBase64Url(clientSalt);
        if (!decodeBase64Url(ciphertext) || nonceBytes?.length !== 12 || authTagBytes?.length !== 16 || clientSaltBytes?.length !== 16 ||
          typeof memoryId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(memoryId)) {
          return res.status(400).json({ error: 'Invalid encrypted memory payload.' });
        }
        const result = addEncryptedMemoryForSession(res.locals.archiveId, { ciphertext, nonce, authTag, clientSalt, memoryId });
        if (!result.success) return res.status(400).json({ error: result.message });
        return res.json(result);
      }

      const { content } = req.body;
      if (!content || typeof content !== 'string') {
        return res.status(400).json({ error: 'Memory content is required.' });
      }

      const trimmedContent = content.trim();
      if (!trimmedContent) return res.status(400).json({ error: 'Memory cannot be empty.' });
      if (trimmedContent.length > 2000) return res.status(400).json({ error: 'Memory exceeds 2000 characters limit.' });

      const result = addMemoryForSession(res.locals.archiveId, trimmedContent);
      if (!result.success) {
        return res.status(400).json({ error: result.message });
      }

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to archive memory.' });
    }
  });

  app.post('/api/archive/memory/read', requireSession, requireCsrf, (req, res) => {
    try {
      const { memoryId } = req.body;
      if (!Number.isSafeInteger(memoryId) || memoryId <= 0) {
        return res.status(400).json({ error: 'memoryId must be a positive safe integer.' });
      }

      const result = markMemoryReadForSession(res.locals.archiveId, memoryId);
      if (!result) {
        return res.status(404).json({ error: 'Memory or archive not found.' });
      }

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to record memory read.' });
    }
  });

  app.delete('/api/archive/delete', destructiveLimiter, requireSession, requireCsrf, (req, res) => {
    try {
      if (req.body.confirmation !== 'DELETE') {
        return res.status(400).json({ error: 'Type DELETE to confirm permanent archive deletion.' });
      }

      const archiveId = res.locals.archiveId;
      const deleted = deleteArchiveById(archiveId);
      if (!deleted) {
        return res.status(404).json({ error: 'Archive not found or key invalid.' });
      }

      destroySession(res.locals.sessionToken);
      destroySessionsForArchive(archiveId);
      clearSessionCookies(res, isProduction);
      res.json({ message: 'Archive permanently erased. Memory Key retired.' });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to delete archive.' });
    }
  });

  app.get('/api/machine', (req, res) => {
    try {
      const metrics = getMachineMetrics();
      res.json(metrics);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch machine telemetry.' });
    }
  });

  app.post('/api/archive/logout', requireSession, requireCsrf, (req, res) => {
    destroySession(res.locals.sessionToken);
    clearSessionCookies(res, isProduction);
    res.status(204).end();
  });

  // Catch up missed unlocks once at startup. Regular runs are performed by
  // the local `amnesia timekeeper run` CLI command via a systemd timer.
  try {
    runTimekeeperProcess();
  } catch (e) {
    console.error('Initial Timekeeper run error:', e);
  }
  // Vite middleware for development vs static serve for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`[Amnesia] Server listening on http://${HOST}:${PORT}`);
  });
}

startServer();
