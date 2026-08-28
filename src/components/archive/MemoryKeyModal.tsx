import React from 'react';
import { AmnesiaLogo } from '../AmnesiaLogo';

interface MemoryKeyModalProps {
  show: boolean;
  recoveryGroups: string[];
  copiedKey: boolean;
  onCopyKey: () => void;
  onClose: () => void;
}

export const MemoryKeyModal: React.FC<MemoryKeyModalProps> = ({
  show,
  recoveryGroups,
  copiedKey,
  onCopyKey,
  onClose,
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden overscroll-contain bg-[#080808]/90 backdrop-blur-sm">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="bg-[#121212] border border-[#262626] max-w-md w-full min-w-0 p-6 sm:p-8 space-y-6 font-mono shadow-2xl animate-fade-in max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain">
          <div className="space-y-3 text-center border-b border-[#262626] pb-4">
            <div className="flex justify-center">
              <AmnesiaLogo size="small" />
            </div>
            <h3 className="text-sm font-light text-white uppercase tracking-[0.2em]">
              Your Memory Key
            </h3>
            <div className="border border-[#4A5D4E]/40 bg-[#4A5D4E]/10 rounded-sm px-3 py-2 space-y-1">
              <p className="text-white text-xs font-semibold tracking-wide">This key exists only once. Keep it safe.</p>
              <p className="text-[#9a9a9a] text-[10px] tracking-wide">
                Save it in your password manager, print a copy, or write it down.
              </p>
            </div>
          </div>

          <div className="p-4 bg-[#080808] border border-[#262626] text-center select-all space-y-3">
            <div className="text-[10px] uppercase tracking-[0.25em] text-[#737373]">Recovery Phrase</div>
            <div className="flex flex-col items-center gap-1 font-mono text-sm text-[#4A5D4E] font-semibold">
              {recoveryGroups.length > 0
                ? recoveryGroups.map((group, index) => <span key={`${group}-${index}`}>{group}{index < recoveryGroups.length - 1 ? '-' : ''}</span>)
                : <span className="text-[#737373]">Unavailable after session reload</span>}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCopyKey}
              className="flex-1 py-3 bg-[#4A5D4E] hover:bg-[#3d4f41] text-[#f3f4f6] text-xs uppercase tracking-widest transition-colors cursor-pointer"
            >
              {copiedKey ? 'Copied ✓' : 'Copy Key'}
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-3 border border-[#262626] text-[#737373] hover:text-[#e5e5e5] text-xs uppercase tracking-widest transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
