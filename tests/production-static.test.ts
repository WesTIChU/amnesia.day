import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

// Exercise the production static-serving branch in isolation: the client build
// is served from a temporary dist/ directory and the server bundle must never
// be reachable. Each test file runs in its own process, so setting NODE_ENV
// here does not affect the other suites.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'amnesia-prod-static-'));
const distDir = path.join(tmpDir, 'dist');
fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(
  path.join(distDir, 'index.html'),
  '<!doctype html><html lang="en"><head><title>Amnesia</title><meta name="description" content="fallback" /><meta name="robots" content="index, follow" /><link rel="canonical" href="https://amnesia.day/" /><meta property="og:title" content="Amnesia" /><meta property="og:description" content="fallback" /><meta property="og:url" content="https://amnesia.day/" /><meta name="twitter:title" content="Amnesia" /><meta name="twitter:description" content="fallback" /></head><body>Amnesia SPA</body></html>',
);

process.env.KEY_PEPPER = 'test-only-pepper';
process.env.MASTER_KEY_PATH = path.join(tmpDir, 'master.key');
process.env.AMNESIA_DB_PATH = path.join(tmpDir, 'amnesia.db');
process.env.AMNESIA_DATA_DIR = tmpDir;
process.env.AMNESIA_DIST_PATH = distDir;
process.env.NODE_ENV = 'production';

let server: http.Server;
let baseUrl: string;

before(async () => {
  const serverModule = await import('../server.js');
  const app = await serverModule.buildApp();
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(() => {
  server?.closeAllConnections?.();
  server?.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('production serves the SPA at /', async () => {
  const res = await fetch(`${baseUrl}/`);
  assert.equal(res.status, 200, 'GET / should return the SPA');
  const body = await res.text();
  assert.match(body, /Amnesia SPA/, 'GET / must return the SPA shell body');
  assert.match(body, /<title>Amnesia \| A Memory for Your Future Self<\/title>/);
  assert.match(body, /rel="canonical" href="https:\/\/amnesia\.day\/"/);
});

test('production redirects an HTTP scheme reported by the front proxy', async () => {
  const res = await fetch(`${baseUrl}/?source=http`, {
    headers: { 'X-Forwarded-Proto': 'http' },
    redirect: 'manual',
  });
  assert.equal(res.status, 308);
  assert.equal(res.headers.get('location'), `${baseUrl.replace('http://', 'https://')}/?source=http`);
});

test('the server bundle is never served', async () => {
  for (const pathname of ['/server.cjs', '/server.cjs.map']) {
    const res = await fetch(`${baseUrl}${pathname}`);
    assert.equal(res.status, 404, `GET ${pathname} must return 404, not the bundle or the SPA fallback`);
    const body = await res.text();
    assert.doesNotMatch(body, /Amnesia SPA/, `GET ${pathname} must not fall back to the SPA`);
    assert.doesNotMatch(body, /Amnesia/, `GET ${pathname} must not leak server code or the SPA`);
  }
});

test('sensitive-looking paths return an explicit 404, not the SPA', async () => {
  const sensitivePaths = [
    '/.env',
    '/.env.local',
    '/.env.production',
    '/.git',
    '/.git/config',
    '/data',
    '/data/amnesia.db',
    '/master.key',
    '/package.json',
    '/package-lock.json',
    '/server.cjs',
    '/server.cjs.map',
  ];
  for (const pathname of sensitivePaths) {
    const res = await fetch(`${baseUrl}${pathname}`);
    assert.equal(res.status, 404, `GET ${pathname} must return 404, not the SPA fallback`);
    const body = await res.text();
    assert.doesNotMatch(body, /Amnesia/, `GET ${pathname} must not leak the SPA`);
  }

  // Legitimate SPA routes must be unaffected by the sensitive-path block.
  const spa = await fetch(`${baseUrl}/about`);
  assert.equal(spa.status, 200, 'GET /about must still return the SPA');
});

test('authenticated SPA sub-routes are served to the client router', async () => {
  // /vault/calendar and /vault/entries are client-side routes: the server
  // serves the SPA so the client can apply its own session guard, which
  // redirects unauthenticated visitors back to the opening flow.
  for (const pathname of ['/vault/calendar', '/vault/entries']) {
    const res = await fetch(`${baseUrl}${pathname}`);
    assert.equal(res.status, 200, `GET ${pathname} must serve the SPA`);
    assert.match(await res.text(), /Amnesia SPA/, `GET ${pathname} must return the SPA shell`);
  }
});

test('private routes are noindex at the server', async () => {
  for (const pathname of ['/vault', '/card', '/vault/calendar', '/vault/entries']) {
    const res = await fetch(`${baseUrl}${pathname}`);
    assert.equal(res.status, 200, `GET ${pathname} must serve the SPA`);
    assert.match(
      res.headers.get('x-robots-tag') || '',
      /noindex/,
      `GET ${pathname} must send an X-Robots-Tag noindex header`,
    );
    const body = await res.text();
    assert.match(body, /<meta name="robots" content="noindex, nofollow, noarchive"/, `GET ${pathname} must inject noindex meta`);
    assert.match(body, /rel="canonical" href="https:\/\/amnesia\.day\/"/, `GET ${pathname} canonical must point to /`);
  }
});

test('public routes inject accurate indexable metadata', async () => {
  const cases: Array<[string, string, string]> = [
    ['/about', 'About Amnesia', 'index, follow'],
    ['/privacy', 'Privacy | Amnesia', 'index, follow'],
  ];
  for (const [pathname, titlePart, robots] of cases) {
    const res = await fetch(`${baseUrl}${pathname}`);
    assert.equal(res.status, 200, `GET ${pathname} must serve the SPA`);
    const body = await res.text();
    assert.match(body, new RegExp(`<title>[^<]*${titlePart}[^<]*</title>`), `GET ${pathname} must inject its title`);
    assert.match(body, new RegExp(`rel="canonical" href="https:\\/\\/amnesia\\.day${pathname}"`), `GET ${pathname} must inject its canonical`);
    assert.match(body, new RegExp(`<meta name="robots" content="${robots}`), `GET ${pathname} must remain indexable`);
  }
});

test('public trailing slashes redirect in one hop to the canonical URL', async () => {
  for (const pathname of ['/about/', '/privacy/', '/faq/', '/terms/']) {
    const res = await fetch(`${baseUrl}${pathname}`, { redirect: 'manual' });
    assert.equal(res.status, 308, `GET ${pathname} must 308 redirect`);
    assert.equal(
      res.headers.get('location'),
      `https://amnesia.day${pathname.slice(0, -1)}`,
      `GET ${pathname} must redirect to the slash-less canonical URL`,
    );
  }
});
