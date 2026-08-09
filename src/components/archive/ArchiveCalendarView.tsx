import React, { useState } from 'react';
import { useArchive } from '../../hooks/useArchive';
import { ambientSound } from '../../lib/audio';
import { getCsrfToken } from '../../lib/http';
import { Footer } from '../Footer';
import { TopBar } from '../TopBar';
import { LogOut, Volume2, VolumeX } from 'lucide-react';
import {
  MONTH_NAMES,
  WEEKDAYS,
  buildCalendarDayMaps,
  buildMonthCells,
  dayKey,
  getCalendarDayEntries,
} from '../../lib/calendar';
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
  const [calendarYear, setCalendarYear] = useState(() => new Date(currentTime).getUTCFullYear());
  const [selectedDay, setSelectedDay] = useState(() => dayKey(new Date(currentTime)));

  const toggleAmbience = () => {
    setIsAudioPlaying(ambientSound.toggle());
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {MONTH_NAMES.map((monthName, monthIndex) => (
          <div key={monthName} className="bg-[#0e0e0e] border border-[#1f1f1f] p-3">
            <div className="font-mono text-[10px] text-[#888888] uppercase tracking-widest mb-2">
              {monthName}
            </div>
            <div className="grid grid-cols-7 gap-px mb-1">
              {WEEKDAYS.map((w) => (
                <div key={w} className="text-center text-[8px] font-mono uppercase tracking-widest text-[#525252]">
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px">
              {buildMonthCells(calendarYear, monthIndex).map((day, i) => {
                if (day === null) return <div key={`empty-${i}`} />;
                const key = `${calendarYear}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const hasSealed = (maps.sealedByDay.get(key)?.length ?? 0) > 0;
                const hasAwakened = (maps.awakenedByDay.get(key)?.length ?? 0) > 0;
                const isSelected = key === selectedDay;
                const isToday = key === todayKey;
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedDay(key)}
                    aria-label={`${day} ${monthName} ${calendarYear}`}
                    className={`aspect-square flex flex-col items-center justify-center text-[11px] font-mono transition-colors cursor-pointer border ${
                      isSelected
                        ? 'bg-[#4A5D4E]/15 border-[#4A5D4E]/60 text-[#e5e5e5]'
                        : `border-transparent hover:border-[#262626] hover:bg-[#111111] ${
                            hasAwakened || hasSealed ? 'text-[#a3a3a3]' : 'text-[#737373]'
                          } ${isToday ? 'border-[#262626]' : ''}`
                    }`}
                  >
                    <span>{day}</span>
                    <span className="flex gap-1 h-1.5 items-center justify-center">
                      {hasAwakened && <span className="w-1 h-1 rounded-full bg-[#4A5D4E]" />}
                      {hasSealed && <span className="w-1 h-1 rounded-full bg-[#525252]" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

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
