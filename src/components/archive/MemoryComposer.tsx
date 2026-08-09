import React from 'react';

interface MemoryComposerProps {
  memoryText: string;
  hasWrittenToday: boolean;
  hasDraftPrompt: boolean;
  isSubmitting: boolean;
  submitError: string;
  onTextChange: (value: string) => void;
  onContinueDraft: () => void;
  onDiscardDraft: () => void;
  onSubmit: (event: React.FormEvent) => void;
}

export const MemoryComposer: React.FC<MemoryComposerProps> = ({
  memoryText,
  hasWrittenToday,
  hasDraftPrompt,
  isSubmitting,
  submitError,
  onTextChange,
  onContinueDraft,
  onDiscardDraft,
  onSubmit,
}) => {
  return (
    <div className="bg-[#111111] border border-[#262626] p-6 sm:p-8 space-y-6">
      <div className="border-b border-[#262626] pb-4 flex justify-between items-baseline">
        <h2 className="text-lg font-light text-[#e5e5e5] tracking-widest uppercase">
          Seal A Memory
        </h2>
        <span className="font-mono text-[10px] text-[#888888] uppercase tracking-wider">
          1 Memory per day limit
        </span>
      </div>

      {hasWrittenToday ? (
        <div className="p-6 bg-[#080808] border border-[#262626] text-center space-y-2">
          <p className="font-serif italic text-base text-[#e5e5e5]">
            Today's memory has been safely archived.
          </p>
          <p className="font-mono text-xs text-[#888888]">
            Return tomorrow to leave another memory behind.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {hasDraftPrompt && (
            <div className="p-4 bg-[#171717] border border-[#4A5D4E]/40 text-xs font-mono flex flex-col sm:flex-row justify-between items-center gap-3">
              <span className="text-[#e5e5e5]">An unfinished memory was found on this device.</span>
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={onContinueDraft}
                  className="flex-1 sm:flex-none px-4 py-2 bg-[#4A5D4E] hover:bg-[#3d4f41] text-[#f3f4f6] uppercase tracking-wider cursor-pointer"
                >
                  Continue
                </button>
                <button
                  onClick={onDiscardDraft}
                  className="flex-1 sm:flex-none px-4 py-2 border border-[#262626] text-[#737373] hover:text-[#e5e5e5] uppercase tracking-wider cursor-pointer"
                >
                  Discard
                </button>
              </div>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="relative">
              <textarea
                value={memoryText}
                onChange={(e) => onTextChange(e.target.value)}
                placeholder="Leave something behind..."
                rows={6}
                className="w-full bg-[#080808] border border-[#262626] focus:border-[#4A5D4E] p-5 text-[#e5e5e5] font-serif text-base leading-relaxed placeholder-[#525252] outline-none transition-colors resize-none"
              />
              <div className="absolute bottom-3 right-4 font-mono text-[10px] text-[#737373]">
                {memoryText.length} / 2000
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <span className="font-mono text-[10px] text-[#737373] tracking-wide italic">
                Drafts are kept in this browser tab only and are cleared when the tab closes, or when you seal, discard, or sign out.
              </span>

              <button
                type="submit"
                disabled={isSubmitting || !memoryText.trim()}
                className="w-full sm:w-auto px-8 py-3.5 bg-[#4A5D4E] hover:bg-[#3d4f41] text-[#f3f4f6] disabled:opacity-40 font-mono text-xs uppercase tracking-[0.2em] transition-all cursor-pointer shadow-lg"
              >
                Seal Memory
              </button>
            </div>

            {submitError && (
              <p className="font-mono text-xs text-[#f87171] pt-2">{submitError}</p>
            )}
          </form>
        </div>
      )}
    </div>
  );
};
