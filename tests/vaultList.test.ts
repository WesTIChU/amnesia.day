import assert from 'node:assert/strict';
import test from 'node:test';
import { previewVaultLists, VAULT_PREVIEW_LIMIT } from '../src/lib/vaultList.js';
import type { Memory } from '../src/types.js';

const memory = (id: number, unlocked: boolean): Memory => ({
  id,
  createdAt: '2026-01-01T00:00:00.000Z',
  unlockAt: '2027-01-01T00:00:00.000Z',
  unlocked,
});

const cardCount = (preview: { awakened: Memory[]; sleeping: Memory[] }) =>
  preview.awakened.length + preview.sleeping.length;

test('the main archive renders at most five entry cards before View all entries', () => {
  const awakened = [1, 2, 3, 4, 5, 6, 7].map((id) => memory(id, true));
  const sleeping = [8, 9, 10].map((id) => memory(id, false));

  const preview = previewVaultLists(awakened, sleeping);
  assert.ok(
    cardCount(preview) <= VAULT_PREVIEW_LIMIT,
    'the index must never render more than five cards',
  );
  assert.equal(cardCount(preview), 5, 'with ten entries exactly five cards are shown');
  assert.equal(preview.total, 10);
  assert.equal(preview.truncated, true, 'more than five entries must offer View all entries');
});

test('fewer than five entries render in full without a View all prompt', () => {
  const preview = previewVaultLists([memory(1, true), memory(2, true)], [memory(3, false)]);
  assert.equal(cardCount(preview), 3);
  assert.equal(preview.total, 3);
  assert.equal(preview.truncated, false);
});

test('exactly five entries render in full without a View all prompt', () => {
  const preview = previewVaultLists([1, 2, 3, 4, 5].map((id) => memory(id, true)), []);
  assert.equal(cardCount(preview), 5);
  assert.equal(preview.truncated, false);
});

test('awakened entries are shown before sleeping entries in the preview', () => {
  const preview = previewVaultLists([memory(1, true)], [memory(2, false), memory(3, false), memory(4, false), memory(5, false)]);
  assert.deepEqual(preview.awakened.map((m) => m.id), [1]);
  assert.equal(preview.sleeping.length, 4, 'the remaining preview slots fill with sleeping entries');
  assert.equal(cardCount(preview), 5);
  assert.equal(preview.truncated, false);
});
