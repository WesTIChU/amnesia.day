import React from 'react';
import { Memory } from '../../types';
import { MemoryEntryCard } from './MemoryEntryCard';
import { previewVaultLists } from '../../lib/vaultList';

interface ArchiveIndexProps {
  memories: Memory[];
  now: number;
  openedMemoryIds: number[];
  formatDate: (isoString: string) => string;
  formatEntryId: (id: number) => string;
  onOpenMemory: (memory: Memory) => void;
  onNavigateCalendar: () => void;
  onNavigateEntries: () => void;
}

export const ArchiveIndex: React.FC<ArchiveIndexProps> = ({
  memories,
  now,
  openedMemoryIds,
  formatDate,
  formatEntryId,
  onOpenMemory,
  onNavigateCalendar,
  onNavigateEntries,
}) => {
  const awakened = memories.filter((m) => m.unlocked);
  const sleeping = memories.filter((m) => !m.unlocked);
  const preview = previewVaultLists(awakened, sleeping);

  return (
    <div className="space-y-8 pt-6">
      <div className="border-b border-[#262626] pb-3 flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-light text-white tracking-widest uppercase font-serif">
            Archive Index
          </h2>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto sm:justify-end">
          <span className="font-mono text-xs text-[#888888] uppercase tracking-wider">
            TIME LOCKED VAULT
          </span>
          <button
            onClick={onNavigateCalendar}
            className="flex-1 sm:flex-none px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition-colors cursor-pointer border border-[#262626] bg-[#0e0e0e] text-[#a3a3a3] hover:text-[#4A5D4E] hover:border-[#4A5D4E]/40"
          >
            Calendar →
          </button>
        </div>
      </div>

      {memories.length === 0 ? (
        <div className="py-12 px-6 text-center text-[#737373] font-serif italic text-sm border border-dashed border-[#262626] space-y-4">
          <div>The archive is waiting for its first memory.</div>
        </div>
      ) : (
        <div className="space-y-8">
          {preview.awakened.length > 0 && (
            <div className="space-y-4">
              <div className="font-mono text-xs text-[#a3a3a3] uppercase tracking-widest border-l-2 border-[#4A5D4E] pl-3 py-0.5">
                Awakened Memories ({awakened.length})
              </div>
              <div className="space-y-3">
                {preview.awakened.map((mem) => (
                  <MemoryEntryCard
                    key={mem.id}
                    memory={mem}
                    now={now}
                    openedMemoryIds={openedMemoryIds}
                    formatDate={formatDate}
                    formatEntryId={formatEntryId}
                    onOpenMemory={onOpenMemory}
                  />
                ))}
              </div>
            </div>
          )}

          {preview.sleeping.length > 0 && (
            <div className="space-y-4">
              <div className="font-mono text-xs text-[#888888] uppercase tracking-widest border-l-2 border-[#262626] pl-3 py-0.5">
                Sleeping Memories ({sleeping.length})
              </div>
              <div className="space-y-3">
                {preview.sleeping.map((mem) => (
                  <MemoryEntryCard
                    key={mem.id}
                    memory={mem}
                    now={now}
                    openedMemoryIds={openedMemoryIds}
                    formatDate={formatDate}
                    formatEntryId={formatEntryId}
                    onOpenMemory={onOpenMemory}
                  />
                ))}
              </div>
            </div>
          )}

          {preview.truncated && (
            <div className="text-center pt-2">
              <button
                onClick={onNavigateEntries}
                className="px-6 py-2.5 bg-[#181818] hover:bg-[#222222] border border-[#2a2a2a] text-[#a3a3a3] hover:text-white font-mono text-xs uppercase tracking-widest transition-colors cursor-pointer"
              >
                View all entries ({preview.total})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
