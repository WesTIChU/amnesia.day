import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Master Key file location determination
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function resolveMasterKeyPath(): string {
  if (process.env.MASTER_KEY_PATH) {
    return process.env.MASTER_KEY_PATH;
  }
  const systemDir = '/etc/amnesia';
  try {
    if (!fs.existsSync(systemDir)) {
      fs.mkdirSync(systemDir, { recursive: true });
    }
    return path.join(systemDir, 'master.key');
  } catch {
    return path.join(DATA_DIR, 'master.key');
  }
}

const MASTER_KEY_PATH = resolveMasterKeyPath();
let cachedMasterKey: Buffer | null = null;

export function getMasterKey(): Buffer {
  if (cachedMasterKey) {
    return cachedMasterKey;
  }

  if (fs.existsSync(MASTER_KEY_PATH)) {
    const raw = fs.readFileSync(MASTER_KEY_PATH);
    if (raw.length === 32) {
      cachedMasterKey = raw;
      return cachedMasterKey;
    } else if (raw.length === 64) {
      cachedMasterKey = Buffer.from(raw.toString('utf8').trim(), 'hex');
      return cachedMasterKey;
    }
  }

  const newKey = crypto.randomBytes(32);
  try {
    fs.writeFileSync(MASTER_KEY_PATH, newKey, { mode: 0o600 });
    fs.chmodSync(MASTER_KEY_PATH, 0o600);
  } catch {
    // Fallback to DATA_DIR if primary path writing failed
    const fallbackPath = path.join(DATA_DIR, 'master.key');
    fs.writeFileSync(fallbackPath, newKey, { mode: 0o600 });
    try {
      fs.chmodSync(fallbackPath, 0o600);
    } catch {
      // chmod on the fallback path is best-effort; the key file is still written.
    }
  }

  cachedMasterKey = newKey;
  return cachedMasterKey;
}

// Key Hashing Configuration
const PEPPER = process.env.KEY_PEPPER;
if (!PEPPER) {
  throw new Error('KEY_PEPPER is required.');
}
const LEGACY_PEPPER = process.env.LEGACY_KEY_PEPPER;

export function archiveAuthLookup(authVerifier: string): string {
  return crypto.createHmac('sha256', PEPPER).update(authVerifier).digest('hex');
}

export function createTimekeeperLayer(innerPackage: string, additionalData: string): {
  secret: string;
  ciphertext: string;
  nonce: string;
  authTag: string;
} {
  const secret = crypto.randomBytes(32);
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', secret, nonce);
  cipher.setAAD(Buffer.from(additionalData, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(innerPackage, 'utf8'), cipher.final()]).toString('base64');
  return {
    secret: secret.toString('base64'),
    ciphertext,
    nonce: nonce.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
  };
}

export const buildV2TimekeeperAad = (archiveId: number, memoryId: string, unlockAt: string) =>
  `amnesia/timekeeper/v2|archive=${archiveId}|memory=${memoryId}|unlock=${unlockAt}|version=2`;

export function hashMemoryKey(rawKey: string): string {
  const normalized = rawKey.trim().toLowerCase();
  const salt = crypto.createHash('sha256').update(PEPPER).digest();
  const derived = crypto.scryptSync(normalized, salt, 32, { N: 16384, r: 8, p: 1 });
  return `$scrypt$${derived.toString('hex')}`;
}

export function verifyMemoryKey(rawKey: string, storedHash: string): boolean {
  if (!rawKey || !storedHash) return false;
  const normalized = rawKey.trim().toLowerCase();

  return [PEPPER, LEGACY_PEPPER].filter((pepper): pepper is string => Boolean(pepper)).some((pepper) => verifyWithPepper(normalized, storedHash, pepper));
}

function verifyWithPepper(normalized: string, storedHash: string, pepper: string): boolean {

  if (storedHash.startsWith('$scrypt$')) {
    const expectedDerivedHex = storedHash.replace('$scrypt$', '');
    const salt = crypto.createHash('sha256').update(pepper).digest();
    const actualDerived = crypto.scryptSync(normalized, salt, 32, { N: 16384, r: 8, p: 1 });
    const actualDerivedHex = actualDerived.toString('hex');

    if (expectedDerivedHex.length !== actualDerivedHex.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expectedDerivedHex, 'hex'), Buffer.from(actualDerivedHex, 'hex'));
  }

  // Legacy SHA-256 fallback verification
  const legacyHash = crypto.createHash('sha256').update(normalized + pepper).digest('hex');
  if (legacyHash.length !== storedHash.length) return false;
  return crypto.timingSafeEqual(Buffer.from(legacyHash, 'hex'), Buffer.from(storedHash, 'hex'));
}

export interface EncryptedEnvelope {
  ciphertext: string;
  encryptedDek: string;
  nonce: string;
  authTag: string;
  encryptionVersion: number;
}

/**
 * Envelope Encryption:
 * 1. Generates a random 256-bit DEK (Data Encryption Key).
 * 2. Encrypts plaintext memory content with DEK (AES-256-GCM).
 * 3. Encrypts DEK with Master Key (AES-256-GCM).
 * 4. Returns ciphertext, encrypted DEK, nonces, auth tags, and version.
 */
export function encryptMemoryEnvelope(plaintext: string): EncryptedEnvelope {
  const dek = crypto.randomBytes(32);
  const masterKey = getMasterKey();

  const contentIv = crypto.randomBytes(12);
  const contentCipher = crypto.createCipheriv('aes-256-gcm', dek, contentIv);
  let ciphertext = contentCipher.update(plaintext, 'utf8', 'hex');
  ciphertext += contentCipher.final('hex');
  const contentAuthTag = contentCipher.getAuthTag();

  const dekIv = crypto.randomBytes(12);
  const dekCipher = crypto.createCipheriv('aes-256-gcm', masterKey, dekIv);
  let encryptedDekHex = dekCipher.update(dek, null, 'hex');
  encryptedDekHex += dekCipher.final('hex');
  const dekAuthTag = dekCipher.getAuthTag();

  return {
    ciphertext,
    encryptedDek: `${dekIv.toString('hex')}:${dekAuthTag.toString('hex')}:${encryptedDekHex}`,
    nonce: contentIv.toString('hex'),
    authTag: contentAuthTag.toString('hex'),
    encryptionVersion: 1,
  };
}

/**
 * Decrypts a memory envelope:
 * 1. Decrypts DEK using Master Key.
 * 2. Decrypts memory content using DEK.
 * Never logs or caches plaintext or keys.
 */
export function decryptMemoryEnvelope(envelope: EncryptedEnvelope): string {
  try {
    const masterKey = getMasterKey();
    const [dekIvHex, dekAuthTagHex, encryptedDekHex] = envelope.encryptedDek.split(':');
    if (!dekIvHex || !dekAuthTagHex || !encryptedDekHex) {
      throw new Error('Invalid encrypted DEK structure');
    }

    const dekIv = Buffer.from(dekIvHex, 'hex');
    const dekAuthTag = Buffer.from(dekAuthTagHex, 'hex');
    const dekDecipher = crypto.createDecipheriv('aes-256-gcm', masterKey, dekIv);
    dekDecipher.setAuthTag(dekAuthTag);
    const dek = Buffer.concat([
      dekDecipher.update(Buffer.from(encryptedDekHex, 'hex')),
      dekDecipher.final(),
    ]);

    const contentIv = Buffer.from(envelope.nonce, 'hex');
    const contentAuthTag = Buffer.from(envelope.authTag, 'hex');
    const contentDecipher = crypto.createDecipheriv('aes-256-gcm', dek, contentIv);
    contentDecipher.setAuthTag(contentAuthTag);
    let plaintext = contentDecipher.update(envelope.ciphertext, 'hex', 'utf8');
    plaintext += contentDecipher.final('utf8');

    return plaintext;
  } catch (err) {
    return '[Unable to decrypt memory contents]';
  }
}

export function runEncryptionSelfTest(): boolean {
  try {
    const secret = 'Amnesia E2E Envelope Encryption Verification Test String 2026';
    const envelope = encryptMemoryEnvelope(secret);
    const decrypted = decryptMemoryEnvelope(envelope);
    if (decrypted !== secret) {
      throw new Error('Encryption self-test failed: Mismatch decrypted result');
    }
    return true;
  } catch (err) {
    console.error('Crypto self-test failed:', err);
    return false;
  }
}

runEncryptionSelfTest();
