import type { Memory } from '../types';

export const pad = (n: number) => String(n).padStart(2, '0');

// Calendar keys are explicitly UTC so the calendar stays aligned with the
// server's UTC memory_day and Timekeeper release rules, independent of the
// visitor's runtime timezone.
export const dayKey = (date: Date) =>
  `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;

export const keyFromIso = (iso: string) => dayKey(new Date(iso));

// Builds the same UTC day key as dayKey for an explicit (year, month, day)
// triple. month is 0-indexed like the Date constructor and MONTH_NAMES.
export const dayKeyFor = (year: number, month: number, day: number) =>
  `${year}-${pad(month + 1)}-${pad(day)}`;

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// Mobile single-month navigation keeps the selected day of month where it fits,
// and clamps it to the new month's last day when it does not (e.g. 31 -> Feb).
export function clampDayToMonth(day: string, year: number, month: number): string {
  const [y, m, d] = day.split('-').map(Number);
  if (y === year && m === month + 1) return day;
  return dayKeyFor(year, month, Math.min(d, daysInMonth(year, month)));
}

// The mobile calendar opens on the current UTC month, matching the calendar's
// UTC day keys and the server's UTC memory_day rules.
export function calendarPosition(now: number): { year: number; month: number } {
  const date = new Date(now);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
}

// Mobile shows exactly one month; desktop shows all twelve of the year.
export function visibleMonths(
  mode: 'mobile' | 'desktop',
  year: number,
  month: number,
): Array<{ year: number; month: number }> {
  if (mode === 'mobile') return [{ year, month }];
  return MONTH_NAMES.map((_, i) => ({ year, month: i }));
}

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function buildMonthCells(year: number, month: number): (number | null)[] {
  const firstWeekday = new Date(year, month, 1).getDay();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth(year, month); day++) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export const calculateDaysLeft = (unlockIso: string, now: number) => {
  const unlockDate = new Date(unlockIso);
  const today = new Date(now);
  const utcDay = (date: Date) => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const calendarDays = Math.floor((utcDay(unlockDate) - utcDay(today)) / (1000 * 60 * 60 * 24));

  // Keep a future unlock on the current calendar day readable until it opens.
  if (calendarDays === 0 && unlockDate.getTime() > now) return 1;
  return Math.max(0, calendarDays);
};

export interface CalendarDayMaps {
  sealedByDay: Map<string, Memory[]>;
  awakenedByDay: Map<string, Memory[]>;
}

export function buildCalendarDayMaps(memories: Memory[]): CalendarDayMaps {
  const sealedByDay = new Map<string, Memory[]>();
  const awakenedByDay = new Map<string, Memory[]>();
  for (const m of memories) {
    const sealedKey = keyFromIso(m.createdAt);
    const sealedList = sealedByDay.get(sealedKey);
    if (sealedList) sealedList.push(m);
    else sealedByDay.set(sealedKey, [m]);

    // Only unlocked memories have an awakening day. A sleeping memory's future
    // unlock date must not produce an Awakened dot or an "Awakened this day"
    // label.
    if (m.unlocked) {
      const awakenedKey = keyFromIso(m.unlockAt);
      const awakenedList = awakenedByDay.get(awakenedKey);
      if (awakenedList) awakenedList.push(m);
      else awakenedByDay.set(awakenedKey, [m]);
    }
  }
  return { sealedByDay, awakenedByDay };
}

export interface CalendarDayEntry {
  id: number;
  entryId: string;
  sealedDate: string;
  awakenDate: string;
  status: 'sleeping' | 'awakened';
  unlocked: boolean;
  sealedThisDay: boolean;
  awakenedThisDay: boolean;
}

// The calendar day detail exposes metadata only: sealed date, awakening date
// and current status. Memory content is never included, even for entries that
// have awakened.
export function getCalendarDayEntries(
  memories: Memory[],
  selectedDay: string,
  maps: CalendarDayMaps,
  formatEntryId: (id: number) => string,
  formatDate: (isoString: string) => string,
): CalendarDayEntry[] {
  const sealedToday = maps.sealedByDay.get(selectedDay) ?? [];
  const awakenedToday = maps.awakenedByDay.get(selectedDay) ?? [];
  const seen = new Set<number>();
  const entries: CalendarDayEntry[] = [];
  const visit = (m: Memory) => {
    if (seen.has(m.id)) return;
    seen.add(m.id);
    entries.push({
      id: m.id,
      entryId: formatEntryId(m.id),
      sealedDate: formatDate(m.createdAt),
      awakenDate: formatDate(m.unlockAt),
      status: m.unlocked ? 'awakened' : 'sleeping',
      unlocked: Boolean(m.unlocked),
      sealedThisDay: sealedToday.some((x) => x.id === m.id),
      awakenedThisDay: awakenedToday.some((x) => x.id === m.id),
    });
  };
  sealedToday.forEach(visit);
  awakenedToday.forEach(visit);
  return entries;
}
