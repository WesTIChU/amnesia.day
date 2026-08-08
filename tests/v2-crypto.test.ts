import assert from 'node:assert/strict';
import test from 'node:test';
import { buildV2TimekeeperAad, createTimekeeperLayer } from '../server/encryption.js';
import { WORDLIST } from '../server/wordlist.js';
import {
  createV2MemoryKey,
  decryptV2Memory,
  decryptV2TimekeeperLayer,
  deriveV2AuthVerifier,
  deriveV2LookupVerifier,
  encryptV2Memory,
} from '../src/lib/crypto.js';

const archiveSalt = 'AAAAAAAAAAAAAAAAAAAAAA';

test('V2 wordlist has sufficient valid entropy', () => {
  assert.ok(WORDLIST.length >= 2048);
  assert.equal(new Set(WORDLIST).size, WORDLIST.length);
  assert.ok(WORDLIST.every((word) => /^[a-z]+$/.test(word)));
});

test('lookup and authentication derivations are separate', async () => {
  const generated = createV2MemoryKey();
  const lookup = await deriveV2LookupVerifier(generated.key);
  const auth = await deriveV2AuthVerifier(generated.key, generated.authSalt);
  assert.notEqual(lookup, auth.authVerifier);
  assert.equal(generated.key.split('-').length, 6);
  assert.notEqual(lookup, await deriveV2LookupVerifier(createV2MemoryKey().key));
  await assert.rejects(() => deriveV2AuthVerifier(generated.key, 'AA'));
  await assert.rejects(() => encryptV2Memory(generated.key, 'AA', 'test', 1));
});

test('V2 encrypts in the browser and requires both layers to decrypt', async () => {
  const { key } = createV2MemoryKey();
  const plaintext = 'A private memory that must never reach the server.';
  const inner = await encryptV2Memory(key, archiveSalt, plaintext, 42);

  assert.notEqual(inner.ciphertext, plaintext);
  assert.equal(JSON.stringify(inner).includes(plaintext), false);

  const timekeeperAad = buildV2TimekeeperAad(42, inner.memoryId, '2027-01-01T00:00:00.000Z');
  const timekeeper = createTimekeeperLayer(JSON.stringify(inner), timekeeperAad);
  const material = {
    secret: timekeeper.secret,
    ciphertext: timekeeper.ciphertext,
    nonce: timekeeper.nonce,
    authTag: timekeeper.authTag,
  };
  const recoveredInner = await decryptV2TimekeeperLayer(material, timekeeperAad);
  const recovered = await decryptV2Memory(key, archiveSalt, recoveredInner, 42);
  assert.equal(recovered, plaintext);

  await assert.rejects(() => decryptV2Memory(createV2MemoryKey().key, archiveSalt, recoveredInner, 42));
  await assert.rejects(() => decryptV2TimekeeperLayer({ ...material, ciphertext: `${material.ciphertext}x` }, timekeeperAad));
  await assert.rejects(() => decryptV2Memory(key, archiveSalt, recoveredInner, 43));
  await assert.rejects(() => decryptV2Memory(key, archiveSalt, { ...recoveredInner, clientSalt: 'AA' }, 42));
  await assert.rejects(() => decryptV2TimekeeperLayer({ ...material, secret: 'AA' }, timekeeperAad));
});
