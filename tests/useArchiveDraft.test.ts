import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveArchiveDraftState } from '../src/hooks/useArchiveDraft.js';

test('switching archives clears the in-memory editor and restores only the new archive draft', () => {
  // Archive A had an in-memory draft; Archive B has no saved draft.
  const stateB = resolveArchiveDraftState(null);
  assert.equal(stateB.memoryText, '');
  assert.equal(stateB.foundDraftText, '');
  assert.equal(stateB.hasDraftPrompt, false);
});

test('archive with a saved draft surfaces it as a prompt without leaking old text', () => {
  const state = resolveArchiveDraftState('Archive B saved text');
  assert.equal(state.memoryText, '');
  assert.equal(state.foundDraftText, 'Archive B saved text');
  assert.equal(state.hasDraftPrompt, true);
});

test('archive with only whitespace in its draft is treated as empty', () => {
  const state = resolveArchiveDraftState('   ');
  assert.equal(state.memoryText, '');
  assert.equal(state.foundDraftText, '');
  assert.equal(state.hasDraftPrompt, false);
});

test('no archive id produces a clean empty editor', () => {
  const state = resolveArchiveDraftState(undefined);
  assert.deepEqual(state, { memoryText: '', foundDraftText: '', hasDraftPrompt: false });
});
