import React from 'react';
import { Footer } from './Footer';
import { AmnesiaLogo } from './AmnesiaLogo';

interface AboutViewProps {
  onGoHome: () => void;
  onNavigateTerms?: () => void;
  onNavigatePrivacy?: () => void;
  onNavigateAbout?: () => void;
}

export const AboutView: React.FC<AboutViewProps> = ({
  onGoHome,
  onNavigateTerms,
  onNavigatePrivacy,
  onNavigateAbout,
}) => {
  const isLoggedIn = document.cookie.includes('amnesia_csrf=');
  return (
    <div className="min-h-screen bg-[#080808] text-[#e5e5e5] px-4 py-12 flex flex-col items-center justify-between font-serif">
      <div className="max-w-2xl w-full space-y-12">
        <header className="flex flex-col items-center text-center space-y-4">
          <AmnesiaLogo size="small" />
          <div className="h-[1px] w-12 bg-[#4A5D4E] mt-2 mb-5"></div>
          <h1 className="text-lg sm:text-xl font-light tracking-[0.2em] text-white uppercase font-serif">
            About Amnesia
          </h1>
          <p className="font-mono text-[11px] text-[#737373] tracking-[0.16em] uppercase">
            A Quiet Time Capsule • Forget Today. Remember Next Year.
          </p>
        </header>

        <nav aria-label="About page sections" className="flex flex-wrap justify-center gap-x-6 gap-y-3 border-y border-[#1f1f1f] py-5 font-mono text-xs uppercase tracking-[0.14em] text-[#a3a3a3]">
          <a href="#concept" className="hover:text-white transition-colors">Concept</a>
          <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
          <a href="#privacy" className="hover:text-white transition-colors">Privacy</a>
          <a href="#free" className="hover:text-white transition-colors">Why Free</a>
          <a href="#why-one-year" className="hover:text-white transition-colors">Why One Year</a>
          <a href="#promise" className="hover:text-white transition-colors">Our Promise</a>
        </nav>

        <main className="space-y-4 text-base sm:text-[17px] text-[#a3a3a3] leading-[1.85] border-t border-b border-[#1f1f1f] py-4">
          <section id="concept" className="about-section space-y-5 scroll-mt-6">
            <h2 className="font-mono text-white text-xs tracking-[0.2em] uppercase font-semibold"><span className="text-[#4A5D4E] mr-3">01</span>The Concept</h2>
            <p className="font-serif italic text-sm text-[#e5e5e5] leading-normal">
              "Most internet apps demand your immediate attention. Amnesia asks for your patience."
            </p>
            <p>
              Amnesia is a quiet digital vault designed for personal notes, reflections, letters, and thoughts meant to be read in exactly one year. Once a memory is sealed it is encrypted in your browser and cannot be read again through the archive until 365 days have elapsed.
            </p>
          </section>

          <section id="how-it-works" className="about-section space-y-5 scroll-mt-6">
            <h2 className="font-mono text-white text-xs tracking-[0.2em] uppercase font-semibold"><span className="text-[#4A5D4E] mr-3">02</span>How It Works</h2>
            <ul className="space-y-4 text-[#a3a3a3]">
              <li className="pl-4 border-l border-[#4A5D4E]/50"><strong className="text-white font-normal">Recovery Phrase:</strong> Access is controlled by a unique Recovery Phrase. No email, username, or password required.</li>
              <li className="pl-4 border-l border-[#4A5D4E]/50"><strong className="text-white font-normal">Browser Encryption:</strong> Memories are encrypted in your browser before they reach Amnesia. The server stores only ciphertext and never sees the plaintext. Your Recovery Phrase is required to decrypt them.</li>
              <li className="pl-4 border-l border-[#4A5D4E]/50"><strong className="text-white font-normal">One-Year Release:</strong> Every submitted entry is timestamped and held by the server until 365 days have passed. The server withholds the material needed to decrypt a memory until its release date.</li>
              <li className="pl-4 border-l border-[#4A5D4E]/50"><strong className="text-white font-normal">Quiet Awakening:</strong> On midnight of its anniversary, the server releases the memory so it can be read.</li>
            </ul>
            <p className="font-serif text-sm text-[#737373] leading-relaxed">
              The one-year wait is enforced by the Amnesia server, not by cryptography alone: Amnesia will not reveal a memory through its own interface before the release date. Because Amnesia delivers the browser code, this is not a claim of Signal-style end-to-end encryption against a malicious server. Anyone who knows your Recovery Phrase, or who kept the words on their own device before sealing, could read a memory at any time.
            </p>
          </section>

          <section id="privacy" className="about-section space-y-5 scroll-mt-6">
            <h2 className="font-mono text-white text-xs tracking-[0.2em] uppercase font-semibold"><span className="text-[#4A5D4E] mr-3">03</span>Privacy</h2>
            <p>
              Amnesia is built without trackers, social feeds, gamification, or notifications. It runs quietly on a single node with daily verified backups, zero personal data collection, and full privacy by design.
            </p>
          </section>

          <section id="free" className="about-section space-y-5 scroll-mt-6">
            <h2 className="font-mono text-white text-xs tracking-[0.2em] uppercase font-semibold"><span className="text-[#4A5D4E] mr-3">04</span>Why Free</h2>
            <div className="space-y-5 text-[#a3a3a3]">
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

          <section id="why-one-year" className="about-section space-y-4 text-center scroll-mt-6">
            <h2 className="font-mono text-white text-xs tracking-[0.2em] uppercase font-semibold"><span className="text-[#4A5D4E] mr-3">05</span>Why One Year</h2>
            <p className="font-serif italic text-sm sm:text-base text-[#e5e5e5] leading-relaxed max-w-md mx-auto">
              A year is long enough to forget the exact words,<br />
              yet short enough to recognise the person you were when you wrote them.
            </p>
          </section>

          <section id="promise" className="about-section space-y-5 text-center scroll-mt-6">
            <h2 className="font-mono text-white text-xs tracking-[0.2em] uppercase font-semibold"><span className="text-[#4A5D4E] mr-3">06</span>Our Promise</h2>
            <div className="space-y-4 text-[#a3a3a3] max-w-md mx-auto leading-relaxed">
              <p>Amnesia is intentionally small.</p>
              <p>
                It won't become a social network.<br />
                It won't sell your data.<br />
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
