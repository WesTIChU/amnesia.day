import { WORDLIST } from '../../server/wordlist';

const PBKDF2_ITERATIONS = 600_000;
const textEncoder = new TextEncoder();
const AUTH_SALT = textEncoder.encode('amnesia/archive-auth-salt/v2');
const baseSecretCache = new Map<string, Uint8Array>();

const bytesToBase64Url = (bytes: Uint8Array) => {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const base64UrlToBytes = (value: string) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  const binary = atob(normalized);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const randomBytes = (length: number) => crypto.getRandomValues(new Uint8Array(length));
const randomInt = (max: number) => {
  if (!Number.isSafeInteger(max) || max <= 0 || max > 0x100000000) throw new Error('Invalid randomInt bound');
  const limit = 0x100000000 - (0x100000000 % max);
  const value = new Uint32Array(1);
  do crypto.getRandomValues(value); while (value[0] >= limit);
  return value[0] % max;
};

const derivePasswordBits = async (secret: string, salt: Uint8Array) => {
  const cacheInput = new Uint8Array(textEncoder.encode(secret).length + salt.length);
  cacheInput.set(textEncoder.encode(secret));
  cacheInput.set(salt, textEncoder.encode(secret).length);
  const cacheKey = bytesToBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', cacheInput)));
  const cached = baseSecretCache.get(cacheKey);
  if (cached) return cached.slice();
  const password = await crypto.subtle.importKey('raw', textEncoder.encode(secret), 'PBKDF2', false, ['deriveBits']);
  const derived = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    password,
    256,
  ));
  baseSecretCache.set(cacheKey, derived.slice());
  return derived;
};

export function clearV2KeyCache(): void {
  for (const secret of baseSecretCache.values()) secret.fill(0);
  baseSecretCache.clear();
}

const deriveHkdfBits = async (secret: Uint8Array, salt: Uint8Array, info: string) => {
  const key = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: textEncoder.encode(info) },
    key,
    256,
  ));
};

const deriveAesKey = async (secret: Uint8Array, salt: Uint8Array, info: string) =>
  crypto.subtle.importKey('raw', await deriveHkdfBits(secret, salt, info), 'AES-GCM', false, ['encrypt', 'decrypt']);

export function createV2MemoryKey(): { key: string; authSalt: string } {
  const words = Array.from({ length: 5 }, () => WORDLIST[randomInt(WORDLIST.length)]);
  const number = 1000 + randomInt(9000);
  return { key: `${words.join('-')}-${number}`, authSalt: bytesToBase64Url(randomBytes(16)) };
}

function parseV2MemoryKey(key: string): { secret: string; authSalt: Uint8Array } {
  const parts = key.trim().split('-');
  // Compatibility for V2 phrases that use the fixed lookup salt and carry
  // their random authentication salt as separate public metadata.
  if (parts.length === 6) return { secret: parts.join('-'), authSalt: AUTH_SALT };
  if (parts.length < 7) throw new Error('Invalid V2 Memory Key');
  const authSaltText = parts.slice(6).join('-');
  const authSalt = base64UrlToBytes(authSaltText);
  if (authSalt.length !== 16) throw new Error('Invalid V2 Memory Key salt');
  return { secret: parts.slice(0, 6).join('-'), authSalt };
}

export async function deriveV2AuthVerifier(key: string, authSaltOverride?: string): Promise<{ authVerifier: string; authSalt: string }> {
  const parsed = parseV2MemoryKey(key);
  const authSalt = authSaltOverride ? base64UrlToBytes(authSaltOverride) : parsed.authSalt;
  if (authSalt.length !== 16) throw new Error('Invalid V2 authentication salt');
  const base = await derivePasswordBits(parsed.secret, authSalt);
  const verifier = await deriveHkdfBits(base, authSalt, 'amnesia/archive-auth/v2');
  return { authVerifier: bytesToBase64Url(verifier), authSalt: bytesToBase64Url(authSalt) };
}

export async function deriveV2LookupVerifier(key: string): Promise<string> {
  const parsed = parseV2MemoryKey(key);
  const base = await derivePasswordBits(parsed.secret, AUTH_SALT);
  const lookup = await deriveHkdfBits(base, AUTH_SALT, 'amnesia/archive-lookup/v2');
  return bytesToBase64Url(lookup);
}

export async function encryptV2Memory(key: string, archiveSalt: string, plaintext: string, archiveId: number) {
  const parsed = parseV2MemoryKey(key);
  const archiveSaltBytes = base64UrlToBytes(archiveSalt);
  if (archiveSaltBytes.length !== 16) throw new Error('Invalid V2 archive encryption salt');
  const memorySalt = randomBytes(16);
  const memoryId = crypto.randomUUID();
  const base = await derivePasswordBits(parsed.secret, archiveSaltBytes);
  const aesKey = await deriveAesKey(base, memorySalt, 'amnesia/memory-content/v2');
  const nonce = randomBytes(12);
  const aad = textEncoder.encode(buildV2InnerAad(archiveId, memoryId, bytesToBase64Url(memorySalt)));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, additionalData: aad }, aesKey, textEncoder.encode(plaintext)));
  return {
    ciphertext: bytesToBase64Url(encrypted.slice(0, -16)),
    nonce: bytesToBase64Url(nonce),
    authTag: bytesToBase64Url(encrypted.slice(-16)),
    clientSalt: bytesToBase64Url(memorySalt),
    memoryId,
  };
}

export async function decryptV2Memory(key: string, archiveSalt: string, memory: {
  ciphertext: string;
  nonce: string;
  authTag: string;
  clientSalt: string;
  memoryId: string;
}, archiveId: number) {
  const parsed = parseV2MemoryKey(key);
  const archiveSaltBytes = base64UrlToBytes(archiveSalt);
  if (archiveSaltBytes.length !== 16) throw new Error('Invalid V2 archive encryption salt');
  const clientSaltBytes = base64UrlToBytes(memory.clientSalt);
  const nonceBytes = base64UrlToBytes(memory.nonce);
  const tag = base64UrlToBytes(memory.authTag);
  if (clientSaltBytes.length !== 16) throw new Error('Invalid V2 client salt');
  if (nonceBytes.length !== 12) throw new Error('Invalid V2 memory nonce');
  if (tag.length !== 16) throw new Error('Invalid V2 memory authentication tag');
  const base = await derivePasswordBits(parsed.secret, archiveSaltBytes);
  const aesKey = await deriveAesKey(base, clientSaltBytes, 'amnesia/memory-content/v2');
  const ciphertext = base64UrlToBytes(memory.ciphertext);
  const aad = textEncoder.encode(buildV2InnerAad(archiveId, memory.memoryId, memory.clientSalt));
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: nonceBytes, tagLength: 128, additionalData: aad },
    aesKey,
    new Uint8Array([...ciphertext, ...tag]),
  );
  return new TextDecoder().decode(plaintext);
}

export const buildV2InnerAad = (archiveId: number, memoryId: string, clientSalt: string) =>
  `amnesia/memory/v2|archive=${archiveId}|memory=${memoryId}|version=2|clientSalt=${clientSalt}`;

export const buildV2TimekeeperAad = (archiveId: number, memoryId: string, unlockAt: string) =>
  `amnesia/timekeeper/v2|archive=${archiveId}|memory=${memoryId}|unlock=${unlockAt}|version=2`;

export async function decryptV2TimekeeperLayer(material: {
  secret: string;
  ciphertext: string;
  nonce: string;
  authTag: string;
}, additionalData: string) {
  const secret = base64UrlToBytes(material.secret);
  const nonce = base64UrlToBytes(material.nonce);
  const tag = base64UrlToBytes(material.authTag);
  if (secret.length !== 32) throw new Error('Invalid V2 Timekeeper secret');
  if (nonce.length !== 12) throw new Error('Invalid V2 Timekeeper nonce');
  if (tag.length !== 16) throw new Error('Invalid V2 Timekeeper authentication tag');
  const key = await crypto.subtle.importKey('raw', secret, 'AES-GCM', false, ['decrypt']);
  const ciphertext = base64UrlToBytes(material.ciphertext);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: 128, additionalData: textEncoder.encode(additionalData) },
    key,
    new Uint8Array([...ciphertext, ...tag]),
  );
  return JSON.parse(new TextDecoder().decode(plaintext)) as {
    ciphertext: string;
    nonce: string;
    authTag: string;
    clientSalt: string;
    memoryId: string;
  };
}
