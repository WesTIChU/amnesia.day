import React, { useState } from 'react';
import { useArchive } from '../../hooks/useArchive';
import { ambientSound } from '../../lib/audio';
import { getCsrfToken } from '../../lib/http';
import { Footer } from '../Footer';
import { TopBar } from '../TopBar';
import { LogOut, Volume2, VolumeX } from 'lucide-react';
import { calculateDaysLeft } from '../../lib/calendar';
import { AWAKENED_BADGE, SLEEPING_BADGE } from './MemoryEntryCard';

const PAGE_SIZE = 25;

interface ArchiveEntriesViewProps {
  memoryKey?: string;
  onGoVault: () => void;
  onSessionClosed: () => void;
  onSessionExpired: () => void;
  onNavigateMachine?: () => void;
  onNavigateTerms?: () => void;
  onNavigatePrivacy?: () => void;
  onNavigateAbout?: () => void;
}

export const ArchiveEntriesView: React.FC<ArchiveEntriesViewProps> = ({
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
  const [page, setPage] = useState(0);

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

  const awakened = memories.filter((m) => m.unlocked);
  const sleeping = memories.filter((m) => !m.unlocked);
  const total = memories.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageSlice = chronological.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const pagination = pageCount > 1 ? (
    <div className="flex items-center justify-between font-mono text-xs text-[#737373]">
      <button
        onClick={() => setPage(safePage - 1)}
        disabled={safePage === 0}
        className="px-4 py-2 bg-[#181818] border border-[#2a2a2a] text-[#a3a3a3] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer uppercase tracking-widest"
      >
        ← Prev
      </button>
      <span className="uppercase tracking-wider">
        {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, total)} of {total}
      </span>
      <button
        onClick={() => setPage(safePage + 1)}
        disabled={safePage >= pageCount - 1}
        className="px-4 py-2 bg-[#181818] border border-[#2a2a2a] text-[#a3a3a3] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer uppercase tracking-widest"
      >
        Next →
      </button>
    </div>
  ) : null;

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
          All Entries
        </h1>
        <p className="text-xs sm:text-sm text-[#888888] font-mono tracking-wider uppercase">
          {total} entry{total === 1 ? '' : 's'} · {awakened.length} awakened · {sleeping.length} sleeping
        </p>
      </div>

      {total === 0 ? (
        <div className="py-12 px-6 text-center text-[#737373] font-serif italic text-sm border border-dashed border-[#262626]">
          <div>The archive is waiting for its first memory.</div>
        </div>
      ) : (
        <div className="space-y-6">
          {pagination}
          <div className="space-y-3">
            {pageSlice.map((mem) => {
              const daysLeft = calculateDaysLeft(mem.unlockAt, currentTime);
              return (
                <div
                  key={mem.id}
                  className="bg-[#0e0e0e] border border-[#1f1f1f] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-xs transition-colors hover:border-[#2a2a2a]"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[#a3a3a3] font-semibold text-[11px] tracking-wider">
                        ENTRY {formatEntryId(mem.id)}
                      </span>
                      {mem.unlocked ? (
                        <span className={AWAKENED_BADGE}>Awakened</span>
                      ) : (
                        <span className={SLEEPING_BADGE}>Sleeping</span>
                      )}
                      {mem.unlocked && !mem.firstReadAt && (
                        <span className="px-2 py-0.5 bg-[#f59e0b]/10 border border-[#f59e0b]/40 text-[#f59e0b] text-[9px] font-semibold uppercase tracking-widest">
                          Unread
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#737373]">
                      Sealed {formatDate(mem.createdAt)} • Awakens {formatDate(mem.unlockAt)}
                    </div>
                  </div>
                  {!mem.unlocked && (
                    <div className="text-[#607864] text-[11px] tracking-wider uppercase font-mono self-start sm:self-center">
                      Awakens in {daysLeft} {daysLeft === 1 ? 'day' : 'days'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {pagination}
        </div>
      )}

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
