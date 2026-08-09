import React, { useEffect, useState } from 'react';
import { MachineMetrics } from '../types';

interface FooterProps {
  onNavigateMachine?: () => void;
  onGoHome?: () => void;
  onNavigateTerms?: () => void;
  onNavigatePrivacy?: () => void;
  onNavigateAbout?: () => void;
  isLoggedIn?: boolean;
}

export const Footer: React.FC<FooterProps> = ({
  onNavigateMachine,
  onGoHome,
  onNavigateTerms,
  onNavigatePrivacy,
  onNavigateAbout,
  isLoggedIn,
}) => {
  const [metrics, setMetrics] = useState<MachineMetrics | null>(null);

  useEffect(() => {
    fetch('/api/machine')
      .then((res) => res.json())
      .then((data) => setMetrics(data))
      .catch(() => {});
  }, []);

  return (
    <footer className="no-print pt-12 pb-8 text-center text-xs tracking-wider text-[#888888] font-mono border-t border-[#1f1f1f] flex flex-col gap-4 sm:gap-6">
      {/* Row 1 & 2: Nav Links (stacked on mobile) */}
      <div className="flex flex-col items-center justify-center gap-2 sm:flex-row sm:items-center sm:gap-4 text-[#a3a3a3] text-[11px]">
        <div className="flex items-center justify-center gap-4">
          {onNavigateTerms && (
            <button onClick={onNavigateTerms} className="hover:text-white transition-colors cursor-pointer">
              Terms
            </button>
          )}
          {onNavigateTerms && onNavigatePrivacy && <span className="text-white/10">•</span>}
          {onNavigatePrivacy && (
            <button onClick={onNavigatePrivacy} className="hover:text-white transition-colors cursor-pointer">
              Privacy
            </button>
          )}
          {(onNavigateTerms || onNavigatePrivacy) && onNavigateAbout && <span className="text-white/10">•</span>}
          {onNavigateAbout && (
            <button onClick={onNavigateAbout} className="hover:text-white transition-colors cursor-pointer">
              About
            </button>
          )}
        </div>

        <div className="flex items-center justify-center gap-4">
          <span className="hidden sm:inline text-white/10">•</span>
          <a href="/faq" className="hover:text-white transition-colors">
            FAQ
          </a>
          <span className="text-white/10">•</span>
          <a
            href="https://github.com/WesTIChU/amnesia.day"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
            aria-label="Amnesia source code on GitHub"
          >
            GitHub
          </a>
        </div>
      </div>

      {/* Row 3 & 4: Raspberry Pi sentence + stats (stacked on mobile) */}
      <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-3 text-[10px] text-[#777777]">
        {onNavigateMachine ? (
          <button
            onClick={onNavigateMachine}
            className="hover:text-[#4A5D4E] transition-colors focus:outline-none cursor-pointer uppercase inline-flex flex-col items-center gap-2 group sm:flex-row sm:items-center sm:gap-3"
          >
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-[#4A5D4E] rounded-full"></span>
              Running Quietly
            </span>
            <span>Raspberry Pi Zero 2 WH · Timekeeper Active</span>
            <span className="text-[#888888] font-mono sm:border-l sm:border-[#333333] sm:pl-2">
              Load {metrics?.loadAverage.toFixed(2) ?? 'Unavailable'} · Temp {metrics?.tempCelsius == null ? 'Unavailable' : `${metrics.tempCelsius}°C`}
            </span>
          </button>
        ) : onGoHome ? (
          <button
            onClick={onGoHome}
            className="hover:text-[#4A5D4E] transition-colors cursor-pointer text-[#a3a3a3] uppercase"
          >
            {isLoggedIn ? '← Return to your archive' : '← Return Home'}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-[#4A5D4E] rounded-full"></span>
            <span>
              Load {metrics?.loadAverage.toFixed(2) ?? 'Unavailable'} · Temp {metrics?.tempCelsius == null ? 'Unavailable' : `${metrics.tempCelsius}°C`}
            </span>
          </div>
        )}

      </div>

      {/* Copyright stays at the bottom edge of the footer. */}
      <div className="w-full text-center uppercase tracking-widest text-[10px] text-[#777777]">
        <div className="flex flex-col items-center justify-center gap-1 sm:flex-row sm:gap-2">
          <span>© {new Date().getFullYear()} AMNESIA.DAY</span>
          <span className="hidden sm:inline text-white/10">•</span>
          <span>Encrypted & Confidential</span>
        </div>
      </div>
    </footer>
  );
};
