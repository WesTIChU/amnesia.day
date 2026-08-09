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
  '<!doctype html><html><head><title>Amnesia</title></head><body>Amnesia SPA</body></html>',
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
  assert.match(await res.text(), /<title>Amnesia<\/title>/);
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
