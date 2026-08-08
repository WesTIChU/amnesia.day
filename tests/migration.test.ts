import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// The one-memory-per-UTC-day migration must fail closed: a legacy database that
// already holds two memories for the same archive and UTC day must refuse to
// start, and neither historical memory may be deleted, merged, or rewritten.
// Startup runs the migrations at module load, so we exercise it in a child
// process against an isolated legacy database and then verify row integrity.

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'amnesia-migration-test-'));
const dbPath = path.join(tmpDir, 'legacy.db');
const masterKeyPath = path.join(tmpDir, 'master.key');

const CONTENT_COLUMNS =
  'id, archive_id, encrypted_content, ciphertext, encrypted_dek, nonce, auth_tag, encryption_version, created_at, unlock_at, unlocked';

// Pre-migration schema: memories has NO memory_day column.
function seedLegacyDatabase(createdAts: [string, string]): Array<Record<string, unknown>> {
  const seed = new DatabaseSync(dbPath);
  seed.exec(`
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
    INSERT OR REPLACE INTO archives (id, key_hash, created_at, last_active_at)
    VALUES (1, 'legacy-key-hash', '2025-06-01T00:00:00.000Z', '2025-06-01T00:00:00.000Z');
    DELETE FROM memories;
  `);
  const insert = seed.prepare(`
    INSERT INTO memories (archive_id, encrypted_content, ciphertext, encrypted_dek, nonce, auth_tag, encryption_version, created_at, unlock_at, unlocked)
    VALUES (1, ?, ?, ?, ?, ?, 1, ?, ?, 0)
  `);
  insert.run('first-memory-secret', 'ct-1', 'dek-1', 'nonce-1', 'tag-1', createdAts[0], '2025-06-02T00:00:00.000Z');
  insert.run('second-memory-secret', 'ct-2', 'dek-2', 'nonce-2', 'tag-2', createdAts[1], '2025-06-03T00:00:00.000Z');
  const rows = seed.prepare(`SELECT ${CONTENT_COLUMNS} FROM memories ORDER BY id`).all();
  seed.close();
  return rows as Array<Record<string, unknown>>;
}

// Start the server modules (which run the migrations on import) in a child
// process against the seeded legacy database. Resolves with exit code and output.
function runStartup(): Promise<{ code: number; stdout: string; stderr: string }> {
  const dbModule = fileURLToPath(new URL('../server/db.ts', import.meta.url));
  const script = [
    `import(${JSON.stringify(dbModule)})`,
    `.then(() => process.exit(0))`,
    `.catch((e) => { console.error(e instanceof Error ? e.message : String(e)); process.exit(1); })`,
  ].join('');
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      ['--import', 'tsx', '--eval', script],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          KEY_PEPPER: 'test-only-pepper',
          AMNESIA_DB_PATH: dbPath,
          MASTER_KEY_PATH: masterKeyPath,
          AMNESIA_DATA_DIR: tmpDir,
          NODE_ENV: 'test',
        },
        timeout: 30000,
      },
      (error, stdout, stderr) => {
        if (error && typeof (error as { code?: unknown }).code !== 'number') {
          reject(error);
          return;
        }
        resolve({
          code: error ? ((error as { code?: number }).code ?? 1) : 0,
          stdout,
          stderr,
        });
      },
    );
  });
}

before(() => {
  fs.rmSync(dbPath, { force: true });
});

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('startup fails closed when two historical memories share an archive and UTC day', async () => {
  const seeded = seedLegacyDatabase(['2025-06-01T10:00:00.000Z', '2025-06-01T22:30:00.000Z']);

  const { code, stderr } = await runStartup();
  assert.equal(code, 1, 'the server must refuse to start');
  assert.match(stderr, /more than one memory for the same UTC day/i, 'error must explain the conflict');
  assert.match(stderr, /archive 1 on UTC day 2025-06-01 \(2 memories\)/i, 'error must name the conflicting archive and day');
  assert.match(stderr, /no memories were deleted, merged, or rewritten/i, 'error must state no data was altered');

  const check = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const rows = check.prepare(`SELECT ${CONTENT_COLUMNS} FROM memories ORDER BY id`).all();
    assert.equal(rows.length, 2, 'neither historical memory may be deleted');
    assert.deepEqual(rows, seeded, 'historical memory rows must be untouched');
  } finally {
    check.close();
  }
});

test('startup succeeds on a clean legacy database and creates a verified unique per-day index', async () => {
  seedLegacyDatabase(['2025-06-01T10:00:00.000Z', '2025-06-02T10:00:00.000Z']);

  const { code, stdout, stderr } = await runStartup();
  assert.equal(code, 0, `startup should succeed, got stderr: ${stderr}`);

  const check = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const rows = check.prepare(`SELECT ${CONTENT_COLUMNS}, memory_day AS memoryDay FROM memories ORDER BY id`).all() as Array<{ memoryDay: string | null }>;
    assert.deepEqual(
      rows.map((r) => r.memoryDay),
      ['2025-06-01', '2025-06-02'],
      'memory_day must be backfilled from created_at (UTC)',
    );

    const indexList = check.prepare("PRAGMA index_list('memories')").all() as Array<{ name: string; unique: number }>;
    const index = indexList.find((entry) => entry.name === 'idx_memories_archive_day');
    assert.ok(index, 'idx_memories_archive_day must exist after migration');
    assert.equal(index.unique, 1, 'idx_memories_archive_day must be unique');
  } finally {
    check.close();
  }
});
