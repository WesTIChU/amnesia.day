import React from 'react';
import { Memory } from '../../types';
import { calculateDaysLeft } from '../../lib/calendar';

export const AWAKENED_BADGE =
  'px-2 py-0.5 bg-[#4A5D4E]/10 border border-[#4A5D4E]/40 text-[#4A5D4E] text-[9px] font-semibold uppercase tracking-widest';
export const SLEEPING_BADGE =
  'px-2 py-0.5 bg-[#1a1a1a] border border-[#3a3a3a] text-[#8a8a8a] text-[9px] uppercase tracking-widest';

interface MemoryEntryCardProps {
  memory: Memory;
  now: number;
  openedMemoryIds: number[];
  formatDate: (isoString: string) => string;
  formatEntryId: (id: number) => string;
  onOpenMemory: (memory: Memory) => void;
}

export const MemoryEntryCard: React.FC<MemoryEntryCardProps> = ({
  memory,
  now,
  openedMemoryIds,
  formatDate,
  formatEntryId,
  onOpenMemory,
}) => {
  const stampId = formatEntryId(memory.id);
  const createdStr = formatDate(memory.createdAt);
  const unlockStr = formatDate(memory.unlockAt);
  const isOpenedInSession = openedMemoryIds.includes(memory.id);

  if (memory.unlocked) {
    const hasBeenReadBefore = Boolean(memory.firstReadAt) || isOpenedInSession;
    const preview = memory.content
      ? memory.content.length > 90
        ? memory.content.slice(0, 90) + '...'
        : memory.content
      : '';

    return (
      <div
        className="bg-[#111111] border border-[#262626] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:border-[#4A5D4E]/50 group"
      >
        <div className="space-y-1.5 font-mono text-xs max-w-xl">
          <div className="flex items-center gap-2">
            <span className="text-[#a3a3a3] font-semibold text-[11px] tracking-wider">
              ENTRY {stampId}
            </span>
            <span className={AWAKENED_BADGE}>
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
          onClick={() => onOpenMemory(memory)}
          className="self-start sm:self-center px-4 py-2 bg-[#171717] hover:bg-[#222222] border border-[#333333] hover:border-[#4A5D4E] text-[#f3f4f6] font-mono text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap shadow-sm group-hover:border-[#4A5D4E]"
        >
          <span>{!hasBeenReadBefore ? 'Open Memory' : 'Read Memory'}</span>
          <span className="text-[#4A5D4E] transition-transform group-hover:translate-x-0.5">→</span>
        </button>
      </div>
    );
  }

  const daysLeft = calculateDaysLeft(memory.unlockAt, now);

  return (
    <div className="bg-[#0e0e0e] border border-[#1f1f1f] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-xs transition-colors hover:border-[#2a2a2a]">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-[#a3a3a3] font-semibold text-[11px] tracking-wider">
            ENTRY {stampId}
          </span>
          <span className={SLEEPING_BADGE}>
            Sleeping
          </span>
        </div>
        <div className="text-[11px] text-[#737373]">
          Sealed {createdStr} • Awakens {unlockStr}
        </div>
      </div>

      <div className="text-[#607864] text-[11px] tracking-wider uppercase font-mono self-start sm:self-center">
        Awakens in {daysLeft} {daysLeft === 1 ? 'day' : 'days'}
      </div>
    </div>
  );
};
