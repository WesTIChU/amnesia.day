import React from 'react';
import { PageShell } from './PageShell';

interface TermsViewProps {
  isLoggedIn: boolean;
  onGoHome: () => void;
  onNavigateTerms?: () => void;
  onNavigatePrivacy?: () => void;
  onNavigateAbout?: () => void;
}

export const TermsView: React.FC<TermsViewProps> = ({
  isLoggedIn,
  onGoHome,
  onNavigateTerms,
  onNavigatePrivacy,
  onNavigateAbout,
}) => (
  <PageShell
    title="Terms of Service"
    subtitle="Effective Date: August 2026 • Amnesia Vault Protocol"
    isLoggedIn={isLoggedIn}
    onGoHome={onGoHome}
    onNavigateTerms={onNavigateTerms}
    onNavigatePrivacy={onNavigatePrivacy}
    onNavigateAbout={onNavigateAbout}
  >
    <main className="space-y-6 font-serif text-sm text-[#a3a3a3] leading-[1.85]">
      <section className="space-y-3 border-t border-[#262626] pt-6">
        <h2 className="flex items-center gap-2 text-xs text-[#e5e5e5] uppercase tracking-widest font-mono">
          <span className="w-2 h-2 rounded-full bg-[#4A5D4E]"></span>
          <span>1. Zero-Account Protocol</span>
        </h2>
        <p>
          Amnesia operates without personal accounts, email registration, passwords, or identity tracking. Access to your vault is authenticated strictly through your Recovery Phrase.
        </p>
      </section>

      <section className="space-y-3 border-t border-[#262626] pt-6">
        <h2 className="flex items-center gap-2 text-xs text-[#e5e5e5] uppercase tracking-widest font-mono">
          <span className="w-2 h-2 rounded-full bg-[#4A5D4E]"></span>
          <span>2. Key Responsibility</span>
        </h2>
        <p>
          For V2 archives, your Recovery Phrase is the sole cryptographic unlock mechanism. If you lose it, there is no password reset or recovery bypass that can reconstruct it. Legacy V1 archives remain decryptable using the server-held legacy master key.
        </p>
      </section>

      <section className="space-y-3 border-t border-[#262626] pt-6">
        <h2 className="flex items-center gap-2 text-xs text-[#e5e5e5] uppercase tracking-widest font-mono">
          <span className="w-2 h-2 rounded-full bg-[#4A5D4E]"></span>
          <span>3. One-Year Release</span>
        </h2>
        <p>
          Memories committed to Amnesia are encrypted in your browser and held by the server until the same UTC date and time one calendar year later. The server withholds the material needed to decrypt a memory until its scheduled release date, availability begins after the next Timekeeper run, and Amnesia will not show a memory through its own interface before then. This release is enforced by the Amnesia server, not by cryptography alone: it does not prevent anyone who knows your Recovery Phrase, or who kept the words on their own device before sealing, from reading a memory at any time.
        </p>
      </section>

      <section className="space-y-3 border-t border-[#262626] pt-6">
        <h2 className="flex items-center gap-2 text-xs text-[#e5e5e5] uppercase tracking-widest font-mono">
          <span className="w-2 h-2 rounded-full bg-[#4A5D4E]"></span>
          <span>4. Acceptable Use</span>
        </h2>
        <p>
          Amnesia is a quiet time capsule intended for personal reflections, letters to your future self, and thoughts left behind. Do not store illegal materials, automated bot data, or malicious content.
        </p>
      </section>

      <section className="space-y-3 border-t border-[#262626] pt-6">
        <h2 className="flex items-center gap-2 text-xs text-[#e5e5e5] uppercase tracking-widest font-mono">
          <span className="w-2 h-2 rounded-full bg-[#4A5D4E]"></span>
          <span>5. Service Availability</span>
        </h2>
        <p>
          Amnesia is maintained as a quiet, durable self-hosted utility. The service is provided as-is without commercial guarantees.
        </p>
      </section>
    </main>
  </PageShell>
);
