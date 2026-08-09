import React, { useState } from 'react';
import { useArchive } from '../../hooks/useArchive';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { ambientSound } from '../../lib/audio';
import { getCsrfToken } from '../../lib/http';
import { Footer } from '../Footer';
import { TopBar } from '../TopBar';
import { LogOut, Volume2, VolumeX } from 'lucide-react';
import {
  MONTH_NAMES,
  buildCalendarDayMaps,
  calendarPosition,
  clampDayToMonth,
  dayKey,
  getCalendarDayEntries,
  shiftMonth,
  visibleMonths,
} from '../../lib/calendar';
import { MonthCard } from './MonthCard';
import { AWAKENED_BADGE, SLEEPING_BADGE } from './MemoryEntryCard';

interface ArchiveCalendarViewProps {
  memoryKey?: string;
  onGoVault: () => void;
  onSessionClosed: () => void;
  onSessionExpired: () => void;
  onNavigateMachine?: () => void;
  onNavigateTerms?: () => void;
  onNavigatePrivacy?: () => void;
  onNavigateAbout?: () => void;
}

export const ArchiveCalendarView: React.FC<ArchiveCalendarViewProps> = ({
  memoryKey,
  onGoVault,
  onSessionClosed,
  onSessionExpired,
  onNavigateMachine,
  onNavigateTerms,
  onNavigatePrivacy,
  onNavigateAbout,
}) => {
  const { data, loading, error, currentTime } = useArchive({ memoryKey, onSessionExpired });
  const [isAudioPlaying, setIsAudioPlaying] = useState(() => ambientSound.getIsPlaying());
  const [calendarYear, setCalendarYear] = useState(() => calendarPosition(currentTime).year);
  const [mobileMonth, setMobileMonth] = useState(() => calendarPosition(currentTime).month);
  const [selectedDay, setSelectedDay] = useState(() => dayKey(new Date(currentTime)));
  const isDesktop = useMediaQuery('(min-width: 768px)');

  const toggleAmbience = () => {
    setIsAudioPlaying(ambientSound.toggle());
  };

  const handlePrevMonth = () => {
    const target = shiftMonth(calendarYear, mobileMonth, -1);
    setCalendarYear(target.year);
    setMobileMonth(target.month);
    setSelectedDay((prev) => clampDayToMonth(prev, target.year, target.month));
  };

  const handleNextMonth = () => {
    const target = shiftMonth(calendarYear, mobileMonth, 1);
    setCalendarYear(target.year);
    setMobileMonth(target.month);
    setSelectedDay((prev) => clampDayToMonth(prev, target.year, target.month));
  };

  const handleCloseSession = async () => {
    try {
      await fetch('/api/archive/logout', {
        method: 'POST',
        headers: { 'X-CSRF-Token': getCsrfToken() },
      });
    } finally {
      onSessionClosed();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center font-mono text-xs text-[#737373] tracking-widest uppercase">
        Accessing archive...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#080808] flex flex-col items-center justify-center p-6 text-center space-y-6">
        <p className="font-mono text-xs text-[#f87171]">{error || 'Archive unavailable.'}</p>
        <button
          onClick={onSessionClosed}
          className="px-6 py-2 border border-[#262626] text-[#737373] hover:text-[#e5e5e5] font-mono text-xs cursor-pointer"
        >
          Return to archive opening
        </button>
      </div>
    );
  }

  const memories = data.memories;
  const chronological = [...memories].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id,
  );
  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };
  const formatEntryId = (id: number) =>
    `#${String(chronological.findIndex((m) => m.id === id) + 1).padStart(6, '0')}`;

  const maps = buildCalendarDayMaps(memories);
  const todayKey = dayKey(new Date(currentTime));
  const dayEntries = getCalendarDayEntries(memories, selectedDay, maps, formatEntryId, formatDate);
  const selectedLabel = (() => {
    const [y, m, d] = selectedDay.split('-').map(Number);
    return formatDate(new Date(y, m - 1, d, 12).toISOString());
  })();

  return (
    <div className="min-h-screen bg-[#080808] text-[#D1D1D1] p-6 sm:p-12 lg:p-16 max-w-4xl mx-auto space-y-12 font-serif animate-fade-in">
      <TopBar
        left={
          <button
            onClick={onGoVault}
            className="text-[#a3a3a3] hover:text-[#e5e5e5] transition-colors cursor-pointer uppercase tracking-widest"
          >
            ← Return to archive
          </button>
        }
        right={
          <>
            <button
              onClick={toggleAmbience}
              aria-label={isAudioPlaying ? 'Turn off archive ambience' : 'Turn on archive ambience'}
              aria-pressed={isAudioPlaying}
              title={isAudioPlaying ? 'Turn off archive ambience' : 'Turn on archive ambience'}
              className={`p-2 border transition-colors cursor-pointer ${
                isAudioPlaying
                  ? 'border-[#4A5D4E] text-[#4A5D4E]'
                  : 'border-transparent text-[#737373] hover:border-[#262626] hover:text-[#e5e5e5]'
              }`}
            >
              {isAudioPlaying ? <Volume2 size={14} strokeWidth={1.5} /> : <VolumeX size={14} strokeWidth={1.5} />}
            </button>
            <button
              onClick={handleCloseSession}
              aria-label="Close session"
              title="Close session"
              className="p-2 text-[#737373] hover:text-[#e5e5e5] border border-transparent hover:border-[#262626] transition-colors cursor-pointer"
            >
              <LogOut size={14} strokeWidth={1.5} />
            </button>
          </>
        }
      />

      <div className="space-y-2 text-center sm:text-left">
        <h1 className="text-2xl sm:text-3xl font-light tracking-[0.2em] text-white uppercase font-serif">
          Archive Calendar
        </h1>
        <p className="text-xs sm:text-sm text-[#888888] font-mono tracking-wider uppercase">
          The shape of a year. Sealed days, awakening days, and today.
        </p>
      </div>

      {isDesktop && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCalendarYear(calendarYear - 1)}
            className="px-4 py-2 bg-[#181818] hover:bg-[#222222] border border-[#2a2a2a] text-[#a3a3a3] hover:text-white font-mono text-xs uppercase tracking-widest transition-colors cursor-pointer"
          >
            ← {calendarYear - 1}
          </button>
          <div className="font-mono text-sm text-[#a3a3a3] uppercase tracking-[0.25em]">
            {calendarYear}
          </div>
          <button
            onClick={() => setCalendarYear(calendarYear + 1)}
            className="px-4 py-2 bg-[#181818] hover:bg-[#222222] border border-[#2a2a2a] text-[#a3a3a3] hover:text-white font-mono text-xs uppercase tracking-widest transition-colors cursor-pointer"
          >
            {calendarYear + 1} →
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[10px] uppercase tracking-widest text-[#737373]">
        <span className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#525252]"></span>
          Sleeping
        </span>
        <span className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#4A5D4E]"></span>
          Awakened
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 border border-[#262626]"></span>
          Today
        </span>
      </div>

      {isDesktop ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {visibleMonths('desktop', calendarYear, mobileMonth).map(({ year, month }) => (
            <MonthCard
              key={MONTH_NAMES[month]}
              year={year}
              month={month}
              monthName={MONTH_NAMES[month]}
              maps={maps}
              todayKey={todayKey}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={handlePrevMonth}
              className="px-3 py-2 bg-[#181818] hover:bg-[#222222] border border-[#2a2a2a] text-[#a3a3a3] hover:text-white font-mono text-[11px] uppercase tracking-widest transition-colors cursor-pointer"
            >
              ← Previous month
            </button>
            <div className="font-mono text-sm text-[#a3a3a3] uppercase tracking-[0.25em] whitespace-nowrap">
              {MONTH_NAMES[mobileMonth]} {calendarYear}
            </div>
            <button
              onClick={handleNextMonth}
              className="px-3 py-2 bg-[#181818] hover:bg-[#222222] border border-[#2a2a2a] text-[#a3a3a3] hover:text-white font-mono text-[11px] uppercase tracking-widest transition-colors cursor-pointer"
            >
              Next month →
            </button>
          </div>
          <MonthCard
            year={calendarYear}
            month={mobileMonth}
            monthName={MONTH_NAMES[mobileMonth]}
            maps={maps}
            todayKey={todayKey}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            compact
            showMonthName={false}
          />
        </div>
      )}

      <div className="border border-[#1f1f1f] bg-[#111111] p-4 sm:p-5">
        <div className="font-mono text-xs text-[#a3a3a3] uppercase tracking-widest border-l-2 border-[#4A5D4E] pl-3 py-0.5 mb-1">
          {selectedLabel}
        </div>
        {dayEntries.length === 0 ? (
          <div className="py-6 text-center text-[#737373] font-serif italic text-sm">
            No memories sealed or awakened on this day.
          </div>
        ) : (
          <div className="space-y-0.5">
            {dayEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-2.5 border-b border-[#1f1f1f] last:border-0"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[#a3a3a3] font-semibold text-[11px] tracking-wider">
                      ENTRY {entry.entryId}
                    </span>
                    {entry.status === 'awakened' ? (
                      <span className={AWAKENED_BADGE}>Awakened</span>
                    ) : (
                      <span className={SLEEPING_BADGE}>Sleeping</span>
                    )}
                    {entry.awakenedThisDay && (
                      <span className="text-[#4A5D4E]/70 text-[9px] uppercase tracking-widest font-mono">
                        Awakened this day
                      </span>
                    )}
                    {entry.sealedThisDay && (
                      <span className="text-[#525252] text-[9px] uppercase tracking-widest font-mono">
                        Sealed this day
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[#737373]">
                    Sealed {entry.sealedDate} • Awakens {entry.awakenDate}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Footer
        onNavigateMachine={onNavigateMachine}
        onNavigateTerms={onNavigateTerms}
        onNavigatePrivacy={onNavigatePrivacy}
        onNavigateAbout={onNavigateAbout}
        isLoggedIn
      />
    </div>
  );
};
