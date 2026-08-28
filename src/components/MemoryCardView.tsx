import React, { useState } from 'react';
import { AmnesiaLogo } from './AmnesiaLogo';

interface MemoryCardViewProps {
  memoryKey: string;
  createdAt: string;
  onEnterArchive: (key: string) => void;
  onGoHome: () => void;
}

export const MemoryCardView: React.FC<MemoryCardViewProps> = ({
  memoryKey,
  onEnterArchive,
}) => {
  const [copied, setCopied] = useState(false);
  const keyParts = memoryKey.split('-');
  const isV2Key = keyParts.length >= 7;
  const displayWords = isV2Key ? keyParts.slice(0, 6) : keyParts;
  const displayGroups = Array.from({ length: Math.ceil(displayWords.length / 2) }, (_, index) =>
    displayWords.slice(index * 2, index * 2 + 2).join('-'),
  );
  const technicalIdentifier = isV2Key ? keyParts.slice(6).join('-') : null;

  const handleCopy = () => {
    navigator.clipboard.writeText(memoryKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#080808] text-[#D1D1D1] flex flex-col items-center justify-center p-6 sm:p-12 font-serif animate-fade-in select-none">
      {/* Printable Card Container */}
      <div className="printable-card w-full max-w-lg bg-[#111111] border border-[#262626] p-8 sm:p-12 text-center space-y-8 shadow-2xl relative">
        <div className="space-y-3">
          <div className="flex justify-center">
            <AmnesiaLogo size="small" />
          </div>
          <div className="h-[1px] w-8 bg-[#4A5D4E] mx-auto"></div>
          <p className="text-[10px] sm:text-[11px] font-mono tracking-[0.3em] uppercase text-[#737373]">
            YOUR MEMORY KEY
          </p>
          <div className="h-[1px] w-8 bg-[#4A5D4E] mx-auto"></div>
        </div>

        {/* The Key */}
        <div className="py-6 px-4 bg-[#080808] border border-[#262626] rounded-sm select-all space-y-3">
          <div className="text-[10px] uppercase tracking-[0.25em] text-[#737373]">Recovery Phrase</div>
          <div className="flex flex-col items-center gap-1 text-base sm:text-xl font-mono text-[#f3f4f6] tracking-wider">
            {displayGroups.map((group, index) => (
              <span key={`${group}-${index}`} className="whitespace-nowrap">{group}{index < displayGroups.length - 1 ? '-' : ''}</span>
            ))}
          </div>
          {technicalIdentifier && (
            <>
            <div className="print-only text-[10px] text-[#525252] break-all">Archive Identifier: {technicalIdentifier}</div>
            </>
          )}
        </div>

        {/* The Oath / Statement */}
        <div className="space-y-3 text-sm sm:text-base font-serif italic text-[#a3a3a3] leading-relaxed">
          <p className="text-[#e5e5e5] not-italic text-sm">No email. No password. Only this recovery phrase can open your archive.</p>
          <div className="border border-[#4A5D4E]/40 bg-[#4A5D4E]/10 rounded-sm px-4 py-3 space-y-1">
            <p className="text-[#e5e5e5] not-italic text-base font-semibold tracking-wide">This key exists only once.</p>
            <p className="text-[#a3a3a3] not-italic text-sm">Keep it safe. Save it in your password manager, print a copy, or write it down somewhere secure.</p>
          </div>
        </div>

        {/* The Privacy Promise */}
        <div className="border-t border-[#262626] pt-4 text-center font-mono text-xs text-[#8a8a8a] tracking-widest uppercase">
          <p>Zero Data Collected</p>
          <p className="text-[#737373] not-italic normal-case tracking-normal font-sans leading-snug">Your memory is encrypted in your browser. Amnesia stores nothing about you.</p>
        </div>

        {/* The Three Actions Only */}
        <div className="no-print -mt-4 pt-4 border-t border-[#262626] space-y-3 font-mono text-xs">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={handleCopy}
              className="w-full sm:w-auto px-6 py-3 bg-[#171717] hover:bg-[#262626] text-[#e5e5e5] border border-[#262626] transition-colors cursor-pointer uppercase tracking-wider"
            >
              {copied ? '✓ Memory Key copied' : 'Copy Memory Key'}
            </button>
            <button
              onClick={handlePrint}
              className="w-full sm:w-auto px-6 py-3 bg-[#171717] hover:bg-[#262626] text-[#e5e5e5] border border-[#262626] transition-colors cursor-pointer uppercase tracking-wider"
            >
              Print Recovery Card
            </button>
          </div>
          <button
            onClick={() => onEnterArchive(memoryKey)}
            className="w-full px-8 py-3 bg-[#4A5D4E] hover:bg-[#3d4f41] text-[#f3f4f6] font-medium transition-colors cursor-pointer uppercase tracking-wider"
          >
            I've Saved My Key →
          </button>
        </div>

        <div className="no-print text-center">
          <p className="text-[#8a8a8a] font-sans text-[11px] not-italic uppercase tracking-widest">Lost recovery phrases cannot be recovered.</p>
        </div>
      </div>
    </div>
  );
};
