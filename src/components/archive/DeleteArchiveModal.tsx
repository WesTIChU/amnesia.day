import React from 'react';

interface DeleteArchiveModalProps {
  show: boolean;
  confirmKeyInput: string;
  deleteError: string;
  isDeleting: boolean;
  onConfirmInputChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
}

export const DeleteArchiveModal: React.FC<DeleteArchiveModalProps> = ({
  show,
  confirmKeyInput,
  deleteError,
  isDeleting,
  onConfirmInputChange,
  onClose,
  onSubmit,
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden overscroll-contain bg-[#080808]/90 backdrop-blur-sm">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="bg-[#121212] border border-[#262626] max-w-md w-full min-w-0 p-6 sm:p-8 space-y-6 font-serif max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain">
          <div className="space-y-2">
            <h3 className="text-lg font-light text-[#f87171] uppercase tracking-widest">
              Delete Archive
            </h3>
            <p className="text-xs text-[#a3a3a3] leading-relaxed">
              This action is irreversible. Every memory in this archive will be permanently destroyed and the Memory Key will be permanently retired.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2 font-mono text-xs">
              <label className="text-[#737373] block text-[10px] uppercase">
                Type DELETE to Confirm
              </label>
              <input
                type="text"
                value={confirmKeyInput}
                onChange={(e) => onConfirmInputChange(e.target.value)}
                placeholder="DELETE"
                className="w-full px-4 py-3 bg-[#080808] border border-[#262626] focus:border-[#f87171] text-[#e5e5e5] text-xs outline-none"
              />
            </div>

            {deleteError && (
              <p className="font-mono text-xs text-[#f87171]">{deleteError}</p>
            )}

            <div className="flex items-center gap-3 pt-2 font-mono text-xs">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 border border-[#262626] text-[#737373] hover:text-[#e5e5e5] cursor-pointer uppercase"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isDeleting || confirmKeyInput.trim() !== 'DELETE'}
                className="flex-1 py-3 bg-[#f87171]/10 hover:bg-[#f87171]/20 text-[#f87171] border border-[#f87171]/30 disabled:opacity-30 uppercase tracking-wider transition-colors cursor-pointer"
              >
                {isDeleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
