import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

// Isolate the database, master key and pepper BEFORE importing the server.
// Each test file runs in its own process, so env changes here are isolated.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'amnesia-api-test-'));
process.env.KEY_PEPPER = 'test-only-pepper';
process.env.MASTER_KEY_PATH = path.join(tmpDir, 'master.key');
process.env.AMNESIA_DB_PATH = path.join(tmpDir, 'amnesia.db');
process.env.NODE_ENV = 'test';

// The server modules read process.env at import time, so they are loaded
// inside before() rather than through top-level await. Top-level await in a
// test file keeps the module's promise pending until the event loop drains,
// which node:test reports as a cancelled file.
let buildApp: () => Promise<import('express').Express>;
let db: { close: () => void; prepare: (sql: string) => { run: (...args: unknown[]) => unknown } };
let createV2MemoryKey: () => { key: string; authSalt: string };
let deriveV2AuthVerifier: (key: string, authSaltOverride?: string) => Promise<{ authVerifier: string; authSalt: string }>;
let deriveV2LookupVerifier: (key: string) => Promise<string>;
let encryptV2Memory: (key: string, archiveSalt: string, plaintext: string, archiveId: number) => Promise<Record<string, string>>;

interface TestClient {
  csrf: string;
  request: (pathname: string, init?: RequestInit) => Promise<Response>;
}

function createClient(baseUrl: string): TestClient {
  const cookies = new Map<string, string>();
  return {
    get csrf() {
      return cookies.get('amnesia_csrf') || '';
    },
    async request(pathname: string, init: RequestInit = {}) {
      const headers = new Headers(init.headers);
      const cookieHeader = [...cookies.entries()]
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');
      if (cookieHeader) headers.set('cookie', cookieHeader);
      const res = await fetch(`${baseUrl}${pathname}`, { ...init, headers });
      const setCookies = (res.headers as Headers).getSetCookie
        ? (res.headers as Headers & { getSetCookie(): string[] }).getSetCookie()
        : [];
      for (const setCookie of setCookies) {
        const [pair] = setCookie.split(';');
        const idx = pair.indexOf('=');
        if (idx > 0) cookies.set(pair.slice(0, idx), pair.slice(idx + 1));
      }
      return res;
    },
  };
}

let server: http.Server;
let baseUrl: string;

before(async () => {
  const serverModule = await import('../server.js');
  buildApp = serverModule.buildApp;
  db = (await import('../server/db.js')).db as typeof db;
  const cryptoModule = await import('../src/lib/crypto.js');
  createV2MemoryKey = cryptoModule.createV2MemoryKey;
  deriveV2AuthVerifier = cryptoModule.deriveV2AuthVerifier;
  deriveV2LookupVerifier = cryptoModule.deriveV2LookupVerifier;
  encryptV2Memory = cryptoModule.encryptV2Memory;

  const app = await buildApp();
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(() => {
  server?.closeAllConnections?.();
  server?.close();
  db?.close();
});

async function createArchive(client: TestClient): Promise<{ key: string; archiveId: number; encryptionSalt: string; createdAt: string }> {
  const generated = createV2MemoryKey();
  const auth = await deriveV2AuthVerifier(generated.key, generated.authSalt);
  const lookupVerifier = await deriveV2LookupVerifier(generated.key);
  const res = await client.request('/api/archive/create-v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...auth, lookupVerifier }),
  });
  assert.equal(res.status, 200, 'create-v2 should succeed');
  const data = await res.json();
  assert.ok(data.archiveId, 'create-v2 should return archiveId');
  assert.ok(data.encryptionSalt, 'create-v2 should return encryptionSalt');
  return { key: generated.key, ...data };
}

async function sealMemory(client: TestClient, key: string, archiveId: number, encryptionSalt: string, plaintext: string): Promise<{ memoryId: number; unlockAt: string }> {
  const inner = await encryptV2Memory(key, encryptionSalt, plaintext, archiveId);
  const res = await client.request('/api/archive/memory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': client.csrf },
    body: JSON.stringify({ encryptionVersion: 2, ...inner }),
  });
  assert.equal(res.status, 200, 'encrypted memory submission should succeed');
  const data = await res.json();
  assert.ok(data.success, 'memory should be archived');
  return { memoryId: data.memoryId, unlockAt: data.unlockAt };
}

async function fetchArchive(client: TestClient): Promise<Record<string, any>> {
  const res = await client.request('/api/archive/session');
  assert.equal(res.status, 200, 'session fetch should succeed');
  return res.json();
}

test('V2 creation, encrypted memory, Timekeeper material and read flow', async () => {
  const client = createClient(baseUrl);
  const { key, archiveId, encryptionSalt } = await createArchive(client);

  const empty = await fetchArchive(client);
  assert.equal(empty.memories.length, 0);

  const { memoryId } = await sealMemory(client, key, archiveId, encryptionSalt, 'A memory sealed for next year.');

  // A waiting memory must never return Timekeeper unlock material.
  let data = await fetchArchive(client);
  assert.equal(data.memories.length, 1);
  const waiting = data.memories[0];
  assert.equal(waiting.unlocked, false);
  assert.ok(waiting.clientSalt, 'waiting memory should carry its client salt');
  assert.equal(waiting.unlockMaterial, undefined, 'waiting memory must not expose unlock material');
  assert.equal(waiting.content, undefined, 'waiting memory must not expose content');

  // Locked memories cannot be marked as read.
  const lockedRead = await client.request('/api/archive/memory/read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': client.csrf },
    body: JSON.stringify({ memoryId }),
  });
  assert.equal(lockedRead.status, 409, 'locked memory read must be rejected');

  // Release the memory as the Timekeeper would (unlocked + past unlock time).
  db.prepare('UPDATE memories SET unlocked = 1, unlock_at = ? WHERE id = ?').run(
    new Date(Date.now() - 1000).toISOString(),
    memoryId,
  );

  data = await fetchArchive(client);
  assert.equal(data.memories[0].unlocked, true);
  const material = data.memories[0].unlockMaterial;
  assert.ok(material, 'released memory must expose unlock material');
  for (const field of ['secret', 'ciphertext', 'nonce', 'authTag']) {
    assert.equal(typeof material[field], 'string');
    assert.ok(material[field].length > 0);
  }

  const readRes = await client.request('/api/archive/memory/read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': client.csrf },
    body: JSON.stringify({ memoryId }),
  });
  assert.equal(readRes.status, 200, 'released memory can be marked as read');
  const read = await readRes.json();
  assert.ok(read.firstReadAt, 'firstReadAt should be recorded');
  assert.equal(read.readCount, 1);
});

test('plaintext, malformed and oversized submissions are rejected', async () => {
  const client = createClient(baseUrl);
  const { key, archiveId, encryptionSalt } = await createArchive(client);

  // Plaintext content is rejected outright.
  const plaintextRes = await client.request('/api/archive/memory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': client.csrf },
    body: JSON.stringify({ content: 'plaintext must never reach the server' }),
  });
  assert.equal(plaintextRes.status, 400, 'plaintext submission must be rejected');

  // V1-style payloads (no encryptionVersion) are rejected.
  const legacyRes = await client.request('/api/archive/memory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': client.csrf },
    body: JSON.stringify({ ciphertext: 'AAAA', nonce: 'AAAAAAAAAAAAAAAAAAAAAA', authTag: 'AAAAAAAAAAAAAAAAAAAAAA' }),
  });
  assert.equal(legacyRes.status, 400, 'V1-style payload must be rejected');

  const valid = await encryptV2Memory(key, encryptionSalt, 'payload to mutate', archiveId);

  const mutations: Array<Record<string, unknown>> = [
    { ...valid, nonce: 'AAAAAAAAAAAAAAAAAAAAAA' }, // 16 bytes, wrong for a 12-byte nonce
    { ...valid, authTag: 'AA' },
    { ...valid, clientSalt: 'AA' },
    { ...valid, memoryId: 'not-a-uuid' },
    { ...valid, ciphertext: 'A'.repeat(11000) }, // decodes past the ciphertext byte cap
  ];

  for (const payload of mutations) {
    const res = await client.request('/api/archive/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': client.csrf },
      body: JSON.stringify({ encryptionVersion: 2, ...payload }),
    });
    assert.equal(res.status, 400, `malformed payload must be rejected: ${JSON.stringify(Object.keys(payload))}`);
  }

  // Nothing should have been written for any rejected payload.
  const data = await fetchArchive(client);
  assert.equal(data.memories.length, 0, 'rejected payloads must not write to the database');

  // Oversized request bodies (over the 100kb JSON limit) are rejected too.
  const huge = await encryptV2Memory(key, encryptionSalt, 'x'.repeat(5000), archiveId);
  const oversizedBody = JSON.stringify({ encryptionVersion: 2, ...huge, padding: 'y'.repeat(200_000) });
  assert.ok(Buffer.byteLength(oversizedBody) > 100 * 1024);
  const sizeRes = await client.request('/api/archive/memory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': client.csrf },
    body: oversizedBody,
  });
  assert.equal(sizeRes.status, 413, 'oversized request body must be rejected');
});

test('one archive cannot access another archive memories', async () => {
  const clientA = createClient(baseUrl);
  const { key: keyA, archiveId: archiveIdA, encryptionSalt: saltA } = await createArchive(clientA);
  const { memoryId: memoryIdA } = await sealMemory(clientA, keyA, archiveIdA, saltA, 'private to archive A');

  const clientB = createClient(baseUrl);
  const { archiveId: archiveIdB } = await createArchive(clientB);

  // Archive B does not see archive A's memories.
  const dataB = await fetchArchive(clientB);
  assert.equal(dataB.memories.length, 0);

  // Archive B cannot mark archive A's memory as read.
  const crossRead = await clientB.request('/api/archive/memory/read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': clientB.csrf },
    body: JSON.stringify({ memoryId: memoryIdA }),
  });
  assert.equal(crossRead.status, 404, 'cross-archive memory read must be rejected');
  assert.ok(archiveIdA !== archiveIdB);

  // Session fetch for archive A still works from its own client.
  const dataA = await fetchArchive(clientA);
  assert.equal(dataA.memories.length, 1);
});

test('deleting an archive retires the Recovery Phrase for V2 creation', async () => {
  const client = createClient(baseUrl);
  const generated = createV2MemoryKey();
  const auth = await deriveV2AuthVerifier(generated.key, generated.authSalt);
  const lookupVerifier = await deriveV2LookupVerifier(generated.key);

  const created = await client.request('/api/archive/create-v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...auth, lookupVerifier }),
  });
  assert.equal(created.status, 200);
  const archive = await created.json();

  const delRes = await client.request('/api/archive/delete', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': client.csrf },
    body: JSON.stringify({ confirmation: 'DELETE' }),
  });
  assert.equal(delRes.status, 200, 'archive should be deletable');

  // The same Recovery Phrase cannot be re-registered after deletion.
  const retiredClient = createClient(baseUrl);
  const retired = await retiredClient.request('/api/archive/create-v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...auth, lookupVerifier }),
  });
  assert.equal(retired.status, 409, 'retired Recovery Phrase must be rejected');

  // A fresh Recovery Phrase still works.
  const fresh = await createArchive(retiredClient);
  assert.ok(fresh.archiveId > 0);
});

test('public telemetry endpoints stay reachable', async () => {
  const client = createClient(baseUrl);
  const statsRes = await client.request('/api/stats');
  assert.equal(statsRes.status, 200);
  const stats = await statsRes.json();
  assert.ok(typeof stats.archivesOpened === 'number');
  assert.ok(typeof stats.sleepingMemories === 'number');

  const machineRes = await client.request('/api/machine');
  assert.equal(machineRes.status, 200);
  const machine = await machineRes.json();
  assert.ok(typeof machine.archivesCount === 'number');
  assert.ok(typeof machine.memoriesCount === 'number');
});
