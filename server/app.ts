import 'dotenv/config';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import path from 'path';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer as createViteServer } from 'vite';
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
  validateV2EncryptedMemory,
  decodeBase64UrlOrNull,
  getIntegrityStatus
} from './db.js';

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

// Archive authentication fields are strict base64url-encoded verifiers. They
// must decode to the exact expected length; anything malformed, empty or
// oversized is rejected before it can touch the database.
const MAX_AUTH_VALUE_LENGTH = 64;

function decodeAuthField(value: unknown, expectedBytes: number): Buffer | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_AUTH_VALUE_LENGTH) return null;
  const decoded = decodeBase64UrlOrNull(value);
  if (!decoded || decoded.length !== expectedBytes) return null;
  return decoded;
}

export async function buildApp(): Promise<express.Express> {
  const app = express();

  // Do not trust arbitrary X-Forwarded-For headers. Cloudflare's validated
  // client header is used for rate-limit keys only when explicitly enabled.
  app.set('trust proxy', false);

  const isProduction = process.env.NODE_ENV === 'production';

  // Cloudflare Tunnel forwards the original scheme in this header. Redirect
  // HTTP crawls before they can receive a duplicate, non-canonical page.
  if (isProduction) {
    app.use((req, res, next) => {
      if (req.get('X-Forwarded-Proto') === 'http') {
        return res.redirect(308, `https://${req.get('host')}${req.originalUrl}`);
      }
      next();
    });
  }

  if (isProduction && process.env.TRUST_CLOUDFLARE_PROXY !== 'true') {
    console.warn(
      '[Amnesia] Running in production without TRUST_CLOUDFLARE_PROXY=true. If traffic arrives only through ' +
      'Cloudflare Tunnel, every visitor appears as 127.0.0.1 and shares a single rate-limit identity. ' +
      'Set TRUST_CLOUDFLARE_PROXY=true to key rate limits on Cloudflare\'s CF-Connecting-IP header ' +
      '(never trust X-Forwarded-For).'
    );
  }

  // Middleware
  app.use(express.json({ limit: '100kb' }));

  app.use(
    helmet({
      contentSecurityPolicy: isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'"],
              styleSrcAttr: ["'unsafe-inline'"],
              fontSrc: ["'self'", 'data:'],
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

  const requireSession = (req: Request, res: Response, next: NextFunction) => {
    const sessionToken = getCookie(req, SESSION_COOKIE);
    const session = sessionToken ? getSession(sessionToken) : null;
    if (!session || !sessionToken) {
      return res.status(401).json({ error: 'Archive session expired. Please open the archive again.' });
    }
    res.locals.sessionToken = sessionToken;
    res.locals.archiveId = session.archiveId;
    next();
  };

  const requireCsrf = (req: Request, res: Response, next: NextFunction) => {
    const csrfToken = req.get('X-CSRF-Token');
    if (!csrfToken || !verifySessionCsrf(res.locals.sessionToken, csrfToken)) {
      return res.status(403).json({ error: 'CSRF validation failed.' });
    }
    next();
  };

  app.use('/api/', generalLimiter);

  // Archive responses carry encrypted memory material and session data, so
  // they must never be cached by browsers, proxies, or CDNs.
  app.use('/api/archive', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, private');
    res.setHeader('Pragma', 'no-cache');
    next();
  });

  // API Endpoints
  app.get('/api/stats', telemetryLimiter, (req, res) => {
    try {
      res.json(withTelemetryCache(statsCache, () => getPublicStats()));
    } catch {
      res.status(500).json({ error: 'Failed to retrieve stats' });
    }
  });

  app.post('/api/archive/create', createLimiter, (req, res) => {
    res.status(410).json({ error: 'Legacy archive creation is disabled. Use the V2 archive flow.' });
  });

  app.post('/api/archive/create-v2', createV2Limiter, (req, res) => {
    try {
      const { lookupVerifier, authVerifier, authSalt } = req.body;
      // lookupVerifier: exactly 32 bytes, authVerifier: exactly 32 bytes,
      // authSalt: exactly 16 bytes. Malformed, empty or oversized values are
      // rejected before any database write.
      const lookupBytes = decodeAuthField(lookupVerifier, 32);
      const authBytes = decodeAuthField(authVerifier, 32);
      const saltBytes = decodeAuthField(authSalt, 16);
      if (!lookupBytes || !authBytes || !saltBytes) {
        return res.status(400).json({ error: 'Invalid archive authentication data.' });
      }

      const archive = createArchiveV2(lookupVerifier, authVerifier, authSalt);
      if (archive.ok === false) {
        const message = archive.reason === 'retired'
          ? 'This Recovery Phrase has been retired and cannot be used again.'
          : 'This Recovery Phrase is already in use by an existing archive.';
        return res.status(409).json({ error: message });
      }
      const session = createSessionV2(authVerifier, authSalt);
      if (!session) return res.status(500).json({ error: 'Could not establish archive session.' });
      setSessionCookies(res, session.sessionToken, session.csrfToken, isProduction);
      res.json({ archiveId: archive.archiveId, createdAt: archive.createdAt, encryptionSalt: archive.encryptionSalt });
    } catch {
      res.status(500).json({ error: 'Could not create memory archive. Please try again.' });
    }
  });

  app.post('/api/archive/lookup-v2', archiveLookupLimiter, (req, res) => {
    const { lookupVerifier } = req.body;
    if (!decodeAuthField(lookupVerifier, 32)) {
      return res.status(400).json({ error: 'Invalid archive lookup data.' });
    }
    res.json({ version: 2, authSalt: getV2AuthSalt(lookupVerifier) });
  });

  app.post('/api/archive/open', archiveOpenLimiter, (req, res) => {
    try {
      const { key, version, authVerifier, authSalt } = req.body;
      if (version === 2) {
        if (!decodeAuthField(authVerifier, 32) || !decodeAuthField(authSalt, 16)) {
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
    } catch {
      res.status(500).json({ error: 'Error opening archive.' });
    }
  });

  app.get('/api/archive/session', requireSession, (req, res) => {
    try {
      const data = getMemoriesForArchiveSession(res.locals.archiveId);
      if (!data) return res.status(404).json({ error: 'Archive session is no longer valid.' });
      res.json(data);
    } catch {
      res.status(500).json({ error: 'Error loading archive session.' });
    }
  });

  // Live integrity/verification status. The modal polls this while it is open
  // so "Last Verified" and "Archive Size" reflect the most recent Timekeeper
  // run instead of a hardcoded value.
  app.get('/api/archive/integrity', requireSession, (req, res) => {
    try {
      res.json(getIntegrityStatus(res.locals.archiveId));
    } catch {
      res.status(500).json({ error: 'Error reading archive integrity status.' });
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
      if (result.success === false) {
        // A per-day limit violation is a resource conflict (409); everything
        // else is an invalid payload (400).
        return res.status(result.code === 'daily-limit' ? 409 : 400).json({ error: result.message });
      }
      return res.json(result);
    } catch {
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
    } catch {
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
    } catch {
      res.status(500).json({ error: 'Failed to delete archive.' });
    }
  });

  app.get('/api/machine', telemetryLimiter, (req, res) => {
    try {
      res.json(withTelemetryCache(machineCache, () => getMachineMetrics()));
    } catch {
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
    const distPath = process.env.AMNESIA_DIST_PATH || path.join(process.cwd(), 'dist');
    // The server bundle, its source map, and other sensitive or reserved paths
    // must never be served. Direct requests return an explicit 404 rather than
    // falling through to the SPA fallback. These are exact reserved patterns,
    // so legitimate SPA routes (/, /about, /faq, etc.) are unaffected.
    app.get(
      [
        '/.env',
        '/.env.*',
        '/.git',
        '/.git/*',
        '/data',
        '/data/*',
        '/master.key',
        '/package.json',
        '/package-lock.json',
        '/server.cjs',
        '/server.cjs.map',
      ],
      (_req, res) => {
        res.status(404).type('text/plain').send('Not found');
      }
    );
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return app;
}

export async function startServer() {
  const app = await buildApp();
  const PORT = 3000;
  // In production the server is intentionally bound to the loopback interface
  // and expects to be fronted by a reverse proxy or Cloudflare Tunnel.
  const HOST = process.env.HOST || (process.env.NODE_ENV === 'production' ? '127.0.0.1' : '0.0.0.0');

  app.listen(PORT, HOST, () => {
    console.log(`[Amnesia] Server listening on http://${HOST}:${PORT}`);
  });
}
