import React from 'react';
import { PageShell } from './PageShell';

interface FaqViewProps {
  isLoggedIn: boolean;
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
    question: 'Why is there no Amnesia app?',
    answer: 'The browser already provides everything the archive needs - encryption, storage of your Recovery Phrase, and a place to read your memories - so a separate app would mainly add another distribution and update channel to maintain. Amnesia stays a small website on purpose, and the site itself contains no advertising or analytics SDKs.',
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
    answer: 'The same UTC date and time one calendar year after it was sealed. The Amnesia server holds the material needed to decrypt the memory and releases it when that time arrives; a background Timekeeper process marks due memories as released, so availability begins after its next run. The archive may show a short delay while that process runs, and a leap-year interval may span 366 days. This release is enforced by the server and controls the normal archive interface - anyone who knows your Recovery Phrase could read a copy of the words kept on their own device at any time.',
  },
  {
    question: 'What happens if I lose my Recovery Phrase?',
    answer: 'A V2 archive cannot be recovered without your Recovery Phrase: there is no password reset or recovery bypass that can reconstruct it. Legacy V1 Vault Keys, however, remain decryptable by a server-held master key. Keep the phrase somewhere safe.',
  },
  {
    question: 'Can I delete this archive?',
    answer: 'Yes. Deleting removes the archive and its memories from the live database, and retires the Recovery Phrase so it cannot be reused. Encrypted remnants may persist temporarily in SQLite storage or backups until overwritten or expired.',
  },
];

export const FaqView: React.FC<FaqViewProps> = ({
  isLoggedIn,
  onGoHome,
  onNavigateTerms,
  onNavigatePrivacy,
  onNavigateAbout,
}) => (
  <PageShell
    title="Archive Questions"
    subtitle="How the archive works"
    isLoggedIn={isLoggedIn}
    onGoHome={onGoHome}
    onNavigateTerms={onNavigateTerms}
    onNavigatePrivacy={onNavigatePrivacy}
    onNavigateAbout={onNavigateAbout}
  >
    <main className="divide-y divide-[#262626]">
      {questions.map(({ question, answer }) => (
        <details key={question} className="group py-5">
          <summary className="cursor-pointer list-none text-xs uppercase tracking-wider text-[#a3a3a3] transition-colors group-open:text-[#e5e5e5]">
            {question}
          </summary>
          <p className="pt-3 max-w-xl text-xs text-[#737373] leading-relaxed normal-case tracking-normal font-serif">
            {answer}
          </p>
        </details>
      ))}
    </main>
  </PageShell>
);
