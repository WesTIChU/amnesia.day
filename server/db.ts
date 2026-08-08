import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { WORDLIST } from './wordlist.js';
import {
  hashMemoryKey,
  verifyMemoryKey,
  encryptMemoryEnvelope,
  decryptMemoryEnvelope,
  archiveAuthLookup,
  createTimekeeperLayer,
  buildV2TimekeeperAad
} from './encryption.js';

// Ensure data directory exists outside public folder
const DATA_DIR = process.env.AMNESIA_DATA_DIR || path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Allow tests and deployments to isolate the database file.
const DB_PATH = process.env.AMNESIA_DB_PATH || path.join(DATA_DIR, 'amnesia.db');

export const db = new DatabaseSync(DB_PATH);

// Initialize SQLite WAL mode and foreign keys
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;

  CREATE TABLE IF NOT EXISTS archives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_hash TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL,
    last_active_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    archive_id INTEGER NOT NULL,
    encrypted_content TEXT NOT NULL,
    ciphertext TEXT,
    encrypted_dek TEXT,
    nonce TEXT,
    auth_tag TEXT,
    encryption_version INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    unlock_at TEXT NOT NULL,
    unlocked INTEGER DEFAULT 0,
    FOREIGN KEY (archive_id) REFERENCES archives(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS retired_keys (
    key_hash TEXT PRIMARY KEY NOT NULL,
    retired_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS statistics (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS timekeeper_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_at TEXT NOT NULL,
    unlocked_count INTEGER NOT NULL,
    details TEXT
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY NOT NULL,
    archive_id INTEGER NOT NULL,
    csrf_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    FOREIGN KEY (archive_id) REFERENCES archives(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_archives_key_hash ON archives(key_hash);
  CREATE INDEX IF NOT EXISTS idx_memories_archive_id ON memories(archive_id);
  CREATE INDEX IF NOT EXISTS idx_memories_unlock_at ON memories(unlock_at);
  CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at);
`);

// Retired-key migration: keep existing retired records, add a non-reversible
// V2 lookup identifier so a retired Recovery Phrase cannot be re-registered.
try {
  const retiredCols = db.prepare('PRAGMA table_info(retired_keys)').all() as Array<{ name: string }>;
  if (!retiredCols.some((c) => c.name === 'auth_lookup_hash')) {
    db.exec('ALTER TABLE retired_keys ADD COLUMN auth_lookup_hash TEXT;');
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_retired_keys_auth_lookup ON retired_keys(auth_lookup_hash);');
} catch (e) {
  console.error('Schema check on retired_keys table:', e);
}

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

// Approximate the client's 2,000-character plaintext limit: AES-256-GCM adds
// a 16-byte tag, and a 2,000-char CJK message can encode to roughly 6,000
// UTF-8 bytes (~8,000 base64url chars). 8,192 bytes covers that with margin.
export const MAX_V2_CIPHERTEXT_BYTES = 8192;

export function decodeBase64UrlOrNull(value: unknown): Buffer | null {
  if (typeof value !== 'string' || !BASE64URL_RE.test(value)) return null;
  try {
    return Buffer.from(value, 'base64url');
  } catch {
    return null;
  }
}

// Reject malformed or oversized V2 encrypted payloads before anything is
// written to the database.
export function validateV2EncryptedMemory(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return 'Invalid encrypted memory payload.';
  const p = payload as Record<string, unknown>;
  const ciphertextBytes = decodeBase64UrlOrNull(p.ciphertext);
  const nonceBytes = decodeBase64UrlOrNull(p.nonce);
  const authTagBytes = decodeBase64UrlOrNull(p.authTag);
  const clientSaltBytes = decodeBase64UrlOrNull(p.clientSalt);
  const memoryId = p.memoryId;

  if (!ciphertextBytes || ciphertextBytes.length < 1 || ciphertextBytes.length > MAX_V2_CIPHERTEXT_BYTES) {
    return 'Invalid or oversized encrypted memory payload.';
  }
  if (!nonceBytes || nonceBytes.length !== 12) return 'Invalid encrypted memory payload.';
  if (!authTagBytes || authTagBytes.length !== 16) return 'Invalid encrypted memory payload.';
  if (!clientSaltBytes || clientSaltBytes.length !== 16) return 'Invalid encrypted memory payload.';
  if (typeof memoryId !== 'string' || !UUID_V4_RE.test(memoryId)) return 'Invalid encrypted memory payload.';
  return null;
}

// node:sqlite surfaces SQLite constraint failures as ERR_SQLITE_ERROR with the
// underlying SQLite errcode. SQLITE_CONSTRAINT_UNIQUE is 2067.
function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: string }).code === 'ERR_SQLITE_ERROR' &&
    (err as { errcode?: number }).errcode === 2067
  );
}

// A memory is released only once the Timekeeper has marked it unlocked AND
// its release time has actually arrived. Invalid or malformed dates never
// release a memory.
export function isMemoryReleased(unlocked: number | null, unlockAt: string): boolean {
  if (!unlocked) return false;
  const releaseTime = Date.parse(unlockAt);
  if (!Number.isFinite(releaseTime)) return false;
  return releaseTime <= Date.now();
}

export const DAILY_LIMIT_MESSAGE = 'You have already written a memory today. Only one memory is permitted per day.';

export type AddMemoryResult =
  | { success: true; message: string; memoryId: number; unlockAt: string }
  | { success: false; code: 'daily-limit' | 'invalid'; message: string };

export type CreateArchiveV2Result =
  | { ok: true; archiveId: number; createdAt: string; encryptionSalt: string }
  | { ok: false; reason: 'retired' | 'duplicate' };

// Run migration check for memories table columns
try {
  const archiveTableInfo = db.prepare("PRAGMA table_info(archives)").all() as Array<{ name: string }>;
  const archiveColumns = archiveTableInfo.map((c) => c.name);
  if (!archiveColumns.includes('archive_version')) db.exec('ALTER TABLE archives ADD COLUMN archive_version INTEGER DEFAULT 1;');
  if (!archiveColumns.includes('auth_salt')) db.exec('ALTER TABLE archives ADD COLUMN auth_salt TEXT;');
  if (!archiveColumns.includes('auth_lookup_hash')) db.exec('ALTER TABLE archives ADD COLUMN auth_lookup_hash TEXT;');
  if (!archiveColumns.includes('encryption_salt')) db.exec('ALTER TABLE archives ADD COLUMN encryption_salt TEXT;');

  const tableInfo = db.prepare("PRAGMA table_info(memories)").all() as Array<{ name: string }>;
  const colNames = tableInfo.map((c) => c.name);

  if (!colNames.includes('ciphertext')) {
    db.exec('ALTER TABLE memories ADD COLUMN ciphertext TEXT;');
  }
  if (!colNames.includes('encrypted_dek')) {
    db.exec('ALTER TABLE memories ADD COLUMN encrypted_dek TEXT;');
  }
  if (!colNames.includes('nonce')) {
    db.exec('ALTER TABLE memories ADD COLUMN nonce TEXT;');
  }
  if (!colNames.includes('auth_tag')) {
    db.exec('ALTER TABLE memories ADD COLUMN auth_tag TEXT;');
  }
  if (!colNames.includes('encryption_version')) {
    db.exec('ALTER TABLE memories ADD COLUMN encryption_version INTEGER DEFAULT 1;');
  }
  if (!colNames.includes('first_read_at')) {
    db.exec('ALTER TABLE memories ADD COLUMN first_read_at TEXT;');
  }
  if (!colNames.includes('read_count')) {
    db.exec('ALTER TABLE memories ADD COLUMN read_count INTEGER DEFAULT 0;');
  }
  if (!colNames.includes('client_salt')) db.exec('ALTER TABLE memories ADD COLUMN client_salt TEXT;');
  if (!colNames.includes('client_memory_id')) db.exec('ALTER TABLE memories ADD COLUMN client_memory_id TEXT;');
  if (!colNames.includes('timekeeper_secret')) db.exec('ALTER TABLE memories ADD COLUMN timekeeper_secret TEXT;');
  if (!colNames.includes('timekeeper_ciphertext')) db.exec('ALTER TABLE memories ADD COLUMN timekeeper_ciphertext TEXT;');
  if (!colNames.includes('timekeeper_nonce')) db.exec('ALTER TABLE memories ADD COLUMN timekeeper_nonce TEXT;');
  if (!colNames.includes('timekeeper_auth_tag')) db.exec('ALTER TABLE memories ADD COLUMN timekeeper_auth_tag TEXT;');
  if (!colNames.includes('memory_day')) db.exec('ALTER TABLE memories ADD COLUMN memory_day TEXT;');
} catch (e) {
  console.error('Schema check on memories table:', e);
}

// One-memory-per-UTC-day migration. Backfills the denormalised UTC calendar
// day from created_at (ISO-8601 UTC), then fails closed: historical duplicate
// (archive_id, memory_day) pairs, or any failure while backfilling, creating,
// or verifying the unique index, aborts startup. Historical memories are never
// deleted, merged, or rewritten.
export function runMemoryDayMigration(targetDb: DatabaseSync): void {
  targetDb.exec(`
    UPDATE memories
    SET memory_day = substr(created_at, 1, 10)
    WHERE memory_day IS NULL AND created_at IS NOT NULL AND length(created_at) >= 10;
  `);

  const duplicates = targetDb.prepare(`
    SELECT archive_id, memory_day, COUNT(*) AS row_count
    FROM memories
    WHERE memory_day IS NOT NULL
    GROUP BY archive_id, memory_day
    HAVING COUNT(*) > 1
    ORDER BY archive_id, memory_day
  `).all() as Array<{ archive_id: number; memory_day: string; row_count: number }>;

  if (duplicates.length > 0) {
    const details = duplicates
      .map((d) => `archive ${d.archive_id} on UTC day ${d.memory_day} (${d.row_count} memories)`)
      .join('; ');
    throw new Error(
      `Memory archives contain more than one memory for the same UTC day: ${details}. ` +
      'Each archive is limited to one memory per UTC day. ' +
      'Resolve these conflicting memories manually before starting the server. ' +
      'The unique per-day index was NOT created and no memories were deleted, merged, or rewritten.'
    );
  }

  targetDb.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_memories_archive_day
      ON memories(archive_id, memory_day)
      WHERE memory_day IS NOT NULL;
  `);

  const indexList = targetDb.prepare("PRAGMA index_list('memories')").all() as Array<{ name: string; unique: number }>;
  const index = indexList.find((entry) => entry.name === 'idx_memories_archive_day');
  if (!index || index.unique !== 1) {
    throw new Error(
      'The unique per-day index idx_memories_archive_day is missing or is not unique. ' +
      'Startup aborted because the one-memory-per-day guarantee cannot be enforced. ' +
      'No memories were deleted, merged, or rewritten.'
    );
  }
}
runMemoryDayMigration(db);

// Unique active lookup identifier migration. Duplicate non-null lookup hashes
// indicate corrupted or conflicting archives; the server refuses to start
// rather than silently deleting or merging them.
try {
  const duplicateLookup = db.prepare(`
    SELECT auth_lookup_hash
    FROM archives
    WHERE auth_lookup_hash IS NOT NULL
    GROUP BY auth_lookup_hash
    HAVING COUNT(*) > 1
    LIMIT 1
  `).get() as { auth_lookup_hash: string } | undefined;

  if (duplicateLookup) {
    throw new Error(
      `Found duplicate active archive lookup identifier (auth_lookup_hash=${duplicateLookup.auth_lookup_hash}). ` +
      'Duplicate archives must be resolved manually before the unique index can be created. ' +
      'No archives were deleted or merged.'
    );
  }
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_archives_auth_lookup_unique
      ON archives(auth_lookup_hash)
      WHERE auth_lookup_hash IS NOT NULL;
  `);
} catch (e) {
  if (e instanceof Error && e.message.startsWith('Found duplicate active archive lookup identifier')) {
    throw e;
  }
  console.error('Schema check on archives.auth_lookup_hash:', e);
}

// Migrate existing memories to Envelope Encryption
function migrateMemoriesToEnvelopeEncryption() {
  try {
    const unmigrated = db.prepare(`
      SELECT id, encrypted_content
      FROM memories
      WHERE ciphertext IS NULL OR ciphertext = ''
    `).all() as Array<{ id: number; encrypted_content: string }>;

    if (unmigrated.length > 0) {
      const updateStmt = db.prepare(`
        UPDATE memories
        SET ciphertext = ?, encrypted_dek = ?, nonce = ?, auth_tag = ?, encryption_version = 1, encrypted_content = '[ENCRYPTED_E2E]'
        WHERE id = ?
      `);

      for (const row of unmigrated) {
        const textToMigrate = row.encrypted_content || 'Migrated memory content';
        const envelope = encryptMemoryEnvelope(textToMigrate);
        updateStmt.run(
          envelope.ciphertext,
          envelope.encryptedDek,
          envelope.nonce,
          envelope.authTag,
          row.id
        );
      }
    }
  } catch (e) {
    console.error('Error migrating existing memories:', e);
  }
}
migrateMemoriesToEnvelopeEncryption();

export function hashKey(rawKey: string): string {
  return hashMemoryKey(rawKey);
}

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function hashSessionValue(value: string): Buffer {
  return crypto.createHash('sha256').update(value).digest();
}

function valuesMatch(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'hex');
  const rightBuffer = Buffer.from(right, 'hex');
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function createSession(rawKey: string): { sessionToken: string; csrfToken: string; archiveId: number } | null {
  const archive = findArchiveByKey(rawKey);
  if (!archive) return null;

  return createSessionForArchive(archive.id);
}

function createSessionForArchive(archiveId: number): { sessionToken: string; csrfToken: string; archiveId: number } {

  const sessionToken = crypto.randomBytes(32).toString('base64url');
  const csrfToken = crypto.randomBytes(32).toString('base64url');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();

  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now.toISOString());
  db.prepare(`
    INSERT INTO sessions (token_hash, archive_id, csrf_hash, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?)
    `).run(
    hashSessionValue(sessionToken).toString('hex'),
    archiveId,
    hashSessionValue(csrfToken).toString('hex'),
    now.toISOString(),
    expiresAt
  );

  return { sessionToken, csrfToken, archiveId };
}

export function getSession(sessionToken: string): { archiveId: number; csrfHash: string } | null {
  if (!sessionToken) return null;
  const row = db.prepare(`
    SELECT archive_id as archiveId, csrf_hash as csrfHash, expires_at as expiresAt
    FROM sessions WHERE token_hash = ?
  `).get(hashSessionValue(sessionToken).toString('hex')) as { archiveId: number; csrfHash: string; expiresAt: string } | undefined;

  if (!row || new Date(row.expiresAt).getTime() <= Date.now()) {
    if (row) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashSessionValue(sessionToken).toString('hex'));
    return null;
  }

  return row;
}

export function verifySessionCsrf(sessionToken: string, csrfToken: string): boolean {
  const session = getSession(sessionToken);
  return Boolean(session && valuesMatch(session.csrfHash, hashSessionValue(csrfToken).toString('hex')));
}

export function destroySession(sessionToken: string): void {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashSessionValue(sessionToken).toString('hex'));
}

export function destroySessionsForArchive(archiveId: number): void {
  db.prepare('DELETE FROM sessions WHERE archive_id = ?').run(archiveId);
}

// Generate unique Memory Key: 5 random words + 4 digits
export function generateMemoryKey(): string {
  let attempts = 0;
  while (attempts < 100) {
    attempts++;
    const words: string[] = [];
    for (let i = 0; i < 5; i++) {
      const randomIndex = crypto.randomInt(0, WORDLIST.length);
      words.push(WORDLIST[randomIndex]);
    }
    const randomNum = crypto.randomInt(1000, 10000); // 4 digits
    const candidateKey = `${words.join('-')}-${randomNum}`;

    const candidateHash = hashKey(candidateKey);
    const conflict = Boolean(
      db.prepare('SELECT 1 FROM archives WHERE key_hash = ? LIMIT 1').get(candidateHash) ||
      db.prepare('SELECT 1 FROM retired_keys WHERE key_hash = ? LIMIT 1').get(candidateHash)
    );

    if (!conflict) {
      return candidateKey;
    }
  }
  throw new Error('Failed to generate a unique memory key after multiple attempts');
}

// Create Archive
export function createArchive(): { key: string; createdAt: string } {
  const key = generateMemoryKey();
  const keyHash = hashKey(key);
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO archives (key_hash, created_at, last_active_at)
    VALUES (?, ?, ?)
  `);
  stmt.run(keyHash, now, now);

  return { key, createdAt: now };
}

export function createArchiveV2(lookupVerifier: string, authVerifier: string, authSalt: string): CreateArchiveV2Result {
  const now = new Date().toISOString();
  const encryptionSalt = crypto.randomBytes(16).toString('base64url');
  const authVerifierHash = `$v2$${archiveAuthLookup(authVerifier)}`;
  const authLookupHash = `$v2$${archiveAuthLookup(lookupVerifier)}`;

  // Reject retired Recovery Phrases: the raw phrase is never stored, only a
  // non-reversible HMAC lookup identifier recorded at deletion time.
  const retired = db.prepare('SELECT 1 FROM retired_keys WHERE key_hash = ? OR auth_lookup_hash = ? LIMIT 1').get(authVerifierHash, authLookupHash);
  if (retired) return { ok: false, reason: 'retired' };

  // Reject an identifier already held by an active archive. The unique index
  // backstops the concurrent case below.
  const active = db.prepare('SELECT 1 FROM archives WHERE auth_lookup_hash = ? LIMIT 1').get(authLookupHash);
  if (active) return { ok: false, reason: 'duplicate' };

  try {
    const result = db.prepare(`
      INSERT INTO archives (key_hash, auth_lookup_hash, created_at, last_active_at, archive_version, auth_salt, encryption_salt)
      VALUES (?, ?, ?, ?, 2, ?, ?)
    `).run(authVerifierHash, authLookupHash, now, now, authSalt, encryptionSalt);
    return { ok: true, archiveId: Number(result.lastInsertRowid), createdAt: now, encryptionSalt };
  } catch (err) {
    if (isUniqueConstraintError(err)) return { ok: false, reason: 'duplicate' };
    throw err;
  }
}

function findArchiveByAuth(authVerifier: string, authSalt: string) {
  const row = db.prepare(`
    SELECT id, key_hash as keyHash, created_at as createdAt, last_active_at as lastActiveAt,
      archive_version as archiveVersion, auth_salt as authSalt, encryption_salt as encryptionSalt
    FROM archives WHERE key_hash = ? AND auth_salt = ? AND archive_version = 2 LIMIT 1
  `).get(`$v2$${archiveAuthLookup(authVerifier)}`, authSalt) as {
    id: number; keyHash: string; createdAt: string; lastActiveAt: string;
    archiveVersion: number; authSalt: string; encryptionSalt: string;
  } | undefined;
  return row || null;
}

export function getV2AuthSalt(lookupVerifier: string): string {
  const row = db.prepare('SELECT auth_salt as authSalt FROM archives WHERE auth_lookup_hash = ? AND archive_version = 2 LIMIT 1').get(`$v2$${archiveAuthLookup(lookupVerifier)}`) as { authSalt: string } | undefined;
  return row?.authSalt || crypto.randomBytes(16).toString('base64url');
}

export function createSessionV2(authVerifier: string, authSalt: string): { sessionToken: string; csrfToken: string; archiveId: number } | null {
  const archive = findArchiveByAuth(authVerifier, authSalt);
  if (!archive) return null;
  return createSessionForArchive(archive.id);
}

// Get Archive by Key
export function getArchiveByKey(rawKey: string): { id: number; keyHash: string; createdAt: string; lastActiveAt: string; previousLastActiveAt: string | null } | null {
  const archive = findArchiveByKey(rawKey);
  if (!archive) return null;
  const previousLastActiveAt = archive.lastActiveAt || archive.createdAt;
  db.prepare('UPDATE archives SET last_active_at = ? WHERE id = ?').run(new Date().toISOString(), archive.id);
  return { ...archive, previousLastActiveAt };
}

function findArchiveByKey(rawKey: string): { id: number; keyHash: string; createdAt: string; lastActiveAt: string } | null {
  if (!rawKey) return null;
  const keyHash = hashKey(rawKey);
  let row = db.prepare('SELECT id, key_hash as keyHash, created_at as createdAt, last_active_at as lastActiveAt FROM archives WHERE key_hash = ? LIMIT 1').get(keyHash) as { id: number; keyHash: string; createdAt: string; lastActiveAt: string } | undefined;

  // One-time compatibility path for archives created before deterministic
  // scrypt lookup was introduced. Successful legacy access upgrades the row.
  if (!row) {
    const legacyRows = db.prepare("SELECT id, key_hash as keyHash, created_at as createdAt, last_active_at as lastActiveAt FROM archives WHERE key_hash NOT LIKE '$scrypt$%'").all() as Array<{ id: number; keyHash: string; createdAt: string; lastActiveAt: string }>;
    row = legacyRows.find((candidate) => verifyMemoryKey(rawKey, candidate.keyHash));
    if (row) db.prepare('UPDATE archives SET key_hash = ? WHERE id = ?').run(keyHash, row.id);
  }

  if (!row) return null;
  return { ...row, keyHash };
}

// Add Memory
export function addMemory(rawKey: string, text: string): AddMemoryResult {
  const archive = getArchiveByKey(rawKey);
  if (!archive) {
    return { success: false, code: 'invalid', message: 'Invalid Memory Key' };
  }

  return addMemoryToArchive(archive.id, text);
}

export function addMemoryForSession(archiveId: number, text: string): AddMemoryResult {
  return addMemoryToArchive(archiveId, text);
}

export function addEncryptedMemoryForSession(archiveId: number, payload: {
  ciphertext: string;
  nonce: string;
  authTag: string;
  clientSalt: string;
  memoryId: string;
}): AddMemoryResult {
  const archive = getArchiveByIdForSession(archiveId);
  if (!archive || archive.archiveVersion !== 2) return { success: false, code: 'invalid', message: 'V2 archive required.' };

  const invalid = validateV2EncryptedMemory(payload);
  if (invalid) return { success: false, code: 'invalid', message: invalid };

  const now = new Date();
  const dayKey = now.toISOString().slice(0, 10); // UTC calendar day YYYY-MM-DD
  const unlockDate = new Date(now);
  unlockDate.setUTCFullYear(unlockDate.getUTCFullYear() + 1);
  const unlockAt = unlockDate.toISOString();
  const timekeeper = createTimekeeperLayer(
    JSON.stringify(payload),
    buildV2TimekeeperAad(archiveId, payload.memoryId, unlockAt),
  );

  // BEGIN IMMEDIATE takes the SQLite write lock so two simultaneous requests
  // cannot both pass the per-day check; the unique (archive_id, memory_day)
  // index backstops this at the database level.
  db.exec('BEGIN IMMEDIATE');
  try {
    if (db.prepare('SELECT id FROM memories WHERE archive_id = ? AND memory_day = ?').get(archiveId, dayKey)) {
      db.exec('ROLLBACK');
      return { success: false, code: 'daily-limit', message: DAILY_LIMIT_MESSAGE };
    }
    const result = db.prepare(`
      INSERT INTO memories (
        archive_id, encrypted_content, ciphertext, encrypted_dek, nonce, auth_tag,
        encryption_version, client_salt, client_memory_id, timekeeper_secret, timekeeper_ciphertext,
        timekeeper_nonce, timekeeper_auth_tag, created_at, unlock_at, unlocked, memory_day
      ) VALUES (?, ?, ?, NULL, ?, ?, 2, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).run(
      archiveId, '[CLIENT_ENCRYPTED_V2]', payload.ciphertext, payload.nonce, payload.authTag,
      payload.clientSalt, payload.memoryId, timekeeper.secret, timekeeper.ciphertext, timekeeper.nonce,
      timekeeper.authTag, now.toISOString(), unlockAt, dayKey
    );
    db.exec('COMMIT');
    return { success: true, message: 'Memory archived.', memoryId: Number(result.lastInsertRowid), unlockAt };
  } catch (err) {
    db.exec('ROLLBACK');
    if (isUniqueConstraintError(err)) {
      return { success: false, code: 'daily-limit', message: DAILY_LIMIT_MESSAGE };
    }
    throw err;
  }
}

function addMemoryToArchive(archiveId: number, text: string): AddMemoryResult {
  const archive = getArchiveByIdForSession(archiveId);
  if (!archive) return { success: false, code: 'invalid', message: 'Archive session is invalid' };

  const trimmedText = text.trim();
  if (!trimmedText) {
    return { success: false, code: 'invalid', message: 'Memory cannot be empty' };
  }

  if (trimmedText.length > 2000) {
    return { success: false, code: 'invalid', message: 'Memory exceeds 2000 characters limit' };
  }

  const now = new Date();
  const dayKey = now.toISOString().slice(0, 10); // UTC calendar day YYYY-MM-DD
  const createdAtIso = now.toISOString();

  const unlockDate = new Date(now);
  // A memory unlocks on its calendar anniversary, including leap-year dates.
  unlockDate.setUTCFullYear(unlockDate.getUTCFullYear() + 1);
  const unlockAtIso = unlockDate.toISOString();

  // Encrypt memory using Envelope Encryption (DEK + Master Key)
  const envelope = encryptMemoryEnvelope(trimmedText);

  db.exec('BEGIN IMMEDIATE');
  try {
    if (db.prepare('SELECT id FROM memories WHERE archive_id = ? AND memory_day = ?').get(archive.id, dayKey)) {
      db.exec('ROLLBACK');
      return { success: false, code: 'daily-limit', message: DAILY_LIMIT_MESSAGE };
    }
    const insertStmt = db.prepare(`
      INSERT INTO memories (archive_id, encrypted_content, ciphertext, encrypted_dek, nonce, auth_tag, encryption_version, created_at, unlock_at, unlocked, memory_day)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, 0, ?)
    `);
    const result = insertStmt.run(
      archive.id,
      '[ENCRYPTED_E2E]',
      envelope.ciphertext,
      envelope.encryptedDek,
      envelope.nonce,
      envelope.authTag,
      createdAtIso,
      unlockAtIso,
      dayKey
    );
    db.exec('COMMIT');
    return {
      success: true,
      message: 'Memory archived.',
      memoryId: Number(result.lastInsertRowid),
      unlockAt: unlockAtIso
    };
  } catch (err) {
    db.exec('ROLLBACK');
    if (isUniqueConstraintError(err)) {
      return { success: false, code: 'daily-limit', message: DAILY_LIMIT_MESSAGE };
    }
    throw err;
  }
}

function getArchiveByIdForSession(archiveId: number): { id: number; createdAt: string; lastActiveAt: string; previousLastActiveAt: string; archiveVersion: number; encryptionSalt: string | null } | null {
  const row = db.prepare('SELECT id, created_at as createdAt, last_active_at as lastActiveAt, archive_version as archiveVersion, encryption_salt as encryptionSalt FROM archives WHERE id = ?').get(archiveId) as { id: number; createdAt: string; lastActiveAt: string; archiveVersion: number; encryptionSalt: string | null } | undefined;
  if (!row) return null;
  db.prepare('UPDATE archives SET last_active_at = ? WHERE id = ?').run(new Date().toISOString(), archiveId);
  return { ...row, previousLastActiveAt: row.lastActiveAt };
}

type ArchiveDataResponse = {
  archive: { id: number; createdAt: string; lastActiveAt: string; previousLastActiveAt?: string | null; daysSinceLastVisit?: number; archiveVersion?: number; encryptionSalt?: string | null };
  stats: { totalMemories: number; waitingMemories: number; openedMemories: number; awakenedCount?: number; archiveSizeBytes?: number; nextUnlockDate: string | null };
  hasWrittenToday: boolean;
  memories: Array<{
    id: number;
    createdAt: string;
    unlockAt: string;
    unlocked: boolean;
    content?: string;
    encryptionVersion?: number;
    memoryId?: string;
    clientSalt?: string;
    unlockMaterial?: { secret: string; ciphertext: string; nonce: string; authTag: string };
  }>;
};

export function getMemoriesForArchiveSession(archiveId: number): ArchiveDataResponse | null {
  return getMemoriesForArchiveId(archiveId);
}

function getMemoriesForArchiveId(archiveId: number): ArchiveDataResponse | null {
  const archive = getArchiveByIdForSession(archiveId);
  if (!archive) return null;

  const stmt = db.prepare(`
    SELECT id, encrypted_content as encryptedContent, ciphertext, encrypted_dek as encryptedDek, nonce, auth_tag as authTag, encryption_version as encryptionVersion, client_salt as clientSalt, client_memory_id as clientMemoryId, timekeeper_secret as timekeeperSecret, timekeeper_ciphertext as timekeeperCiphertext, timekeeper_nonce as timekeeperNonce, timekeeper_auth_tag as timekeeperAuthTag, created_at as createdAt, unlock_at as unlockAt, unlocked, first_read_at as firstReadAt, read_count as readCount
    FROM memories
    WHERE archive_id = ?
    ORDER BY created_at DESC
  `);
  const rows = stmt.all(archive.id) as Array<{
    id: number;
    encryptedContent: string;
    ciphertext: string | null;
    encryptedDek: string | null;
    nonce: string | null;
    authTag: string | null;
    encryptionVersion: number | null;
    createdAt: string;
    unlockAt: string;
    unlocked: number;
    firstReadAt: string | null;
    readCount: number | null;
    clientSalt: string | null;
    clientMemoryId: string | null;
    timekeeperSecret: string | null;
    timekeeperCiphertext: string | null;
    timekeeperNonce: string | null;
    timekeeperAuthTag: string | null;
  }>;

  const archiveSizeBytes = rows.reduce((total, row) => {
    return total + [row.ciphertext, row.encryptedDek, row.nonce, row.authTag]
      .filter(Boolean)
      .reduce((size, value) => size + Buffer.byteLength(value as string), 0);
  }, 0);

  const todayPrefix = new Date().toISOString().slice(0, 10);
  let hasWrittenToday = false;
  let waitingCount = 0;
  let openedCount = 0;
  let nextUnlockDate: string | null = null;

  const processedMemories = rows.map((row) => {
    // A memory is only released when the Timekeeper has marked it unlocked
    // AND its release time has actually arrived. This prevents a memory that
    // was flagged unlocked but whose unlock_at is still in the future from
    // ever leaking its content or Timekeeper material.
    const isUnlocked = isMemoryReleased(row.unlocked, row.unlockAt);
    if (row.createdAt.startsWith(todayPrefix)) {
      hasWrittenToday = true;
    }

    if (isUnlocked) {
      openedCount++;
      if (row.encryptionVersion === 2) {
        return {
          id: row.id,
          createdAt: row.createdAt,
          unlockAt: row.unlockAt,
          unlocked: true,
          encryptionVersion: 2,
          memoryId: row.clientMemoryId || undefined,
          unlockMaterial: row.timekeeperSecret && row.timekeeperCiphertext && row.timekeeperNonce && row.timekeeperAuthTag
            ? { secret: row.timekeeperSecret, ciphertext: row.timekeeperCiphertext, nonce: row.timekeeperNonce, authTag: row.timekeeperAuthTag }
            : undefined,
          firstReadAt: row.firstReadAt || null,
          readCount: row.readCount || 0
        };
      }

      let decrypted = '[Unable to decrypt memory contents]';

      if (row.ciphertext && row.encryptedDek && row.nonce && row.authTag) {
        decrypted = decryptMemoryEnvelope({
          ciphertext: row.ciphertext,
          encryptedDek: row.encryptedDek,
          nonce: row.nonce,
          authTag: row.authTag,
          encryptionVersion: row.encryptionVersion || 1,
        });
      }

      return {
        id: row.id,
        createdAt: row.createdAt,
        unlockAt: row.unlockAt,
        unlocked: true,
        encryptionVersion: row.encryptionVersion || 1,
        memoryId: row.clientMemoryId || undefined,
        content: decrypted,
        firstReadAt: row.firstReadAt || null,
        readCount: row.readCount || 0
      };
    } else {
      waitingCount++;
      if (!nextUnlockDate || row.unlockAt < nextUnlockDate) {
        nextUnlockDate = row.unlockAt;
      }
      return {
        id: row.id,
        createdAt: row.createdAt,
        unlockAt: row.unlockAt,
        unlocked: false,
        encryptionVersion: row.encryptionVersion || 1,
        memoryId: row.clientMemoryId || undefined,
        clientSalt: row.clientSalt || undefined,
        firstReadAt: row.firstReadAt || null,
        readCount: row.readCount || 0
      };
    }
  });

  const prevDate = archive.previousLastActiveAt ? new Date(archive.previousLastActiveAt) : new Date(archive.createdAt);
  const nowMs = new Date().getTime();
  const diffDays = Math.max(0, Math.floor((nowMs - prevDate.getTime()) / (1000 * 60 * 60 * 24)));

  return {
    archive: {
      id: archive.id,
      createdAt: archive.createdAt,
      lastActiveAt: archive.lastActiveAt,
      previousLastActiveAt: archive.previousLastActiveAt,
      daysSinceLastVisit: diffDays,
      archiveVersion: archive.archiveVersion,
      encryptionSalt: archive.encryptionSalt
    },
    stats: {
      totalMemories: rows.length,
      waitingMemories: waitingCount,
      openedMemories: openedCount,
      awakenedCount: openedCount,
      nextUnlockDate,
      archiveSizeBytes
    },
    hasWrittenToday,
    memories: processedMemories
  };
}

// Mark Memory Read
export type MarkMemoryReadResult =
  | { success: true; firstReadAt: string; readCount: number }
  | { success: false; error: string };

export function markMemoryRead(rawKey: string, memoryId: number): MarkMemoryReadResult | null {
  const archive = getArchiveByKey(rawKey);
  if (!archive) return null;

  return markMemoryReadForArchive(archive.id, memoryId);
}

export function markMemoryReadForSession(archiveId: number, memoryId: number): MarkMemoryReadResult | null {
  return markMemoryReadForArchive(archiveId, memoryId);
}

function markMemoryReadForArchive(archiveId: number, memoryId: number): MarkMemoryReadResult | null {
  if (!Number.isSafeInteger(memoryId) || memoryId <= 0) return null;

  const memoryRow = db.prepare(`
    SELECT id, unlocked, unlock_at as unlockAt, first_read_at as firstReadAt, read_count as readCount
    FROM memories WHERE id = ? AND archive_id = ?
  `).get(memoryId, archiveId) as { id: number; unlocked: number; unlockAt: string; firstReadAt: string | null; readCount: number | null } | undefined;

  if (!memoryRow) return null;

  // A memory may only be marked as read once it has been released by the
  // Timekeeper (unlocked = 1) and its unlock time has actually arrived.
  // Invalid or malformed dates never count as released.
  if (!memoryRow.unlocked) {
    return { success: false, error: 'This memory is still sealed and cannot be read yet.' };
  }
  if (!isMemoryReleased(memoryRow.unlocked, memoryRow.unlockAt)) {
    return { success: false, error: 'This memory has not reached its release time yet.' };
  }

  const nowIso = new Date().toISOString();
  const firstReadAt = memoryRow.firstReadAt || nowIso;
  const newReadCount = (memoryRow.readCount || 0) + 1;

  const updateStmt = db.prepare(`
    UPDATE memories
    SET first_read_at = ?, read_count = ?
    WHERE id = ? AND archive_id = ?
  `);
  updateStmt.run(firstReadAt, newReadCount, memoryId, archiveId);

  return {
    success: true,
    firstReadAt,
    readCount: newReadCount
  };
}

// Delete Archive
export function deleteArchive(rawKey: string): boolean {
  const keyHash = hashKey(rawKey);
  const archive = getArchiveByKey(rawKey);
  if (!archive) return false;

  const row = db.prepare('SELECT auth_lookup_hash as authLookupHash FROM archives WHERE id = ?').get(archive.id) as { authLookupHash: string | null } | undefined;

  db.exec('BEGIN TRANSACTION;');
  try {
    // Delete memories
    const deleteMemoriesStmt = db.prepare('DELETE FROM memories WHERE archive_id = ?');
    deleteMemoriesStmt.run(archive.id);

    // Delete archive
    const deleteArchiveStmt = db.prepare('DELETE FROM archives WHERE id = ?');
    deleteArchiveStmt.run(archive.id);

    // Retire key permanently. Only non-reversible hashes are stored; the raw
    // Recovery Phrase is never written or logged.
    const retireStmt = db.prepare('INSERT OR REPLACE INTO retired_keys (key_hash, retired_at, auth_lookup_hash) VALUES (?, ?, ?)');
    retireStmt.run(keyHash, new Date().toISOString(), row?.authLookupHash || null);

    db.exec('COMMIT;');
    return true;
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

export function deleteArchiveById(archiveId: number): boolean {
  const archive = db.prepare('SELECT id, key_hash as keyHash, auth_lookup_hash as authLookupHash FROM archives WHERE id = ?').get(archiveId) as { id: number; keyHash: string; authLookupHash: string | null } | undefined;
  if (!archive) return false;

  db.exec('BEGIN TRANSACTION;');
  try {
    db.prepare('DELETE FROM sessions WHERE archive_id = ?').run(archiveId);
    db.prepare('DELETE FROM memories WHERE archive_id = ?').run(archiveId);
    db.prepare('DELETE FROM archives WHERE id = ?').run(archiveId);
    db.prepare('INSERT OR REPLACE INTO retired_keys (key_hash, retired_at, auth_lookup_hash) VALUES (?, ?, ?)').run(archive.keyHash, new Date().toISOString(), archive.authLookupHash);
    db.exec('COMMIT;');
    return true;
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

// Timekeeper process
export function runTimekeeperProcess(): { unlockedCount: number; runAt: string } {
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    UPDATE memories
    SET unlocked = 1
    WHERE unlock_at <= ? AND unlocked = 0
  `);
  const result = stmt.run(now);
  const unlockedCount = Number(result.changes);

  // Log in timekeeper_logs
  const logStmt = db.prepare(`
    INSERT INTO timekeeper_logs (run_at, unlocked_count, details)
    VALUES (?, ?, ?)
  `);
  logStmt.run(now, unlockedCount, `Midnight Timekeeper executed. Unlocked ${unlockedCount} memories.`);

  return { unlockedCount, runAt: now };
}

// Public Anonymous Statistics
export function getPublicStats(): {
  archivesOpened: number;
  sleepingMemories: number;
  unlockedToday: number;
  oldestArchiveDate: string | null;
} {
  const totalArchivesRow = db.prepare('SELECT COUNT(*) as cnt FROM archives').get() as { cnt: number };
  const sleepingRow = db.prepare('SELECT COUNT(*) as cnt FROM memories WHERE unlocked = 0').get() as { cnt: number };

  const todayPrefix = new Date().toISOString().slice(0, 10);
  const unlockedTodayRow = db.prepare(`
    SELECT COUNT(*) as cnt FROM memories
    WHERE unlocked = 1 AND unlock_at LIKE ?
  `).get(`${todayPrefix}%`) as { cnt: number };

  const oldestArchiveRow = db.prepare('SELECT MIN(created_at) as oldest FROM archives').get() as { oldest: string | null };

  return {
    archivesOpened: totalArchivesRow.cnt || 0,
    sleepingMemories: sleepingRow.cnt || 0,
    unlockedToday: unlockedTodayRow.cnt || 0,
    oldestArchiveDate: oldestArchiveRow.oldest || null
  };
}

// Machine Page Metrics
export function getMachineMetrics(): {
  loadAverage: number;
  ramUsedMb: number;
  ramTotalMb: number;
  diskUsedGb: number;
  diskTotalGb: number;
  tempCelsius: number | null;
  uptimeSeconds: number;
  uptimeFormatted: string;
  dbSizeBytes: number;
  dbSizeFormatted: string;
  archivesCount: number;
  memoriesCount: number;
  sleepingMemories: number;
  unlockedToday: number;
  oldestMemoryDate: string | null;
  newestMemoryDate: string | null;
  lastAwakeningDate: string | null;
  machineSince: string | null;
} {
  let dbSizeBytes = 0;
  for (const file of [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`]) {
    try {
      if (fs.existsSync(file)) {
        dbSizeBytes += fs.statSync(file).size;
      }
    } catch (e) {
      // Continue with the files that can be read.
    }
  }

  const archivesCountRow = db.prepare('SELECT COUNT(*) as cnt FROM archives').get() as { cnt: number };
  const memoriesCountRow = db.prepare('SELECT COUNT(*) as cnt FROM memories').get() as { cnt: number };
  const sleepingMemoriesRow = db.prepare('SELECT COUNT(*) as cnt FROM memories WHERE unlocked = 0').get() as { cnt: number };
  const memoryDates = db.prepare('SELECT MIN(created_at) as oldest, MAX(created_at) as newest FROM memories').get() as { oldest: string | null; newest: string | null };
  const lastAwakeningRow = db.prepare('SELECT MAX(unlock_at) as latest FROM memories WHERE unlocked = 1').get() as { latest: string | null };
  const machineSinceRow = db.prepare('SELECT MIN(created_at) as oldest FROM archives').get() as { oldest: string | null };
  const todayPrefix = new Date().toISOString().slice(0, 10);
  const unlockedTodayRow = db.prepare('SELECT COUNT(*) as cnt FROM memories WHERE unlocked = 1 AND unlock_at LIKE ?').get(`${todayPrefix}%`) as { cnt: number };

  const systemUptime = os.uptime();
  const uptimeDays = Math.floor(systemUptime / 86400);
  const uptimeHours = Math.floor((systemUptime % 86400) / 3600);
  const uptimeMins = Math.floor((systemUptime % 3600) / 60);
  const uptimeFormatted = `${uptimeDays}d ${uptimeHours}h ${uptimeMins}m`;

  const dbSizeFormatted = dbSizeBytes > 1024 * 1024
    ? `${(dbSizeBytes / (1024 * 1024)).toFixed(2)} MB`
    : `${(dbSizeBytes / 1024).toFixed(1)} KB`;

  const loadAverage = os.loadavg()[0];
  const ramTotalMb = Math.round(os.totalmem() / (1024 * 1024));
  const ramUsedMb = Math.round((os.totalmem() - os.freemem()) / (1024 * 1024));

  let diskTotalGb = 0;
  let diskUsedGb = 0;
  try {
    const disk = fs.statfsSync(process.cwd());
    diskTotalGb = Number(((disk.blocks * disk.bsize) / (1024 ** 3)).toFixed(2));
    diskUsedGb = Number((((disk.blocks - disk.bfree) * disk.bsize) / (1024 ** 3)).toFixed(2));
  } catch (e) {
    // Leave disk values at zero when filesystem stats are unavailable.
  }

  let tempCelsius: number | null = null;
  try {
    const thermalZones = fs.readdirSync('/sys/class/thermal').filter((name) => name.startsWith('thermal_zone'));
    for (const zone of thermalZones) {
      const rawTemp = Number(fs.readFileSync(`/sys/class/thermal/${zone}/temp`, 'utf8').trim());
      if (Number.isFinite(rawTemp)) {
        tempCelsius = Number((rawTemp / 1000).toFixed(1));
        break;
      }
    }
  } catch (e) {
    // Temperature is unavailable when thermal zone access is not exposed.
  }

  return {
    loadAverage,
    ramUsedMb,
    ramTotalMb,
    diskUsedGb,
    diskTotalGb,
    tempCelsius,
    uptimeSeconds: Math.floor(systemUptime),
    uptimeFormatted,
    dbSizeBytes,
    dbSizeFormatted,
    archivesCount: archivesCountRow.cnt || 0,
    memoriesCount: memoriesCountRow.cnt || 0,
    sleepingMemories: sleepingMemoriesRow.cnt || 0,
    unlockedToday: unlockedTodayRow.cnt || 0,
    oldestMemoryDate: memoryDates.oldest,
    newestMemoryDate: memoryDates.newest,
    lastAwakeningDate: lastAwakeningRow.latest,
    machineSince: machineSinceRow.oldest
  };
}
