import React, { useEffect, useRef, useState } from 'react';
import { ArchiveData, ArchiveIntegrityStatus } from '../types';
import { ambientSound } from '../lib/audio';
import { encryptV2Memory } from '../lib/crypto';
import { getCsrfToken } from '../lib/http';
import { Footer } from './Footer';
import { useArchive } from '../hooks/useArchive';
import { useArchiveDraft } from '../hooks/useArchiveDraft';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { ArchiveHeader } from './archive/ArchiveHeader';
import { ArchiveIndex } from './archive/ArchiveIndex';
import { MemoryComposer } from './archive/MemoryComposer';
import { MemoryKeyModal } from './archive/MemoryKeyModal';
import { ReviewModal } from './archive/ReviewModal';
import { DeleteArchiveModal } from './archive/DeleteArchiveModal';
import { IntegrityModal } from './archive/IntegrityModal';

interface ArchiveViewProps {
  memoryKey?: string;
  onSessionClosed?: () => void;
  onSessionExpired?: () => void;
  onGoHome: () => void;
  onNavigateMachine: () => void;
  onNavigateTerms?: () => void;
  onNavigatePrivacy?: () => void;
  onNavigateAbout?: () => void;
  onNavigateCalendar: () => void;
  onNavigateEntries: () => void;
}

export const ArchiveView: React.FC<ArchiveViewProps> = ({
  memoryKey,
  onSessionClosed,
  onSessionExpired,
  onGoHome,
  onNavigateMachine,
  onNavigateTerms,
  onNavigatePrivacy,
  onNavigateAbout,
  onNavigateCalendar,
  onNavigateEntries,
}) => {
  const keyParts = memoryKey?.split('-') || [];
  const isV2Key = keyParts.length >= 7;
  const recoveryParts = isV2Key ? keyParts.slice(0, 6) : keyParts;
  const recoveryGroups = Array.from({ length: Math.ceil(recoveryParts.length / 2) }, (_, index) =>
    recoveryParts.slice(index * 2, index * 2 + 2).join('-'),
  );

  const {
    data,
    loading,
    error,
    fetchArchive,
    readingMemory,
    setReadingMemory,
    openedMemoryIds,
    confirmRitualOpen,
    currentTime,
    isTimekeeperAwakening,
  } = useArchive({ memoryKey, onSessionExpired });

  const { memoryText, hasDraftPrompt, handleTextChange, continueDraft, clearDraft } = useArchiveDraft(data?.archive.id);

  const [showKeyModal, setShowKeyModal] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [showReunion, setShowReunion] = useState(true);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [isSealingSequence, setIsSealingSequence] = useState(false);
  const [sealingUnlockDate, setSealingUnlockDate] = useState('');
  const [sealingProgress, setSealingProgress] = useState(0);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmKeyInput, setConfirmKeyInput] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showIntegrityModal, setShowIntegrityModal] = useState(false);
  const [integrityStatus, setIntegrityStatus] = useState<ArchiveIntegrityStatus | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(() => ambientSound.getIsPlaying());

  const sealingTimersRef = useRef<number[]>([]);

  const clearSealingTimers = () => {
    sealingTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    sealingTimersRef.current = [];
  };

  // Clear any in-flight sealing timers when ArchiveView unmounts so a cleared
  // timer can never update state or call fetchArchive after unmount.
  useEffect(() => {
    return () => clearSealingTimers();
  }, []);

  const isAnyModalOpen = showKeyModal || showReviewModal || showDeleteModal || showIntegrityModal;
  useBodyScrollLock(isAnyModalOpen);

  // While the Archive Integrity modal is open, poll the live status so the
  // "Last Verified" and "Archive Size" fields auto-update (e.g. after the
  // nightly Timekeeper run) instead of showing a static snapshot.
  useEffect(() => {
    if (!showIntegrityModal) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const res = await fetch('/api/archive/integrity');
        if (!res.ok || cancelled) return;
        setIntegrityStatus(await res.json());
      } catch {
        // Keep the last known values on transient errors.
      }
    };
    refresh();
    const interval = window.setInterval(refresh, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [showIntegrityModal]);

  const toggleAmbience = () => {
    setIsAudioPlaying(ambientSound.toggle());
  };

  const handleCopyKey = () => {
    if (!memoryKey) return;
    navigator.clipboard.writeText(memoryKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCloseSession = async () => {
    try {
      await fetch('/api/archive/logout', {
        method: 'POST',
        headers: { 'X-CSRF-Token': getCsrfToken() },
      });
    } finally {
      clearDraft();
      onSessionClosed ? onSessionClosed() : onGoHome();
    }
  };

  const handleStartReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memoryText.trim() || isSubmitting) return;
    setShowReviewModal(true);
  };

  const handleSealForever = async () => {
    if (!memoryText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError('');

    try {
      // Only V2 archives can seal new memories. Legacy V1 archives remain
      // readable, but never receive plaintext from the browser.
      if (data?.archive.archiveVersion !== 2 || !memoryKey || !data.archive.encryptionSalt) {
        setSubmitError('This archive uses an older format and can no longer seal new memories. Existing memories remain available.');
        setIsSubmitting(false);
        return;
      }
      const encryptedV2 = await encryptV2Memory(memoryKey, data.archive.encryptionSalt, memoryText.trim(), data.archive.id);
      const res = await fetch('/api/archive/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
        body: JSON.stringify({ encryptionVersion: 2, ...encryptedV2 })
      });
      const result = await res.json();

      if (!res.ok) {
        // Keep the visible text and the saved draft untouched: only the API
        // confirming success may clear them.
        setSubmitError(result.error || 'Could not archive memory.');
        setIsSubmitting(false);
        setShowReviewModal(false);
      } else {
        clearDraft();

        const unlockFormatted = new Date(result.unlockAt).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });

        setShowReviewModal(false);
        setSealingUnlockDate(unlockFormatted);
        setIsSealingSequence(true);
        setSealingProgress(10);

        // Clear any existing sealing timers before starting a new sequence so a
        // stale timer cannot advance progress, close the sequence, or refetch
        // after a fresh seal.
        clearSealingTimers();

        const p1 = window.setTimeout(() => setSealingProgress(45), 400);
        const p2 = window.setTimeout(() => setSealingProgress(85), 900);
        const p3 = window.setTimeout(() => setSealingProgress(100), 1400);

        const done = window.setTimeout(() => {
          setIsSealingSequence(false);
          setIsSubmitting(false);
          fetchArchive();
        }, 2800);

        sealingTimersRef.current = [p1, p2, p3, done];
      }
    } catch {
      setSubmitError('Error reaching archive server.');
      setIsSubmitting(false);
      setShowReviewModal(false);
    }
  };

  const handleDeleteArchive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmKeyInput.trim() !== 'DELETE') {
      setDeleteError('Type DELETE to confirm permanent deletion.');
      return;
    }

    setIsDeleting(true);
    setDeleteError('');

    try {
      const res = await fetch('/api/archive/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
        body: JSON.stringify({ confirmation: 'DELETE' })
      });

      if (!res.ok) {
        const result = await res.json();
        setDeleteError(result.error || 'Failed to delete archive.');
        setIsDeleting(false);
      } else {
        clearDraft();
        onSessionClosed ? onSessionClosed() : onGoHome();
      }
    } catch {
      setDeleteError('Error processing deletion.');
      setIsDeleting(false);
    }
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const getTargetUnlockDateFormatted = () => {
    const target = new Date();
    target.setFullYear(target.getFullYear() + 1);
    return formatDate(target.toISOString());
  };

  const formatStampId = (id: number) => {
    return `#${id.toString().padStart(6, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center font-mono text-xs text-[#737373] tracking-widest uppercase">
        Accessing archive...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#080808] flex flex-col items-center justify-center p-6 text-center space-y-6">
        <p className="font-mono text-xs text-[#f87171]">{error || 'Archive unavailable.'}</p>
        <button
          onClick={onGoHome}
          className="px-6 py-2 border border-[#262626] text-[#737373] hover:text-[#e5e5e5] font-mono text-xs cursor-pointer"
        >
          Return Home
        </button>
      </div>
    );
  }

  const { stats, memories, hasWrittenToday, archive } = data;
  const chronologicalMemories = [...memories].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt) || a.id - b.id,
  );
  const formatEntryId = (id: number) =>
    formatStampId(chronologicalMemories.findIndex((memory) => memory.id === id) + 1);
  const daysSinceLast = archive.daysSinceLastVisit ?? 1;
  const awakenedCount = stats.openedMemories ?? 0;

  // REUNION OVERLAY
  if (showReunion && daysSinceLast > 0) {
    return (
      <div className="min-h-screen bg-[#080808] text-[#D1D1D1] flex flex-col items-center justify-center p-6 text-center font-serif animate-fade-in">
        <div className="max-w-md w-full bg-[#111111] border border-[#262626] p-8 sm:p-12 space-y-8 shadow-2xl">
          <div className="space-y-3">
            <h2 className="text-2xl sm:text-3xl font-light text-white uppercase tracking-[0.2em]">
              Welcome back.
            </h2>
            <div className="h-[1px] w-10 bg-[#4A5D4E] mx-auto mt-4"></div>
          </div>

          <div className="space-y-4 text-base sm:text-lg font-light text-[#a0a0a0] italic leading-relaxed">
            <p>
              It has been <span className="text-white font-normal not-italic">{daysSinceLast} days</span> since your last visit.
            </p>
            <p className="text-sm font-sans not-italic text-[#4A5D4E]">
              {awakenedCount > 0
                ? `${awakenedCount} memory has awakened.`
                : 'Your memories are sleeping quietly.'}
            </p>
          </div>

          <button
            onClick={() => setShowReunion(false)}
            className="w-full py-4 bg-[#4A5D4E] hover:bg-[#3d4f41] text-[#f3f4f6] font-mono text-xs uppercase tracking-[0.2em] transition-colors cursor-pointer"
          >
            Open Archive →
          </button>
        </div>
      </div>
    );
  }

  // SEALING CEREMONY OVERLAY
  if (isSealingSequence) {
    return (
      <div className="min-h-screen bg-[#080808] text-[#D1D1D1] flex flex-col items-center justify-center p-6 text-center font-serif animate-fade-in">
        <div className="max-w-md w-full bg-[#111111] border border-[#262626] p-10 space-y-8 shadow-2xl">
          <div className="space-y-2">
            <h2 className="text-xl font-light text-white uppercase tracking-[0.25em]">
              Sealing memory...
            </h2>
            <p className="text-xs font-mono text-[#737373] tracking-widest uppercase pt-2">
              Writing to encrypted vault
            </p>
          </div>

          <div className="w-full bg-[#080808] border border-[#262626] h-2 rounded-full overflow-hidden p-0.5">
            <div
              className="bg-[#4A5D4E] h-full transition-all duration-500 ease-out"
              style={{ width: `${sealingProgress}%` }}
            ></div>
          </div>

          {sealingProgress >= 85 && (
            <div className="space-y-2 animate-fade-in pt-2">
              <div className="text-lg font-serif italic text-white">Forgotten.</div>
              <div className="text-xs font-mono text-[#4A5D4E] uppercase tracking-wider">
                Unlocks {sealingUnlockDate}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080808] text-[#D1D1D1] p-6 sm:p-12 lg:p-16 max-w-4xl mx-auto space-y-12 font-serif animate-fade-in">
      <ArchiveHeader
        isAudioPlaying={isAudioPlaying}
        onToggleAmbience={toggleAmbience}
        onGoHome={onGoHome}
        onShowKey={() => setShowKeyModal(true)}
        onCloseSession={handleCloseSession}
      />

      <MemoryKeyModal
        show={showKeyModal}
        recoveryGroups={recoveryGroups}
        copiedKey={copiedKey}
        onCopyKey={handleCopyKey}
        onClose={() => setShowKeyModal(false)}
      />

      {/* Archive Personality Header */}
      <div className="space-y-2 text-center sm:text-left">
        <h1 className="text-2xl sm:text-3xl font-light tracking-[0.2em] text-white uppercase font-serif">
          Your Archive Awaits
        </h1>
        <p className="text-xs sm:text-sm text-[#888888] font-mono tracking-wider uppercase">
          Forget today. Remember next year.
        </p>
      </div>

      {/* 100th Memory Milestone Quiet Notice */}
      {stats.totalMemories >= 100 && (
        <div className="p-5 bg-[#111111] border border-[#4A5D4E]/40 font-mono text-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="space-y-1">
            <div className="font-bold text-[#4A5D4E] tracking-widest uppercase text-xs">
              Archive Entry #000100
            </div>
            <div className="text-xs text-[#a3a3a3] font-serif italic">
              Thank you for trusting the archive.
            </div>
          </div>
          <span className="text-[10px] text-[#4A5D4E] border border-[#4A5D4E]/30 px-3 py-1 bg-[#4A5D4E]/5 uppercase tracking-widest">
            Milestone Vault
          </span>
        </div>
      )}

      {/* Statistics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-6 bg-[#111111] border border-[#262626] font-mono text-xs text-center">
        <div className="space-y-1">
          <div className="text-[#888888] text-[10px] uppercase tracking-wider">Total Sealed</div>
          <div className="text-[#e5e5e5] text-base font-light">{stats.totalMemories}</div>
        </div>
        <div className="space-y-1">
          <div className="text-[#888888] text-[10px] uppercase tracking-wider">Sleeping</div>
          <div className="text-[#4A5D4E] text-base font-light">{stats.waitingMemories}</div>
        </div>
        <div className="space-y-1">
          <div className="text-[#888888] text-[10px] uppercase tracking-wider">Awakened</div>
          <div className="text-[#e5e5e5] text-base font-light">{stats.openedMemories}</div>
        </div>
        <div className="space-y-1">
          <div className="text-[#888888] text-[10px] uppercase tracking-wider">Next Unlock</div>
          <div className="text-[#a3a3a3] text-xs">
            {stats.nextUnlockDate ? formatDate(stats.nextUnlockDate) : 'None'}
          </div>
        </div>
      </div>

      <MemoryComposer
        memoryText={memoryText}
        hasWrittenToday={hasWrittenToday}
        hasDraftPrompt={hasDraftPrompt}
        isSubmitting={isSubmitting}
        submitError={submitError}
        onTextChange={handleTextChange}
        onContinueDraft={continueDraft}
        onDiscardDraft={clearDraft}
        onSubmit={handleStartReview}
      />

      <ReviewModal
        show={showReviewModal}
        memoryText={memoryText}
        isSubmitting={isSubmitting}
        targetUnlockDate={getTargetUnlockDateFormatted()}
        onEdit={() => setShowReviewModal(false)}
        onSeal={handleSealForever}
      />

      {/* Dedicated Memory Reading Page Overlay */}
      {readingMemory && (
        <div className="fixed inset-0 z-50 bg-[#080808] overflow-y-auto min-h-screen p-4 sm:p-8 md:p-12 animate-fade-in flex flex-col justify-between">
          <div className="max-w-2xl w-full mx-auto my-auto py-8 sm:py-12 space-y-8">
            {/* Top Bar Navigation */}
            <div className="flex justify-between items-center border-b border-[#222222] pb-6">
              <button
                onClick={() => setReadingMemory(null)}
                className="text-xs font-mono text-[#a3a3a3] hover:text-white uppercase tracking-widest transition-colors cursor-pointer flex items-center gap-2"
              >
                <span>← Return to your archive</span>
              </button>
              <span className="font-mono text-[11px] text-[#525252] uppercase tracking-widest">
                ARCHIVE ENTRY {formatEntryId(readingMemory.id)}
              </span>
            </div>

            {(!readingMemory.firstReadAt && !openedMemoryIds.includes(readingMemory.id)) ? (
              <div className="py-16 text-center space-y-8 my-12 animate-fade-in">
                <div className="space-y-3">
                  <p className="font-serif italic text-xl sm:text-2xl text-[#e5e5e5]">
                    This memory waited
                  </p>
                  <p className="text-2xl sm:text-3xl font-mono text-[#4A5D4E] font-light uppercase tracking-[0.2em]">
                    One Year
                  </p>
                  <p className="font-serif italic text-xl sm:text-2xl text-[#e5e5e5]">
                    to be read.
                  </p>
                </div>
                <button
                  onClick={() => confirmRitualOpen(readingMemory.id)}
                  className="px-10 py-4 bg-[#4A5D4E] hover:bg-[#3d4f41] text-[#f3f4f6] font-mono text-xs uppercase tracking-[0.2em] transition-all cursor-pointer shadow-2xl"
                >
                  Open Memory
                </button>
              </div>
            ) : (
              <div className="space-y-8 animate-fade-in">
                {/* Official Physical Archive Seal Stamp */}
                <div className="font-mono text-[10px] text-[#525252] tracking-[0.2em] uppercase border-l-2 border-[#4A5D4E] pl-4 py-2 space-y-1 bg-[#111111]/60 p-4 border border-[#222222]">
                  <div className="text-[#a3a3a3] font-semibold">ARCHIVE SEAL ENTRY {formatEntryId(readingMemory.id)}</div>
                  <div>Sealed: <span className="text-[#888888]">{formatDate(readingMemory.createdAt)}</span></div>
                  <div>Awakened: <span className="text-[#4A5D4E]">{formatDate(readingMemory.unlockAt)}</span></div>
                  {readingMemory.firstReadAt && (
                    <div>First Read: <span className="text-[#a3a3a3]">{formatDate(readingMemory.firstReadAt)}</span></div>
                  )}
                </div>

                {/* Unfolded Memory Text Paper Experience */}
                <div className="font-serif text-[#f3f4f6] text-lg sm:text-xl leading-relaxed whitespace-pre-wrap p-8 sm:p-12 bg-[#111111] border border-[#222222] shadow-2xl">
                  {readingMemory.content}
                </div>

                <div className="pt-6 text-center">
                  <button
                    onClick={() => setReadingMemory(null)}
                    className="px-8 py-3 bg-[#181818] hover:bg-[#222222] border border-[#2a2a2a] text-[#a3a3a3] hover:text-white font-mono text-xs uppercase tracking-widest transition-colors cursor-pointer"
                  >
                    ← Return to your archive
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <ArchiveIndex
        memories={memories}
        now={currentTime}
        openedMemoryIds={openedMemoryIds}
        formatDate={formatDate}
        formatEntryId={formatEntryId}
        onOpenMemory={setReadingMemory}
        onNavigateCalendar={onNavigateCalendar}
        onNavigateEntries={onNavigateEntries}
      />

      {/* Danger Zone: Delete Archive */}
      <div className="pt-12 border-t border-[#1f1f1f] flex justify-between items-center font-mono text-xs">
        <button
          onClick={() => setShowIntegrityModal(true)}
          className="text-[#737373] hover:text-[#4A5D4E] transition-colors cursor-pointer uppercase tracking-wider text-[11px] font-mono flex items-center gap-2"
        >
          <span>Archive Integrity</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#4A5D4E]"></span>
        </button>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="text-[#f87171]/50 hover:text-[#f87171] transition-colors cursor-pointer uppercase tracking-widest text-[10px]"
        >
          Delete Archive
        </button>
      </div>

      <IntegrityModal
        show={showIntegrityModal}
        lastVerifiedAt={integrityStatus?.lastVerifiedAt ?? null}
        archiveSizeBytes={integrityStatus?.archiveSizeBytes ?? stats.archiveSizeBytes}
        isTimekeeperAwakening={isTimekeeperAwakening}
        onClose={() => setShowIntegrityModal(false)}
      />

      <DeleteArchiveModal
        show={showDeleteModal}
        confirmKeyInput={confirmKeyInput}
        deleteError={deleteError}
        isDeleting={isDeleting}
        onConfirmInputChange={setConfirmKeyInput}
        onClose={() => {
          setShowDeleteModal(false);
          setConfirmKeyInput('');
          setDeleteError('');
        }}
        onSubmit={handleDeleteArchive}
      />

      <Footer
        onNavigateMachine={onNavigateMachine}
        onNavigateTerms={onNavigateTerms}
        onNavigatePrivacy={onNavigatePrivacy}
        onNavigateAbout={onNavigateAbout}
        isLoggedIn
      />
    </div>
  );
};
