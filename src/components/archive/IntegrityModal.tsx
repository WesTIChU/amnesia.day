import React from 'react';

interface IntegrityModalProps {
  show: boolean;
  lastVerifiedAt: string | null;
  archiveSizeBytes: number | undefined;
  isTimekeeperAwakening: boolean;
  onClose: () => void;
}

const formatLastVerified = (iso: string | null): string => {
  if (!iso) return 'Not yet run';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  const now = new Date();
  const sameDay =
    date.getUTCFullYear() === now.getUTCFullYear() &&
    date.getUTCMonth() === now.getUTCMonth() &&
    date.getUTCDate() === now.getUTCDate();
  const time = date.toISOString().slice(11, 16);
  if (sameDay) return `Today ${time} UTC`;
  return `${date.toISOString().slice(0, 10)} ${time} UTC`;
};

export const IntegrityModal: React.FC<IntegrityModalProps> = ({
  show,
  lastVerifiedAt,
  archiveSizeBytes,
  isTimekeeperAwakening,
  onClose,
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden overscroll-contain bg-[#080808]/90 backdrop-blur-sm">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="bg-[#121212] border border-[#262626] max-w-sm w-full min-w-0 p-6 space-y-6 font-mono text-xs animate-fade-in shadow-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain">
          <div className="space-y-1 border-b border-[#262626] pb-3 text-center">
            <h3 className="text-xs font-light text-white uppercase tracking-[0.2em]">Archive Integrity</h3>
            <p className="text-[10px] text-[#737373]">Verification Protocol & System Health</p>
          </div>

          <div className="space-y-3 bg-[#080808] p-4 border border-[#262626] text-xs">
            <div className="flex justify-between items-center">
              <span className="text-[#737373] text-[10px] uppercase">Archive Status</span>
              <span className="text-[#4A5D4E] font-medium uppercase">Encrypted</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#737373] text-[10px] uppercase">Vault Health</span>
              <span className="text-[#e5e5e5]">Healthy</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#737373] text-[10px] uppercase">Archive Engine</span>
              <span className="text-[#e5e5e5]">SQLite</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#737373] text-[10px] uppercase">Last Verified</span>
              <span className="text-[#a3a3a3]">
                {lastVerifiedAt ? formatLastVerified(lastVerifiedAt) : 'Verifying...'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#737373] text-[10px] uppercase">Archive Size</span>
              <span className="text-[#a3a3a3]">
                {archiveSizeBytes ? `${(archiveSizeBytes / 1024).toFixed(1)} KB` : '0 KB'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#737373] text-[10px] uppercase">Timekeeper</span>
              <span className="text-[#4A5D4E]">{isTimekeeperAwakening ? 'Awakening...' : 'Healthy'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#737373] text-[10px] uppercase">Version</span>
              <span className="text-[#a3a3a3]">1.0.0</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#737373] text-[10px] uppercase">Build</span>
              <span className="text-[#a3a3a3]">2026.08.07</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full py-2.5 border border-[#262626] text-[#737373] hover:text-[#e5e5e5] uppercase tracking-widest text-[11px] cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
