import React from 'react';

interface ReviewModalProps {
  show: boolean;
  memoryText: string;
  isSubmitting: boolean;
  targetUnlockDate: string;
  onEdit: () => void;
  onSeal: () => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({
  show,
  memoryText,
  isSubmitting,
  targetUnlockDate,
  onEdit,
  onSeal,
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden overscroll-contain bg-[#080808]/90 backdrop-blur-sm">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="bg-[#121212] border border-[#262626] max-w-xl w-full min-w-0 p-6 sm:p-10 space-y-6 font-serif shadow-2xl animate-fade-in max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain">
          <div className="space-y-2 text-center border-b border-[#262626] pb-4">
            <h3 className="text-xl font-light text-white uppercase tracking-[0.2em]">
              Review your memory one final time
            </h3>
            <p className="text-xs font-mono text-[#a0a0a0] pt-2 leading-relaxed">
              Once sealed it cannot be changed or read again until{' '}
              <span className="text-[#4A5D4E] font-medium">{targetUnlockDate}</span>
            </p>
          </div>

          <div className="p-6 bg-[#080808] border border-[#262626] text-[#f3f4f6] text-base leading-relaxed font-serif whitespace-pre-wrap max-h-60 overflow-y-auto">
            {memoryText}
          </div>

          <div className="text-center font-mono text-[10px] text-[#737373] tracking-wider uppercase space-y-1">
            <div>Every memory is encrypted before it is archived.</div>
            <div>Your Memory Key is never stored. We cannot recover lost Memory Keys.</div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 font-mono text-xs pt-2">
            <button
              type="button"
              onClick={onEdit}
              className="w-full sm:w-1/2 py-3.5 border border-[#262626] text-[#737373] hover:text-[#e5e5e5] cursor-pointer uppercase tracking-widest transition-colors"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={onSeal}
              disabled={isSubmitting}
              className="w-full sm:w-1/2 py-3.5 bg-[#4A5D4E] hover:bg-[#3d4f41] text-[#f3f4f6] cursor-pointer uppercase tracking-widest transition-colors shadow-lg font-medium"
            >
              {isSubmitting ? 'Sealing...' : 'Seal Forever'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
