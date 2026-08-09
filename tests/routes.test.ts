import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ROUTE_CALENDAR,
  ROUTE_ENTRIES,
  ROUTE_VAULT,
  resolvePath,
  sessionExpiryResolution,
  subRoutePath,
} from '../src/lib/routes.js';

test('calendar navigation uses a fixed pathname and never embeds the Recovery Phrase', () => {
  const navUrl = subRoutePath('calendar');
  assert.equal(navUrl, '/vault/calendar');
  assert.equal(navUrl, ROUTE_CALENDAR);

  // No query string, fragment, or route parameter can carry secret material.
  assert.equal(navUrl.includes('?'), false, 'calendar URL must not contain a query string');
  assert.equal(navUrl.includes('#'), false, 'calendar URL must not contain a fragment');

  // The navigation API accepts no secret inputs at all, so a caller holding
  // Recovery Phrase material cannot leak it into the URL.
  const url = new URL(`https://amnesia.day${navUrl}`);
  assert.equal(url.pathname, '/vault/calendar');
  assert.equal(url.search, '');
  assert.equal(url.hash, '');
  const sensitive = ['recovery', 'phrase', 'memory-key', 'authverifier', 'archivesalt', 'session'];
  for (const token of sensitive) {
    assert.equal(url.pathname.toLowerCase().includes(token), false, `URL must not contain ${token}`);
  }
});

test('the entries sub-route is likewise a fixed pathname', () => {
  const navUrl = subRoutePath('entries');
  assert.equal(navUrl, '/vault/entries');
  assert.equal(navUrl, ROUTE_ENTRIES);
  assert.equal(navUrl.includes('?'), false);
  assert.equal(navUrl.includes('#'), false);
});

test('direct calendar access without an active archive session returns to the opening flow', () => {
  const resolution = resolvePath(ROUTE_CALENDAR, false);
  assert.equal(resolution.view, 'home');
  assert.equal(resolution.redirectTo, '/', 'an unauthenticated visitor must be redirected to the opening flow');
});

test('direct calendar access with an active archive session is allowed', () => {
  assert.deepEqual(resolvePath(ROUTE_CALENDAR, true), { view: 'archiveCalendar' });
});

test('browser navigation between /vault and /vault/calendar resolves both directions', () => {
  assert.deepEqual(resolvePath(ROUTE_VAULT, true), { view: 'archive' });
  assert.deepEqual(resolvePath(ROUTE_CALENDAR, true), { view: 'archiveCalendar' });
  assert.deepEqual(resolvePath(ROUTE_CALENDAR, false), { view: 'home', redirectTo: '/' });
  assert.deepEqual(resolvePath('/', true), { view: 'home' });
  assert.deepEqual(resolvePath('/', false), { view: 'home' });
});

test('entries route behaves like the calendar route', () => {
  assert.deepEqual(resolvePath(ROUTE_ENTRIES, true), { view: 'archiveEntries' });
  assert.deepEqual(resolvePath(ROUTE_ENTRIES, false), { view: 'home', redirectTo: '/' });
});

test('a server-session expiry on /vault/calendar resolves to / without another click', () => {
  // While the session is valid the calendar route is allowed...
  assert.deepEqual(resolvePath(ROUTE_CALENDAR, true), { view: 'archiveCalendar' });
  // ...but when the server session dies, the expiry itself resolves straight
  // to the opening flow at '/'. It does not rely on the visitor navigating
  // again, and it is not a push onto history.
  const expiry = sessionExpiryResolution();
  assert.deepEqual(expiry, { view: 'home', redirectTo: '/' });
  // The route guard agrees: with no active session the same path resolves home.
  assert.deepEqual(resolvePath(ROUTE_CALENDAR, false), { view: 'home', redirectTo: '/' });
});

test('a server-session expiry on /vault/entries resolves to / without another click', () => {
  assert.deepEqual(resolvePath(ROUTE_ENTRIES, true), { view: 'archiveEntries' });
  const expiry = sessionExpiryResolution();
  assert.deepEqual(expiry, { view: 'home', redirectTo: '/' });
  assert.deepEqual(resolvePath(ROUTE_ENTRIES, false), { view: 'home', redirectTo: '/' });
});

test('public routes resolve independently of session state', () => {
  assert.deepEqual(resolvePath('/machine', true), { view: 'machine' });
  assert.deepEqual(resolvePath('/terms', false), { view: 'terms' });
  assert.deepEqual(resolvePath('/privacy', false), { view: 'privacy' });
  assert.deepEqual(resolvePath('/about', false), { view: 'about' });
  assert.deepEqual(resolvePath('/faq', false), { view: 'faq' });
});
