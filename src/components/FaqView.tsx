import React from 'react';
import { Footer } from './Footer';
import { AmnesiaLogo } from './AmnesiaLogo';

interface FaqViewProps {
  onGoHome: () => void;
  onNavigateTerms?: () => void;
  onNavigatePrivacy?: () => void;
  onNavigateAbout?: () => void;
}

const questions = [
  {
    question: 'How does Amnesia work?',
    answer: 'Write one memory per day, review it, and seal it. It is encrypted in your browser and held in your archive until its one-year calendar anniversary.',
  },
  {
    question: 'Can Amnesia read my memories?',
    answer: 'No. Memories are encrypted before they leave your browser. Your Recovery Phrase is required to decrypt them, and it is never stored by the server.',
  },
  {
    question: 'Is Amnesia really free?',
    answer: 'Yes. No subscription, no ads, and no paid tier. Amnesia is a small, self-hosted project built to do one thing: keep your memories sealed until it\'s time to remember them.',
  },
  {
    question: 'Why does Amnesia run on a Raspberry Pi?',
    answer: 'Amnesia is deliberately small. The archive runs on a Raspberry Pi because it does not need a vast cloud platform to do its job. Memories are encrypted in your browser before reaching the server, so the Pi stores encrypted data, not readable memories.',
  },
  {
    question: 'Is a Raspberry Pi secure enough for this?',
    answer: 'The Raspberry Pi is simply the computer running Amnesia. Your privacy does not depend on the Pi keeping your memories secret: memories are encrypted in your browser before they are sent to it, and your Recovery Phrase is never stored by Amnesia.',
  },
  {
    question: 'What is Archive Ambience?',
    answer: 'Archive Ambience is optional background sound created entirely in your browser. Nothing is recorded, no microphone is used, and no audio or personal data leaves your device. Turn it on or off whenever you like.',
  },
  {
    question: 'When will a memory awaken?',
    answer: 'One calendar year after it was sealed. The Timekeeper checks for due memories and marks them awake. The archive may show a short delay while that process runs.',
  },
  {
    question: 'What happens if I lose my Recovery Phrase?',
    answer: 'The archive cannot be recovered. Amnesia has no password reset, email recovery, or master key. Keep the phrase somewhere safe.',
  },
  {
    question: 'Can I delete this archive?',
    answer: 'Yes. Deleting is permanent and destroys every memory in this archive. The Recovery Phrase is retired and cannot be used again.',
  },
];

export const FaqView: React.FC<FaqViewProps> = ({
  onGoHome,
  onNavigateTerms,
  onNavigatePrivacy,
  onNavigateAbout,
}) => (
  <div className="min-h-screen bg-[#080808] text-[#e5e5e5] px-4 py-12 flex flex-col items-center justify-between font-mono">
    <div className="max-w-2xl w-full space-y-10">
      <header className="flex flex-col items-center text-center space-y-4">
        <AmnesiaLogo size="small" />
        <div className="h-[1px] w-12 bg-[#4A5D4E] my-2"></div>
        <h1 className="text-xl font-light tracking-[0.2em] text-white uppercase font-serif">
          Archive Questions
        </h1>
        <p className="text-xs text-[#737373] tracking-widest uppercase">
          How the archive works
        </p>
      </header>

      <main className="border-t border-b border-[#1f1f1f] divide-y divide-[#1f1f1f]">
        {questions.map(({ question, answer }) => (
          <details key={question} className="group py-5">
            <summary className="cursor-pointer list-none text-xs uppercase tracking-wider text-[#a3a3a3] transition-colors group-open:text-[#e5e5e5]">
              {question}
            </summary>
            <p className="pt-3 max-w-xl text-xs text-[#737373] leading-relaxed normal-case tracking-normal">
              {answer}
            </p>
          </details>
        ))}
      </main>

      <Footer
        onGoHome={onGoHome}
        onNavigateTerms={onNavigateTerms}
        onNavigatePrivacy={onNavigatePrivacy}
        onNavigateAbout={onNavigateAbout}
      />
    </div>
  </div>
);
