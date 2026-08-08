import React, { useEffect, useState } from 'react';
import { ArchiveStats, MachineMetrics } from '../types';
import { ambientSound } from '../lib/audio';
import { AmnesiaLogo } from './AmnesiaLogo';

interface HomeViewProps {
  onCreateKey: () => void;
  isCreatingKey?: boolean;
  onOpenArchiveModal: () => void;
  onReturnToArchive?: () => void;
  hasActiveSession?: boolean;
  onNavigateMachine: () => void;
  onNavigateTerms?: () => void;
  onNavigatePrivacy?: () => void;
  onNavigateAbout?: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onCreateKey,
  isCreatingKey = false,
  onOpenArchiveModal,
  onReturnToArchive,
  hasActiveSession = false,
  onNavigateMachine,
  onNavigateTerms,
  onNavigatePrivacy,
  onNavigateAbout,
}) => {
  const [stats, setStats] = useState<ArchiveStats | null>(null);
  const [machineStats, setMachineStats] = useState<MachineMetrics | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isMidnightActive, setIsMidnightActive] = useState(false);

  useEffect(() => {
    fetch('/api/stats')
      .then((res) => {
        if (!res.ok) throw new Error(`Stats request failed: ${res.status}`);
        return res.json();
      })
      .then((data: unknown) => {
        if (
          data &&
          typeof data === 'object' &&
          typeof (data as ArchiveStats).archivesOpened === 'number' &&
          typeof (data as ArchiveStats).sleepingMemories === 'number' &&
          typeof (data as ArchiveStats).unlockedToday === 'number'
        ) {
          setStats(data as ArchiveStats);
        }
      })
      .catch(() => {});

    fetch('/api/machine')
      .then((res) => {
        if (!res.ok) throw new Error(`Machine request failed: ${res.status}`);
        return res.json();
      })
      .then((data: unknown) => {
        if (data && typeof data === 'object') {
          setMachineStats(data as MachineMetrics);
        }
      })
      .catch(() => {});

    // Check if near midnight or simulate midnight timekeeper event
    const now = new Date();
    const hours = now.getHours();
    if (hours === 0 || hours === 23) {
      setIsMidnightActive(true);
    }
  }, []);

  const toggleAmbience = () => {
    const active = ambientSound.toggle();
    setIsAudioPlaying(active);
  };

  return (
    <div className="relative min-h-screen bg-[#080808] text-[#D1D1D1] flex flex-col justify-between p-6 sm:p-12 lg:p-20 font-serif overflow-x-hidden transition-opacity duration-1000 ease-out animate-fade-in">
      {/* Subtle Visual Grid Lines */}
      <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-white/[0.02] pointer-events-none"></div>
      <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-white/[0.02] pointer-events-none"></div>

      {/* Top Header Navigation & Ambience Toggle */}
      <div className="relative z-10 flex justify-between items-center text-[10px] sm:text-[11px] tracking-[0.2em] uppercase font-mono text-[#737373]">
        <div className="flex items-center gap-3">
          <span className="w-1.5 h-1.5 bg-[#4A5D4E] rounded-full"></span>
          <span>Amnesia Vault</span>
        </div>

        <button
          onClick={toggleAmbience}
          className={`flex items-center gap-2 px-3 py-1.5 border transition-all cursor-pointer ${
            isAudioPlaying
              ? 'border-[#4A5D4E] text-[#4A5D4E] bg-[#4A5D4E]/10'
              : 'border-[#262626] text-[#737373] hover:text-[#e5e5e5]'
          }`}
        >
          <span>{isAudioPlaying ? '🔊' : '🔇'}</span>
          <span>Archive Ambience</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex-grow flex flex-col items-center justify-center text-center my-12 max-w-2xl mx-auto">
        <div className="mb-10">
          <div className="home-logo">
            <AmnesiaLogo size="large" />
          </div>
          <div className="h-[1px] w-12 bg-[#4A5D4E] mx-auto"></div>
        </div>

        {/* Poetic Tagline */}
        <div className="home-tagline space-y-3 mb-10">
          <p className="text-xl sm:text-[24px] font-light italic text-[#E5E5E5] leading-relaxed">
            Forget today. Remember next year.
          </p>
          <p className="text-sm font-mono text-[#A0A0A0] tracking-widest uppercase">
            Leave something behind • Read it in 365 days
          </p>
        </div>

        <p className="home-explainer max-w-md mb-8 text-sm sm:text-base font-serif italic text-[#858585] leading-relaxed">
          Write a memory. Seal it for 365 days. Only you can open it when it awakens.
        </p>

        {/* Action Buttons */}
        <div className="home-actions flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-sm sm:max-w-none mb-6">
          <button
            onClick={onCreateKey}
            disabled={isCreatingKey}
            className="w-full sm:w-auto px-10 py-4 border border-white/10 hover:border-white/30 transition-all bg-[#111111] hover:bg-[#1a1a1a] text-[#e5e5e5] text-[12px] sm:text-[13px] tracking-[0.2em] uppercase font-mono font-light cursor-pointer shadow-lg"
          >
            {isCreatingKey ? 'Creating...' : 'Create Memory Key'}
          </button>
          <button
            onClick={hasActiveSession && onReturnToArchive ? onReturnToArchive : onOpenArchiveModal}
            className="w-full sm:w-auto px-10 py-4 text-[#707070] text-[12px] tracking-[0.2em] uppercase font-mono font-light hover:text-[#D1D1D1] transition-colors cursor-pointer"
          >
            {hasActiveSession ? 'Return to Archive' : 'Open Archive'}
          </button>
        </div>

        {/* Free, Quick & Zero Personal Data Notice */}
        <div className="home-details mb-12 text-[10px] sm:text-[11px] font-mono text-[#737373] tracking-widest uppercase flex flex-wrap justify-center items-center gap-2">
          <span className="amnesia-detail">Takes ~5 seconds</span>
          <span className="text-white/20">•</span>
          <span className="amnesia-detail">Zero personal data</span>
          <span className="text-white/20">•</span>
          <span className="amnesia-detail">Free &amp; Encrypted</span>
        </div>

        {/* Tiny Homepage Public Numbers */}
        <div className="flex flex-wrap justify-center items-center gap-6 sm:gap-10 text-[11px] sm:text-[12px] font-mono text-[#666666] border-t border-b border-white/[0.04] py-4 w-full">
          <div>
            <span className="text-[#e5e5e5] font-medium">{stats?.archivesOpened.toLocaleString() ?? '18,481'}</span> Archives
          </div>
          <div className="text-white/10">•</div>
          <div>
            <span className="text-[#e5e5e5] font-medium">{stats?.sleepingMemories.toLocaleString() ?? '292,918'}</span> Memories Sleeping
          </div>
          <div className="text-white/10">•</div>
          <div>
            <span className="text-[#4A5D4E] font-medium">{stats?.unlockedToday.toLocaleString() ?? '183'}</span> Memories Awakened Today
          </div>
        </div>

        <p className="mt-5 max-w-xl text-base sm:text-lg font-serif italic text-[#8a8a8a] leading-relaxed">
          Every memory sleeps on a Raspberry Pi, quietly waiting for the day it should be remembered.
        </p>
      </div>

      {/* Quiet feature layer below the opening screen */}
      <section className="home-features relative z-10 w-full max-w-4xl mx-auto py-20 sm:py-28 border-t border-white/[0.06]" aria-labelledby="built-to-forget">
        <div className="max-w-xl mb-12">
          <p className="mb-4 text-[10px] font-mono tracking-[0.25em] uppercase text-[#4A5D4E]">Built to forget</p>
          <h2 id="built-to-forget" className="text-2xl sm:text-3xl font-light italic text-[#E5E5E5] leading-relaxed">
            Your memory, sealed.
          </h2>
        </div>

        <div className="grid gap-0 sm:grid-cols-2 border-t border-white/[0.06]">
          <article className="py-7 sm:pr-10 border-b sm:border-r border-white/[0.06]">
            <h3 className="mb-3 text-xs font-mono tracking-[0.18em] uppercase text-[#D1D1D1]">Locked until it awakens</h3>
            <p className="text-base text-[#858585] leading-relaxed">Once sealed, you can't reopen your memory until its anniversary. Not tomorrow. Not when curiosity gets the better of you.</p>
          </article>
          <article className="py-7 sm:pl-10 border-b border-white/[0.06]">
            <h3 className="mb-3 text-xs font-mono tracking-[0.18em] uppercase text-[#D1D1D1]">Unreadable by us</h3>
            <p className="text-base text-[#858585] leading-relaxed">Your memory is encrypted in your browser before it ever reaches Amnesia.</p>
          </article>
          <article className="py-7 sm:pr-10 border-b sm:border-b-0 sm:border-r border-white/[0.06]">
            <h3 className="mb-3 text-xs font-mono tracking-[0.18em] uppercase text-[#D1D1D1]">Your key stays yours</h3>
            <p className="text-base text-[#858585] leading-relaxed">Your Recovery Phrase is never stored by Amnesia. Without it, your memories cannot be decrypted.</p>
          </article>
          <article className="py-7 sm:pl-10">
            <h3 className="mb-3 text-xs font-mono tracking-[0.18em] uppercase text-[#D1D1D1]">No account required</h3>
            <p className="text-base text-[#858585] leading-relaxed">No name, email address, or personal profile. Your Recovery Phrase is your key.</p>
          </article>
        </div>

        <div className="mt-16 flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-t border-white/[0.06] pt-8">
          <p className="text-lg font-serif italic text-[#A0A0A0]">Leave something for your future self.</p>
          <button
            onClick={onCreateKey}
            disabled={isCreatingKey}
            className="self-start sm:self-auto px-6 py-3 border border-white/10 hover:border-white/30 transition-all bg-[#111111] hover:bg-[#1a1a1a] text-[#e5e5e5] text-[11px] tracking-[0.2em] uppercase font-mono cursor-pointer"
          >
            {isCreatingKey ? 'Creating...' : 'Create Memory Key'}
          </button>
        </div>
      </section>

      {/* Footer & Machine Telemetry */}
      <footer className="relative z-10 flex flex-col items-center border-t border-white/5 pt-8 pb-4 gap-6 font-mono text-[10px] tracking-[0.1em] text-[#737373] uppercase">
        {/* Navigation row: Terms, Privacy, About */}
        <div className="flex items-center justify-center gap-4 text-[#a3a3a3]">
          {onNavigateTerms && (
            <button onClick={onNavigateTerms} className="hover:text-white transition-colors cursor-pointer">
              Terms
            </button>
          )}
          <span className="text-white/10">•</span>
          {onNavigatePrivacy && (
            <button onClick={onNavigatePrivacy} className="hover:text-white transition-colors cursor-pointer">
              Privacy
            </button>
          )}
          {onNavigateAbout && (
            <>
              <span className="text-white/10">•</span>
              <button onClick={onNavigateAbout} className="hover:text-white transition-colors cursor-pointer">
                About
              </button>
            </>
          )}
          <span className="text-white/10">•</span>
          <a
            href="#"
            onClick={(event) => event.preventDefault()}
            className="hover:text-white transition-colors"
            aria-label="GitHub repository link coming soon"
          >
            GitHub
          </a>
        </div>

        {/* Bottom row: Machine status & Copyright */}
        <div className="w-full flex flex-col sm:flex-row justify-center items-center gap-3 text-[10px] text-[#777777]">
          <button
            onClick={onNavigateMachine}
            className="opacity-70 hover:opacity-100 hover:text-[#4A5D4E] transition-all cursor-pointer flex flex-wrap items-center gap-2"
          >
            <span>Running quietly on a Raspberry Pi Zero 2 WH • The Timekeeper</span>
            <span className="text-[#888888] font-mono border-l border-[#333333] pl-2">
              Load: {machineStats?.loadAverage.toFixed(2) ?? 'Unavailable'} • Temp: {machineStats?.tempCelsius == null ? 'Unavailable' : `${machineStats.tempCelsius}°C`}
            </span>
          </button>

          {/* Midnight awaken notice or node status */}
          {isMidnightActive && (
            <div className="flex flex-wrap justify-center sm:justify-end gap-6 opacity-80">
              <div className="text-[#4A5D4E] flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-[#4A5D4E] rounded-full"></span>
                The Timekeeper awakened. {stats?.unlockedToday || 183} memories unlocked.
              </div>
            </div>
          )}

        </div>

        <div className="text-center text-[10px] text-[#777777] tracking-widest">
          © {new Date().getFullYear()} AMNESIA.DAY
        </div>
      </footer>
    </div>
  );
};
