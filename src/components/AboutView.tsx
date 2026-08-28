import React, { useEffect } from 'react';
import { PageShell } from './PageShell';

interface AboutViewProps {
  isLoggedIn: boolean;
  onGoHome: () => void;
  onNavigateTerms?: () => void;
  onNavigatePrivacy?: () => void;
  onNavigateAbout?: () => void;
}

export const AboutView: React.FC<AboutViewProps> = ({
  isLoggedIn,
  onGoHome,
  onNavigateTerms,
  onNavigatePrivacy,
  onNavigateAbout,
}) => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <PageShell
      title="About Amnesia"
      subtitle={
        <>
          A Quiet Time Capsule<br />
          Forget today. Remember next year.
        </>
      }
      right={<div className="text-[10px] text-[#737373] tracking-widest uppercase">Free Forever</div>}
      isLoggedIn={isLoggedIn}
      onGoHome={onGoHome}
      onNavigateTerms={onNavigateTerms}
      onNavigatePrivacy={onNavigatePrivacy}
      onNavigateAbout={onNavigateAbout}
    >
      {/* Section Links */}
      <nav
        aria-label="About page sections"
        className="flex flex-wrap justify-center gap-x-6 gap-y-3 border-b border-[#262626] py-5 font-mono text-xs uppercase tracking-[0.14em] text-[#a3a3a3]"
      >
        <a href="#concept" className="hover:text-white transition-colors">Concept</a>
        <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
        <a href="#privacy" className="hover:text-white transition-colors">Privacy</a>
        <a href="#free" className="hover:text-white transition-colors">Why Free</a>
        <a href="#no-app" className="hover:text-white transition-colors">Why No App</a>
        <a href="#why-one-year" className="hover:text-white transition-colors">Why One Year</a>
        <a href="#promise" className="hover:text-white transition-colors">Our Promise</a>
      </nav>

      {/* Content */}
      <main className="space-y-6 font-serif">
        <section id="concept" className="about-section space-y-5 scroll-mt-6 border-t border-[#262626] pt-6">
          <h2 className="flex items-center gap-2 text-xs text-[#e5e5e5] uppercase tracking-widest font-mono">
            <span className="w-2 h-2 rounded-full bg-[#4A5D4E]"></span>
            <span><span className="text-[#4A5D4E] mr-2">01</span>The Concept</span>
          </h2>
          <p className="font-serif italic text-sm text-[#e5e5e5] leading-normal">
            "Most internet apps demand your immediate attention. Amnesia asks for your patience."
          </p>
          <p className="text-sm text-[#a3a3a3] leading-[1.85]">
            Amnesia is a quiet digital vault designed for personal notes, reflections, letters, and thoughts meant to be read one calendar year later. Once a memory is sealed it is encrypted in your browser and cannot be read again through the archive until the same UTC date and time one year later.
          </p>
        </section>

        <section id="how-it-works" className="about-section space-y-5 scroll-mt-6 border-t border-[#262626] pt-6">
          <h2 className="flex items-center gap-2 text-xs text-[#e5e5e5] uppercase tracking-widest font-mono">
            <span className="w-2 h-2 rounded-full bg-[#4A5D4E]"></span>
            <span><span className="text-[#4A5D4E] mr-2">02</span>How It Works</span>
          </h2>
          <ul className="space-y-4 text-sm text-[#a3a3a3] leading-[1.85]">
            <li className="pl-4 border-l border-[#4A5D4E]/50"><strong className="text-white font-normal">Recovery Phrase:</strong> Access is controlled by a unique Recovery Phrase. No email, username, or password required.</li>
            <li className="pl-4 border-l border-[#4A5D4E]/50"><strong className="text-white font-normal">Browser Encryption:</strong> Memories are encrypted in your browser before they reach Amnesia. The server stores only ciphertext and never sees the plaintext. Your Recovery Phrase is required to decrypt them.</li>
            <li className="pl-4 border-l border-[#4A5D4E]/50"><strong className="text-white font-normal">One-Year Release:</strong> Every submitted entry is timestamped and held by the server until the same UTC date and time one year later. The server withholds the material needed to decrypt a memory until its release date, and availability begins after the next Timekeeper run.</li>
            <li className="pl-4 border-l border-[#4A5D4E]/50"><strong className="text-white font-normal">Quiet Awakening:</strong> On its anniversary, the next Timekeeper run releases the memory so it can be read. A leap-year interval may span 366 days.</li>
          </ul>
          <p className="font-serif text-sm text-[#737373] leading-relaxed">
            The one-year wait is enforced by the Amnesia server, not by cryptography alone: Amnesia will not reveal a memory through its own interface before the release date. Because Amnesia delivers the browser code, this is not a claim of Signal-style end-to-end encryption against a malicious server. Anyone who knows your Recovery Phrase, or who kept the words on their own device before sealing, could read a memory at any time.
          </p>
        </section>

        <section id="privacy" className="about-section space-y-5 scroll-mt-6 border-t border-[#262626] pt-6">
          <h2 className="flex items-center gap-2 text-xs text-[#e5e5e5] uppercase tracking-widest font-mono">
            <span className="w-2 h-2 rounded-full bg-[#4A5D4E]"></span>
            <span><span className="text-[#4A5D4E] mr-2">03</span>Privacy</span>
          </h2>
          <p className="text-sm text-[#a3a3a3] leading-[1.85]">
            Amnesia is built without trackers, social feeds, gamification, or notifications. It runs quietly on a single node, requires no personal profile, and is designed for privacy.
          </p>
        </section>

        <section id="free" className="about-section space-y-5 scroll-mt-6 border-t border-[#262626] pt-6">
          <h2 className="flex items-center gap-2 text-xs text-[#e5e5e5] uppercase tracking-widest font-mono">
            <span className="w-2 h-2 rounded-full bg-[#4A5D4E]"></span>
            <span><span className="text-[#4A5D4E] mr-2">04</span>Why Free</span>
          </h2>
          <div className="space-y-5 text-sm text-[#a3a3a3] leading-[1.85]">
            <p>
              Most online services ask for your time, your attention, your personal data, or a monthly subscription.
            </p>
            <p className="text-white font-medium">
              Amnesia doesn't.
            </p>
            <p>
              I built this project because I wanted a quiet place to leave memories for my future self. As it grew, I realised it was something worth sharing. If it helps even one other person slow down, reflect, or rediscover a forgotten thought, then it has done exactly what it was built to do.
            </p>
            <p>
              A memory is only a small piece of encrypted text. It takes very little storage, very little bandwidth, and very little processing power. Keeping your memories safe simply doesn't cost enough to justify charging for the service.
            </p>
            <p className="space-y-1">
              <span className="block text-[#e5e5e5]">I don't want your money.</span>
              <span className="block text-[#e5e5e5]">I don't want your data.</span>
              <span className="block text-[#e5e5e5]">I don't want your attention.</span>
              <span className="block text-[#4A5D4E] font-medium">I only want to provide a quiet place where your memories can wait for you.</span>
            </p>
            <p>
              There are no premium plans, no advertisements, no trackers, and no hidden features behind a paywall.
            </p>
            <p className="italic text-[#e5e5e5]">
              Your memories are valuable. Storing them shouldn't be expensive.
            </p>
          </div>
        </section>

        <section id="no-app" className="about-section space-y-5 scroll-mt-6 border-t border-[#262626] pt-6">
          <h2 className="flex items-center gap-2 text-xs text-[#e5e5e5] uppercase tracking-widest font-mono">
            <span className="w-2 h-2 rounded-full bg-[#4A5D4E]"></span>
            <span><span className="text-[#4A5D4E] mr-2">05</span>Why No App</span>
          </h2>
          <div className="space-y-5 text-sm text-[#a3a3a3] leading-[1.85]">
            <p>
              There is no Amnesia app for iOS or Android.
            </p>
            <p>
              The browser already provides everything the archive needs - encryption, storage of your Recovery Phrase, and a place to read your memories - so a separate application would add little but another distribution and update channel to maintain.
            </p>
            <p>
              Keeping Amnesia as a website also keeps the project deliberately small: one codebase, one release, and nothing to install on a phone or desktop.
            </p>
            <p>
              The Amnesia website itself contains no advertising or analytics SDKs.
            </p>
            <p>
              For an app-like experience on iPhone or iPad, add Amnesia to your Home Screen. Open the site in Safari, tap the Share button, then choose "Add to Home Screen". The archive will get its own icon and open full screen, just like a native app. On Android, use Chrome, tap the menu (three dots), and choose "Add to Home screen".
            </p>
          </div>
        </section>

        <section id="why-one-year" className="about-section space-y-4 text-center scroll-mt-6 border-t border-[#262626] pt-6">
          <h2 className="flex items-center justify-center gap-2 text-xs text-[#e5e5e5] uppercase tracking-widest font-mono">
            <span className="w-2 h-2 rounded-full bg-[#4A5D4E]"></span>
            <span><span className="text-[#4A5D4E] mr-2">06</span>Why One Year</span>
          </h2>
          <p className="font-serif italic text-sm sm:text-base text-[#e5e5e5] leading-relaxed max-w-md mx-auto">
            A year is long enough to forget the exact words,<br />
            yet short enough to recognise the person you were when you wrote them.
          </p>
        </section>

        <section id="promise" className="about-section space-y-5 text-center scroll-mt-6 border-t border-[#262626] pt-6">
          <h2 className="flex items-center justify-center gap-2 text-xs text-[#e5e5e5] uppercase tracking-widest font-mono">
            <span className="w-2 h-2 rounded-full bg-[#4A5D4E]"></span>
            <span><span className="text-[#4A5D4E] mr-2">07</span>Our Promise</span>
          </h2>
          <div className="space-y-4 text-sm text-[#a3a3a3] max-w-md mx-auto leading-relaxed">
            <p>Amnesia is intentionally small.</p>
            <p>
              It won't become a social network.<br />
              It doesn't store your data, so there is nothing to sell.<br />
              It won't interrupt you with notifications.<br />
              It will never ask you to pay to access your own memories.
            </p>
            <div className="pt-2 text-[#e5e5e5] font-serif italic text-sm sm:text-base leading-relaxed">
              It will simply wait.<br />
              Quietly.<br />
              For as long as you need it to.
            </div>
          </div>
        </section>
      </main>
    </PageShell>
  );
};
