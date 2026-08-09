import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCalendarDayMaps,
  buildMonthCells,
  calculateDaysLeft,
  getCalendarDayEntries,
  keyFromIso,
} from '../src/lib/calendar.js';
import type { Memory } from '../src/types.js';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const formatEntryId = (id: number) => `#${String(id).padStart(6, '0')}`;

const memory = (overrides: Partial<Memory> & { id: number }): Memory => ({
  createdAt: '2026-01-05T10:00:00.000Z',
  unlockAt: '2027-01-05T10:00:00.000Z',
  unlocked: false,
  ...overrides,
});

test('a locked entry on a selected calendar day exposes metadata only, never content', () => {
  const locked = memory({
    id: 1,
    content: 'SECRET CONTENT THAT MUST NEVER LEAK',
    unlockAt: '2027-01-05T10:00:00.000Z',
  });
  const awakenedElsewhere = memory({
    id: 2,
    unlocked: true,
    createdAt: '2026-02-02T10:00:00.000Z',
    unlockAt: '2027-02-02T10:00:00.000Z',
    content: 'ALSO NEVER EXPOSED HERE',
  });
  const maps = buildCalendarDayMaps([locked, awakenedElsewhere]);
  const selected = keyFromIso(locked.createdAt);

  const entries = getCalendarDayEntries([locked, awakenedElsewhere], selected, maps, formatEntryId, formatDate);
  assert.equal(entries.length, 1, 'only the memory sealed on the selected day should appear');
  const entry = entries[0];
  assert.equal(entry.status, 'sleeping');
  assert.equal(entry.unlocked, false);
  assert.equal('content' in entry, false, 'calendar day detail must never carry memory content');
  assert.equal(entry.sealedThisDay, true);
  assert.equal(entry.awakenedThisDay, false);
  assert.equal(entry.entryId, '#000001');
  assert.equal(typeof entry.sealedDate, 'string');
  assert.equal(typeof entry.awakenDate, 'string');
});

test('an awakened memory on the selected day also exposes metadata only', () => {
  const m = memory({
    id: 7,
    unlocked: true,
    createdAt: '2026-03-03T10:00:00.000Z',
    unlockAt: '2027-03-03T10:00:00.000Z',
    content: 'SHOULD NEVER APPEAR IN THE CALENDAR',
  });
  const maps = buildCalendarDayMaps([m]);
  const entries = getCalendarDayEntries([m], keyFromIso(m.unlockAt), maps, formatEntryId, formatDate);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].status, 'awakened');
  assert.equal(entries[0].unlocked, true);
  assert.equal(entries[0].awakenedThisDay, true);
  assert.equal(entries[0].sealedThisDay, false);
  assert.equal('content' in entries[0], false, 'awakened metadata must still never include content');
});

test('a day with a sealed and an awakened memory lists each memory once', () => {
  const sealedThatDay = memory({ id: 1, createdAt: '2026-04-04T10:00:00.000Z' });
  const awakenedThatDay = memory({
    id: 2,
    unlocked: true,
    createdAt: '2026-04-04T08:00:00.000Z',
    unlockAt: '2027-04-04T10:00:00.000Z',
  });
  const maps = buildCalendarDayMaps([sealedThatDay, awakenedThatDay]);
  const entries = getCalendarDayEntries(
    [sealedThatDay, awakenedThatDay],
    '2026-04-04',
    maps,
    formatEntryId,
    formatDate,
  );
  assert.equal(entries.length, 2, 'both memories for the day should be listed');
  assert.equal(new Set(entries.map((e) => e.id)).size, 2, 'no memory should be listed twice');
});

test('buildMonthCells produces complete weeks with the right day count', () => {
  const cells = buildMonthCells(2026, 0); // January 2026
  assert.equal(cells.length % 7, 0, 'month cells must fill complete weeks');
  assert.equal(cells.filter((c) => c !== null).length, 31, 'January has 31 days');
  assert.ok(cells.filter((c) => c === null).length > 0, 'leading blanks pad the first week');
});

test('calculateDaysLeft reports upcoming and past unlocks', () => {
  const now = new Date('2026-08-09T12:00:00.000Z').getTime();
  assert.equal(calculateDaysLeft(new Date('2026-08-10T12:00:00.000Z').toISOString(), now), 1);
  assert.equal(calculateDaysLeft(new Date('2026-08-08T12:00:00.000Z').toISOString(), now), 0);
  // A future unlock later today still counts as one readable day.
  assert.equal(calculateDaysLeft(new Date('2026-08-09T13:00:00.000Z').toISOString(), now), 1);
});

test('memory dates are keyed by their UTC day regardless of runtime timezone', () => {
  // 23:30 UTC on 2026-08-09 is already 2026-08-10 in many timezones; the key
  // must stay aligned with the server's UTC memory_day, not the local clock.
  assert.equal(keyFromIso('2026-08-09T23:30:00.000Z'), '2026-08-09');
  assert.equal(keyFromIso('2026-08-10T00:15:00.000Z'), '2026-08-10');
  assert.equal(keyFromIso('2025-12-31T23:59:59.000Z'), '2025-12-31');
});

test('a sleeping memory is never present in awakenedByDay', () => {
  const sleeping = memory({
    id: 1,
    unlockAt: '2027-01-05T23:30:00.000Z', // future unlock, memory still sleeping
  });
  const maps = buildCalendarDayMaps([sleeping]);
  assert.equal(maps.awakenedByDay.size, 0, 'a sleeping memory must not create an awakened key');
  assert.equal(maps.awakenedByDay.has('2027-01-05'), false, 'the future unlock day must not appear');
  assert.equal(maps.sealedByDay.has('2026-01-05'), true, 'the sealed day should still appear');
});

test('an unlocked memory appears on its UTC unlock date', () => {
  const unlocked = memory({
    id: 2,
    unlocked: true,
    unlockAt: '2027-01-05T23:30:00.000Z', // UTC day 2027-01-05, local day may differ
  });
  const maps = buildCalendarDayMaps([unlocked]);
  assert.equal(maps.awakenedByDay.has('2027-01-05'), true, 'unlocked memory must appear on its UTC unlock day');
  assert.equal(maps.awakenedByDay.has('2027-01-06'), false, 'the local next day must not be used');
  assert.equal((maps.awakenedByDay.get('2027-01-05') ?? []).length, 1);
});

test('a sleeping memory with a future unlock never gets an Awakened this day label', () => {
  const sleeping = memory({
    id: 3,
    createdAt: '2026-01-05T10:00:00.000Z',
    unlockAt: '2027-01-05T10:00:00.000Z',
  });
  const maps = buildCalendarDayMaps([sleeping]);
  const entries = getCalendarDayEntries([sleeping], '2026-01-05', maps, formatEntryId, formatDate);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].status, 'sleeping');
  assert.equal(entries[0].awakenedThisDay, false, 'a sleeping memory must never be marked Awakened this day');
  assert.equal('content' in entries[0], false);
});
