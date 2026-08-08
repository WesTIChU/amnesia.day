import React from 'react';
import { Footer } from './Footer';
import { AmnesiaLogo } from './AmnesiaLogo';

interface PrivacyViewProps {
  onGoHome: () => void;
  onNavigateTerms?: () => void;
  onNavigatePrivacy?: () => void;
  onNavigateAbout?: () => void;
}

export const PrivacyView: React.FC<PrivacyViewProps> = ({
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
            Privacy Policy
          </h1>
          <p className="text-xs text-[#737373] tracking-widest uppercase">
            Zero Personal Data • Confidential by Design
          </p>
        </header>

        <main className="space-y-8 text-xs text-[#a3a3a3] leading-relaxed border-t border-b border-[#1f1f1f] py-8">
          <section className="space-y-2">
            <h2 className="text-white text-xs tracking-wider uppercase font-semibold">1. Zero Personal Data Collection</h2>
            <p>
              Amnesia collects no names, email addresses, phone numbers, IP tracking logs, cookies, or device telemetry. Signing up requires zero personal information and takes under five seconds.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-white text-xs tracking-wider uppercase font-semibold">2. Content Encryption</h2>
            <p>
              Your submitted notes and memories are stored in an encrypted database vault. Messages remain sealed in time-locked containers until 365 days have passed from the time of submission.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-white text-xs tracking-wider uppercase font-semibold">3. Third-Party Analytics & Advertising</h2>
            <p>
              Amnesia contains zero third-party tracking scripts, zero advertising pixels, zero analyticsSDKs, and zero social media trackers. Your session is completely isolated.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-white text-xs tracking-wider uppercase font-semibold">4. Data Deletion</h2>
            <p>
              You maintain full control over your vault. Entering your Memory Key allows you to permanently destroy your entire archive at any time with zero residual copies.
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
