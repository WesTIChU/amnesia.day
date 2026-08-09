import React from 'react';
import { Memory } from '../../types';

interface ArchiveIndexProps {
  memories: Memory[];
  now: number;
  openedMemoryIds: number[];
  formatDate: (isoString: string) => string;
  formatEntryId: (id: number) => string;
  onOpenMemory: (memory: Memory) => void;
}

const calculateDaysLeft = (unlockIso: string, now: number) => {
  const unlockDate = new Date(unlockIso);
  const today = new Date(now);
  const utcDay = (date: Date) => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const calendarDays = Math.floor((utcDay(unlockDate) - utcDay(today)) / (1000 * 60 * 60 * 24));

  // Keep a future unlock on the current calendar day readable until it opens.
  if (calendarDays === 0 && unlockDate.getTime() > now) return 1;
  return Math.max(0, calendarDays);
};

export const ArchiveIndex: React.FC<ArchiveIndexProps> = ({
  memories,
  now,
  openedMemoryIds,
  formatDate,
  formatEntryId,
  onOpenMemory,
}) => {
  const awakened = memories.filter((m) => m.unlocked);
  const sleeping = memories.filter((m) => !m.unlocked);

  return (
    <div className="space-y-8 pt-6">
      <div className="border-b border-[#262626] pb-3 flex flex-wrap justify-between items-baseline gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-light text-white tracking-widest uppercase font-serif">
            Archive Index
          </h2>
        </div>
        <span className="font-mono text-xs text-[#888888] uppercase tracking-wider">
          TIME LOCKED VAULT
        </span>
      </div>

      {memories.length === 0 ? (
        <div className="py-12 px-6 text-center text-[#737373] font-serif italic text-sm border border-dashed border-[#262626] space-y-4">
          <div>The archive is waiting for its first memory.</div>
        </div>
      ) : (
        <div className="space-y-8">
          {awakened.length > 0 && (
            <div className="space-y-4">
              <div className="font-mono text-xs text-[#a3a3a3] uppercase tracking-widest border-l-2 border-[#4A5D4E] pl-3 py-0.5">
                Awakened Memories ({awakened.length})
              </div>
              <div className="space-y-3">
                {awakened.map((mem) => {
                  const stampId = formatEntryId(mem.id);
                  const createdStr = formatDate(mem.createdAt);
                  const unlockStr = formatDate(mem.unlockAt);
                  const isOpenedInSession = openedMemoryIds.includes(mem.id);
                  const hasBeenReadBefore = Boolean(mem.firstReadAt) || isOpenedInSession;
                  const preview = mem.content
                    ? mem.content.length > 90
                      ? mem.content.slice(0, 90) + '...'
                      : mem.content
                    : '';

                  return (
                    <div
                      key={mem.id}
                      className="bg-[#111111] border border-[#262626] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:border-[#4A5D4E]/50 group"
                    >
                      <div className="space-y-1.5 font-mono text-xs max-w-xl">
                        <div className="flex items-center gap-2">
                          <span className="text-[#e5e5e5] font-semibold text-[11px] tracking-wider">
                            ENTRY {stampId}
                          </span>
                          <span className="px-2 py-0.5 bg-[#4A5D4E]/10 border border-[#4A5D4E]/40 text-[#4A5D4E] text-[9px] font-semibold uppercase tracking-widest">
                            Awakened
                          </span>
                          {!hasBeenReadBefore && (
                            <span className="px-2 py-0.5 bg-[#f59e0b]/10 border border-[#f59e0b]/40 text-[#f59e0b] text-[9px] font-semibold uppercase tracking-widest">
                              Unread
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#737373]">
                          Sealed {createdStr} • Awakened {unlockStr}
                        </div>
                        {hasBeenReadBefore && preview && (
                          <div className="font-serif italic text-xs text-[#a3a3a3] pt-0.5 line-clamp-1">
                            "{preview}"
                          </div>
                        )}
                        {!hasBeenReadBefore && (
                          <div className="font-serif italic text-xs text-[#4A5D4E] pt-0.5">
                            This memory is waiting to be opened for the first time.
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => onOpenMemory(mem)}
                        className="self-start sm:self-center px-4 py-2 bg-[#171717] hover:bg-[#222222] border border-[#333333] hover:border-[#4A5D4E] text-[#f3f4f6] font-mono text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap shadow-sm group-hover:border-[#4A5D4E]"
                      >
                        <span>{!hasBeenReadBefore ? 'Open Memory' : 'Read Memory'}</span>
                        <span className="text-[#4A5D4E] transition-transform group-hover:translate-x-0.5">→</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {sleeping.length > 0 && (
            <div className="space-y-4">
              <div className="font-mono text-xs text-[#888888] uppercase tracking-widest border-l-2 border-[#262626] pl-3 py-0.5">
                Sleeping Memories ({sleeping.length})
              </div>
              <div className="space-y-3">
                {sleeping.map((mem) => {
                  const stampId = formatEntryId(mem.id);
                  const createdStr = formatDate(mem.createdAt);
                  const unlockStr = formatDate(mem.unlockAt);
                  const daysLeft = calculateDaysLeft(mem.unlockAt, now);

                  return (
                    <div
                      key={mem.id}
                      className="bg-[#0e0e0e] border border-[#1f1f1f] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-xs transition-colors hover:border-[#2a2a2a]"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[#a3a3a3] font-semibold text-[11px] tracking-wider">
                            ENTRY {stampId}
                          </span>
                          <span className="px-2 py-0.5 bg-[#1a1a1a] border border-[#2a2a2a] text-[#737373] text-[9px] uppercase tracking-widest">
                            Sleeping
                          </span>
                        </div>
                        <div className="text-[11px] text-[#525252]">
                          Sealed {createdStr} • Awakens {unlockStr}
                        </div>
                      </div>

                      <div className="text-[#4A5D4E] text-[11px] tracking-wider uppercase font-mono self-start sm:self-center">
                        Awakens in {daysLeft} {daysLeft === 1 ? 'day' : 'days'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
