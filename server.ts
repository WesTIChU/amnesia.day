import 'dotenv/config';
import express from 'express';
import path from 'path';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer as createViteServer } from 'vite';
import { pathToFileURL } from 'node:url';
import {
  createArchiveV2,
  getMemoriesForArchiveSession,
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
  getMachineMetrics,
  validateV2EncryptedMemory
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

// Public telemetry results are cheap to produce but touch the database,
// filesystem and operating system. Cache them briefly so repeated requests
// cannot flood that work, and cap how often any single client may call them.
const TELEMETRY_CACHE_TTL_MS = 60_000;
const statsCache: { data: unknown; expiresAt: number } = { data: null, expiresAt: 0 };
const machineCache: { data: unknown; expiresAt: number } = { data: null, expiresAt: 0 };

function withTelemetryCache<T>(cache: { data: T | null; expiresAt: number }, compute: () => T): T {
  const now = Date.now();
  if (cache.data !== null && cache.expiresAt > now) {
    return cache.data;
  }
  const data = compute();
  cache.data = data;
  cache.expiresAt = now + TELEMETRY_CACHE_TTL_MS;
  return data;
}

export async function buildApp(): Promise<express.Express> {
  const app = express();

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

  const telemetryLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    keyGenerator: (req) => getClientIp(req),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again later.' }
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
  app.get('/api/stats', telemetryLimiter, (req, res) => {
    try {
      res.json(withTelemetryCache(statsCache, () => getPublicStats()));
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
      if (!archive) {
        return res.status(409).json({ error: 'This Recovery Phrase has been retired and cannot be used again.' });
      }
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
      // Plaintext submissions are disabled. New memories must be encrypted in
      // the browser before they reach the server.
      if (req.body.encryptionVersion !== 2) {
        return res.status(400).json({ error: 'Plaintext memory submissions are disabled. Only client-encrypted V2 memories are accepted.' });
      }

      const { ciphertext, nonce, authTag, clientSalt, memoryId } = req.body;
      const invalid = validateV2EncryptedMemory({ ciphertext, nonce, authTag, clientSalt, memoryId });
      if (invalid) {
        return res.status(400).json({ error: invalid });
      }

      const result = addEncryptedMemoryForSession(res.locals.archiveId, { ciphertext, nonce, authTag, clientSalt, memoryId });
      if (!result.success) return res.status(400).json({ error: result.message });
      return res.json(result);
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
      if (result === null) {
        return res.status(404).json({ error: 'Memory or archive not found.' });
      }
      if (result.success === false) {
        return res.status(409).json({ error: result.error });
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

  app.get('/api/machine', telemetryLimiter, (req, res) => {
    try {
      res.json(withTelemetryCache(machineCache, () => getMachineMetrics()));
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
  // Vite middleware for development vs static serve for production.
  // Skip both in tests: API integration tests run headless and must not
  // spin up Vite's middleware (and its WebSocket/HMR handles).
  if (process.env.NODE_ENV === 'test') {
    // API-only mode; no static or dev middleware.
  } else if (process.env.NODE_ENV !== 'production') {
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

  return app;
}

async function startServer() {
  const app = await buildApp();
  const PORT = 3000;
  const HOST = process.env.HOST || (process.env.NODE_ENV === 'production' ? '127.0.0.1' : '0.0.0.0');

  app.listen(PORT, HOST, () => {
    console.log(`[Amnesia] Server listening on http://${HOST}:${PORT}`);
  });
}

// Only start the server when this module is executed directly. When imported
// (e.g. by integration tests), expose the app for programmatic use.
// The production bundle is CommonJS (require.main) while tsx runs this file
// as ESM (import.meta.url), so both entrypoint checks are needed.
const isMainModule = (() => {
  if (typeof require !== 'undefined' && require.main === module) return true;
  return Boolean(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href);
})();

if (isMainModule) {
  startServer();
}
