import React from 'react';
import { Footer } from './Footer';
import { TopBar } from './TopBar';

interface PageShellProps {
  title: string;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  isLoggedIn: boolean;
  onGoHome: () => void;
  onNavigateTerms?: () => void;
  onNavigatePrivacy?: () => void;
  onNavigateAbout?: () => void;
  children: React.ReactNode;
}

export const PageShell: React.FC<PageShellProps> = ({
  title,
  subtitle,
  right,
  isLoggedIn,
  onGoHome,
  onNavigateTerms,
  onNavigatePrivacy,
  onNavigateAbout,
  children,
}) => {
  return (
    <div className="min-h-screen bg-[#080808] text-[#D1D1D1] p-6 sm:p-12 lg:p-16 max-w-4xl mx-auto space-y-12 font-serif animate-fade-in">
      {/* Top bar */}
      <TopBar
        left={
          <button
            onClick={onGoHome}
            className="text-[#a3a3a3] hover:text-[#e5e5e5] transition-colors cursor-pointer uppercase tracking-widest"
          >
            {isLoggedIn ? '← Return to your archive' : '← Return Home'}
          </button>
        }
        right={<span className="uppercase tracking-[0.2em] text-[10px]">{title}</span>}
      />

      {/* Main Card */}
      <div className="bg-[#111111] border border-[#262626] p-8 space-y-6 shadow-2xl">
        {/* Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#262626] pb-6">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl text-white font-light uppercase tracking-[0.2em]">
              {title}
            </h1>
            {subtitle && (
              <div className="text-xs text-[#737373] font-serif italic leading-relaxed">{subtitle}</div>
            )}
          </div>
          {right && <div className="flex flex-col sm:items-end gap-2">{right}</div>}
        </div>

        {children}

        <Footer
          onGoHome={onGoHome}
          onNavigateTerms={onNavigateTerms}
          onNavigatePrivacy={onNavigatePrivacy}
          onNavigateAbout={onNavigateAbout}
          isLoggedIn={isLoggedIn}
        />
      </div>
    </div>
  );
};
