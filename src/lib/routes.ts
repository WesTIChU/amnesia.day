// Central routing constants and resolution for the app. Archive sub-routes
// are fixed pathnames with no query strings, fragments, or route parameters,
// so no Recovery Phrase, archive id, session token, or any other secret
// material can ever be placed in the URL.

export type AppView =
  | 'home'
  | 'card'
  | 'archive'
  | 'archiveCalendar'
  | 'archiveEntries'
  | 'machine'
  | 'terms'
  | 'privacy'
  | 'about'
  | 'faq';

export type ArchiveSubRoute = 'calendar' | 'entries';

export const ROUTE_VAULT = '/vault';
export const ROUTE_CALENDAR = '/vault/calendar';
export const ROUTE_ENTRIES = '/vault/entries';
export const ROUTE_HOME = '/';

export const SUB_ROUTE_PATHS: Record<ArchiveSubRoute, string> = {
  calendar: ROUTE_CALENDAR,
  entries: ROUTE_ENTRIES,
};

export interface RouteResolution {
  view: AppView;
  /** When set, the caller should replaceState to this path (a guard redirect). */
  redirectTo?: string;
}

export function subRoutePath(target: ArchiveSubRoute): string {
  return SUB_ROUTE_PATHS[target];
}

// When the server session expires, the client must immediately drop the user
// at the opening flow and scrub the expired private route from browser
// history. The caller replaces state (never pushes) with redirectTo, so the
// expired /vault, /vault/calendar or /vault/entries route cannot be revisited
// via back/forward. This applies consistently to every authenticated route.
export function sessionExpiryResolution(): RouteResolution {
  return { view: 'home', redirectTo: ROUTE_HOME };
}

// Resolve a location pathname to a view. Authenticated archive sub-routes
// require an active client archive session; without one the user is returned
// to the archive-opening flow (home).
export function resolvePath(pathname: string, hasActiveSession: boolean): RouteResolution {
  if (pathname === ROUTE_CALENDAR) {
    return hasActiveSession
      ? { view: 'archiveCalendar' }
      : { view: 'home', redirectTo: '/' };
  }
  if (pathname === ROUTE_ENTRIES) {
    return hasActiveSession
      ? { view: 'archiveEntries' }
      : { view: 'home', redirectTo: '/' };
  }
  if (pathname === ROUTE_VAULT) return { view: 'archive' };
  if (pathname === '/machine') return { view: 'machine' };
  if (pathname === '/terms') return { view: 'terms' };
  if (pathname === '/privacy') return { view: 'privacy' };
  if (pathname === '/about') return { view: 'about' };
  if (pathname === '/faq') return { view: 'faq' };
  if (pathname === '/card') return { view: 'home', redirectTo: '/' };
  return { view: 'home' };
}
