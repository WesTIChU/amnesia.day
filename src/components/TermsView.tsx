import React from 'react';
import { Footer } from './Footer';
import { AmnesiaLogo } from './AmnesiaLogo';

interface TermsViewProps {
  onGoHome: () => void;
  onNavigateTerms?: () => void;
  onNavigatePrivacy?: () => void;
  onNavigateAbout?: () => void;
}

export const TermsView: React.FC<TermsViewProps> = ({
  onGoHome,
  onNavigateTerms,
  onNavigatePrivacy,
  onNavigateAbout,
}) => {
  const isLoggedIn = document.cookie.includes('amnesia_csrf=');

  return (
    <div className="min-h-screen bg-[#080808] text-[#e5e5e5] px-4 py-12 flex flex-col items-center justify-between font-mono">
      <div className="max-w-2xl w-full space-y-10">
        <header className="flex flex-col items-center text-center space-y-4">
          <AmnesiaLogo size="small" />
          <div className="h-[1px] w-12 bg-[#4A5D4E] my-2"></div>
          <h1 className="text-xl font-light tracking-[0.2em] text-white uppercase font-serif">
            Terms of Service
          </h1>
          <p className="text-xs text-[#737373] tracking-widest uppercase">
            Effective Date: August 2026 • Amnesia Vault Protocol
          </p>
        </header>

        <main className="space-y-8 text-xs text-[#a3a3a3] leading-relaxed border-t border-b border-[#1f1f1f] py-8">
          <section className="space-y-2">
            <h2 className="text-white text-xs tracking-wider uppercase font-semibold">1. Zero-Account Protocol</h2>
            <p>
              Amnesia operates without personal accounts, email registration, passwords, or identity tracking. Access to your vault is authenticated strictly through your Memory Key.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-white text-xs tracking-wider uppercase font-semibold">2. Key Responsibility</h2>
            <p>
              Your Memory Key is the sole cryptographic unlock mechanism for your stored memories. If you lose your Memory Key, your archive cannot be recovered by anyone-including the administrators of Amnesia.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-white text-xs tracking-wider uppercase font-semibold">3. One-Year Release</h2>
            <p>
              Memories committed to Amnesia are encrypted in your browser and held by the server until 365 calendar days have passed. The server withholds the material needed to decrypt a memory until its scheduled release date, and Amnesia will not show a memory through its own interface before then. This release is enforced by the Amnesia server, not by cryptography alone: it does not prevent anyone who knows your Recovery Phrase, or who kept the words on their own device before sealing, from reading a memory at any time.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-white text-xs tracking-wider uppercase font-semibold">4. Acceptable Use</h2>
            <p>
              Amnesia is a quiet time capsule intended for personal reflections, letters to your future self, and thoughts left behind. Do not store illegal materials, automated bot data, or malicious content.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-white text-xs tracking-wider uppercase font-semibold">5. Service Availability</h2>
            <p>
              Amnesia is maintained as a quiet, durable self-hosted utility. While data is backed up daily and verified for integrity, the service is provided as-is without commercial guarantees.
            </p>
          </section>
        </main>

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
