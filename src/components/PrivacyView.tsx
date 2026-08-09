import React from 'react';
import { PageShell } from './PageShell';

interface PrivacyViewProps {
  isLoggedIn: boolean;
  onGoHome: () => void;
  onNavigateTerms?: () => void;
  onNavigatePrivacy?: () => void;
  onNavigateAbout?: () => void;
}

export const PrivacyView: React.FC<PrivacyViewProps> = ({
  isLoggedIn,
  onGoHome,
  onNavigateTerms,
  onNavigatePrivacy,
  onNavigateAbout,
}) => (
  <PageShell
    title="Privacy Policy"
    subtitle="Zero Personal Data • Confidential by Design"
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
          <span>1. Zero Personal Data Collection</span>
        </h2>
        <p>
          Amnesia does not require names, email addresses, phone numbers, or advertising profiles. You access your archive with a Recovery Phrase, and signing up takes under five seconds without any personal information.
        </p>
      </section>

      <section className="space-y-3 border-t border-[#262626] pt-6">
        <h2 className="flex items-center gap-2 text-xs text-[#e5e5e5] uppercase tracking-widest font-mono">
          <span className="w-2 h-2 rounded-full bg-[#4A5D4E]"></span>
          <span>2. Cookies</span>
        </h2>
        <p>
          Amnesia sets two strictly necessary first-party cookies. <code className="font-mono text-[#888888]">amnesia_session</code> is an HttpOnly session token that identifies your open archive, and <code className="font-mono text-[#888888]">amnesia_csrf</code> protects against cross-site request forgery. Both are used only for archive security - never for analytics or advertising - and currently expire after 24 hours.
        </p>
      </section>

      <section className="space-y-3 border-t border-[#262626] pt-6">
        <h2 className="flex items-center gap-2 text-xs text-[#e5e5e5] uppercase tracking-widest font-mono">
          <span className="w-2 h-2 rounded-full bg-[#4A5D4E]"></span>
          <span>3. Connection Data</span>
        </h2>
        <p>
          Amnesia does not intentionally persist visitor IP addresses. The site is delivered through Cloudflare, which necessarily processes connection information such as IP addresses and request metadata to route, deliver, and protect the service. Amnesia itself does not log or store this information.
        </p>
      </section>

      <section className="space-y-3 border-t border-[#262626] pt-6">
        <h2 className="flex items-center gap-2 text-xs text-[#e5e5e5] uppercase tracking-widest font-mono">
          <span className="w-2 h-2 rounded-full bg-[#4A5D4E]"></span>
          <span>4. Content Encryption & Release</span>
        </h2>
        <p>
          Your submitted notes and memories are encrypted in your browser with AES-256-GCM before they reach the server, so Amnesia stores only ciphertext and never intentionally receives or stores plaintext. Your Recovery Phrase is never stored by Amnesia, and for V2 memories the server cannot read a memory without it. Memories are held by the server until the same UTC date and time one calendar year later; the server then releases the material needed to decrypt them, and availability begins after the next Timekeeper run. This release is enforced by the Amnesia server and controls the normal archive interface - it is not a cryptographic guarantee that the words were never known to anyone.
        </p>
      </section>

      <section className="space-y-3 border-t border-[#262626] pt-6">
        <h2 className="flex items-center gap-2 text-xs text-[#e5e5e5] uppercase tracking-widest font-mono">
          <span className="w-2 h-2 rounded-full bg-[#4A5D4E]"></span>
          <span>5. Third-Party Analytics & Advertising</span>
        </h2>
        <p>
          Amnesia contains zero third-party tracking scripts, zero advertising pixels, zero analytics SDKs, and zero social media trackers. Fonts are served from Amnesia's own server, so nothing is fetched from a third party.
        </p>
      </section>

      <section className="space-y-3 border-t border-[#262626] pt-6">
        <h2 className="flex items-center gap-2 text-xs text-[#e5e5e5] uppercase tracking-widest font-mono">
          <span className="w-2 h-2 rounded-full bg-[#4A5D4E]"></span>
          <span>6. Data Deletion</span>
        </h2>
        <p>
          Deleting an archive removes it and its memories from the live database and retires its Recovery Phrase identifier. Encrypted remnants may persist temporarily in SQLite WAL/storage or in backups until those copies are overwritten or expire.
        </p>
      </section>
    </main>
  </PageShell>
);
