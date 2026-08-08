import React, { useState, useEffect } from 'react';
import { ArchiveData, Memory } from '../types';
import { AmnesiaLogo, AmnesiaText } from './AmnesiaLogo';
import { ambientSound } from '../lib/audio';
import { Footer } from './Footer';
import { buildV2TimekeeperAad, clearV2KeyCache, decryptV2Memory, decryptV2TimekeeperLayer, encryptV2Memory } from '../lib/crypto';
import { LogOut, Volume2, VolumeX } from 'lucide-react';

const getCsrfToken = () => {
  const cookie = document.cookie.split('; ').find((value) => value.startsWith('amnesia_csrf='));
  return cookie ? decodeURIComponent(cookie.slice('amnesia_csrf='.length)) : '';
};

const hydrateV2Memories = async (result: ArchiveData, memoryKey?: string): Promise<ArchiveData> => {
  if (result.archive.archiveVersion !== 2 || !memoryKey || !result.archive.encryptionSalt) return result;
  const memories = await Promise.all(result.memories.map(async (memory) => {
    if (!memory.unlockMaterial) return memory;
    try {
      const inner = await decryptV2TimekeeperLayer(
        memory.unlockMaterial,
        buildV2TimekeeperAad(result.archive.id, memory.memoryId!, memory.unlockAt),
      );
      const content = await decryptV2Memory(memoryKey, result.archive.encryptionSalt!, inner, result.archive.id);
      return { ...memory, content, unlockMaterial: undefined };
    } catch {
      return { ...memory, unlockMaterial: undefined };
    }
  }));
  return { ...result, memories };
};

interface ArchiveViewProps {
  memoryKey?: string;
  onSessionClosed?: () => void;
  onSessionExpired?: () => void;
  onGoHome: () => void;
  onNavigateMachine: () => void;
  onNavigateTerms?: () => void;
  onNavigatePrivacy?: () => void;
  onNavigateAbout?: () => void;
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
}) => {
  const keyParts = memoryKey?.split('-') || [];
  const isV2Key = keyParts.length >= 7;
  const recoveryParts = isV2Key ? keyParts.slice(0, 6) : keyParts;
  const recoveryGroups = Array.from({ length: Math.ceil(recoveryParts.length / 2) }, (_, index) =>
    recoveryParts.slice(index * 2, index * 2 + 2).join('-'),
  );
  const [data, setData] = useState<ArchiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  // Key Modal state
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Reunion Screen state
  const [showReunion, setShowReunion] = useState(true);

  // Draft & Memory creation state
  // Drafts live only in sessionStorage (cleared when the tab closes) and are
  // namespaced by archive ID so opening another archive never reveals a
  // different archive's draft.
  const draftStorageKey = (archiveId?: number) => (archiveId ? `amnesia_draft_${archiveId}` : 'amnesia_draft');
  const [memoryText, setMemoryText] = useState('');
  const [hasDraftPrompt, setHasDraftPrompt] = useState(false);
  const [foundDraftText, setFoundDraftText] = useState('');

  // Review Modal state
  const [showReviewModal, setShowReviewModal] = useState(false);

  // Sealing Ceremony & submitting state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [isSealingSequence, setIsSealingSequence] = useState(false);
  const [sealingUnlockDate, setSealingUnlockDate] = useState('');
  const [sealingProgress, setSealingProgress] = useState(0);

  // Dedicated Memory Reading View state
  const [readingMemory, setReadingMemory] = useState<Memory | null>(null);

  // Opened Memory Ritual state (IDs unlocked in this session)
  const [openedMemoryIds, setOpenedMemoryIds] = useState<number[]>([]);
  const [ritualActiveId, setRitualActiveId] = useState<number | null>(null);

  // Delete Archive Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmKeyInput, setConfirmKeyInput] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Archive Integrity Modal State
  const [showIntegrityModal, setShowIntegrityModal] = useState(false);
  const [isTimekeeperAwakening, setIsTimekeeperAwakening] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(() => ambientSound.getIsPlaying());

  const toggleAmbience = () => {
    setIsAudioPlaying(ambientSound.toggle());
  };

  const checkTimekeeper = () => {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    setIsTimekeeperAwakening(values.hour === '00' && values.minute === '00' && Number(values.second) < 10);
  };

  useEffect(() => {
    checkTimekeeper();
    const interval = window.setInterval(checkTimekeeper, 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => () => clearV2KeyCache(), []);

  const fetchArchive = async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/archive/session', {
        signal
      });
      const result = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          clearV2KeyCache();
          onSessionExpired?.();
        }
        setError(result.error || 'Failed to access memory archive.');
      } else {
        setData(await hydrateV2Memories(result, memoryKey));
      }
    } catch (err) {
      if ((err as DOMException).name !== 'AbortError') {
        setError('Connection error while fetching archive.');
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchArchive(controller.signal);

    return () => controller.abort();
  }, [memoryKey]);

  // Restore any draft saved for this archive only. Because drafts are
  // namespaced by archive ID, they never leak between archives.
  useEffect(() => {
    const archiveId = data?.archive.id;
    if (!archiveId) return;
    try {
      const savedDraft = sessionStorage.getItem(draftStorageKey(archiveId));
      if (savedDraft && savedDraft.trim().length > 0) {
        setFoundDraftText(savedDraft);
        setHasDraftPrompt(true);
      }
    } catch (e) {}
  }, [data?.archive.id]);

  const clearCurrentDraft = () => {
    const archiveId = data?.archive.id;
    try {
      sessionStorage.removeItem(draftStorageKey(archiveId));
    } catch (e) {}
    setMemoryText('');
    setFoundDraftText('');
    setHasDraftPrompt(false);
  };

  // Handle local text change & auto-save draft
  const handleTextChange = (value: string) => {
    const sliced = value.slice(0, 2000);
    setMemoryText(sliced);

    const archiveId = data?.archive.id;
    if (!archiveId) return;

    try {
      if (sliced.trim().length > 0) {
        sessionStorage.setItem(draftStorageKey(archiveId), sliced);
      } else {
        sessionStorage.removeItem(draftStorageKey(archiveId));
      }
    } catch (e) {}
  };

  const handleContinueDraft = () => {
    setMemoryText(foundDraftText);
    setHasDraftPrompt(false);
  };

  const handleDiscardDraft = () => {
    clearCurrentDraft();
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
      setMemoryText('');
      clearCurrentDraft();
      const res = await fetch('/api/archive/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
        body: JSON.stringify({ encryptionVersion: 2, ...encryptedV2 })
      });
      const result = await res.json();

      if (!res.ok) {
        setSubmitError(result.error || 'Could not archive memory.');
        setIsSubmitting(false);
        setShowReviewModal(false);
      } else {
        // Clear local draft
        clearCurrentDraft();

        const unlockFormatted = new Date(result.unlockAt).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });

        setShowReviewModal(false);

        // Trigger Sealing Ceremony
        setSealingUnlockDate(unlockFormatted);
        setIsSealingSequence(true);
        setSealingProgress(10);

        // Progress bar simulation
        const p1 = setTimeout(() => setSealingProgress(45), 400);
        const p2 = setTimeout(() => setSealingProgress(85), 900);
        const p3 = setTimeout(() => setSealingProgress(100), 1400);

        const done = setTimeout(() => {
          setIsSealingSequence(false);
          setMemoryText('');
          setIsSubmitting(false);
          fetchArchive();
        }, 2800);

        return () => {
          clearTimeout(p1);
          clearTimeout(p2);
          clearTimeout(p3);
          clearTimeout(done);
        };
      }
    } catch (err) {
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
        clearCurrentDraft();
        onSessionClosed ? onSessionClosed() : onGoHome();
      }
    } catch (err) {
      setDeleteError('Error processing deletion.');
      setIsDeleting(false);
    }
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
      clearCurrentDraft();
      onSessionClosed ? onSessionClosed() : onGoHome();
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

  const calculateDaysLeft = (unlockIso: string) => {
    const unlockDate = new Date(unlockIso);
    const today = new Date(currentTime);
    const utcDay = (date: Date) => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    const calendarDays = Math.floor((utcDay(unlockDate) - utcDay(today)) / (1000 * 60 * 60 * 24));

    // Keep a future unlock on the current calendar day readable until it opens.
    if (calendarDays === 0 && unlockDate.getTime() > currentTime) return 1;
    return Math.max(0, calendarDays);
  };

  const handleTriggerRitual = (id: number) => {
    setRitualActiveId(id);
  };

  const handleConfirmRitualOpen = async (id: number) => {
    try {
      ambientSound.playPaperEnvelopeOpen();
    } catch (e) {}

    if (!openedMemoryIds.includes(id)) {
      setOpenedMemoryIds((prev) => [...prev, id]);
    }

    try {
      const res = await fetch('/api/archive/memory/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
        body: JSON.stringify({ memoryId: id })
      });
      const resData = await res.json();
      if (res.ok && resData.firstReadAt && data) {
        setData({
          ...data,
          memories: data.memories.map((m) =>
            m.id === id ? { ...m, firstReadAt: resData.firstReadAt, readCount: resData.readCount } : m
          )
        });
        setReadingMemory((prev) =>
          prev && prev.id === id
            ? { ...prev, firstReadAt: resData.firstReadAt, readCount: resData.readCount }
            : prev
        );
      }
    } catch (e) {}

    setRitualActiveId(null);
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

  // 1. REUNION OVERLAY SCREEN
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

  // 2. SEALING CEREMONY OVERLAY
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

          {/* Progress Bar Visual */}
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

  // 3. FULL SCREEN AWAKENED MEMORY RITUAL OVERLAY
  if (ritualActiveId !== null) {
    return (
      <div className="min-h-screen bg-[#080808] text-[#D1D1D1] flex flex-col items-center justify-center p-6 text-center font-serif animate-fade-in">
        <div className="max-w-md w-full bg-[#111111] border border-[#262626] p-8 sm:p-12 space-y-8 shadow-2xl">
          <div className="space-y-3">
            <h2 className="text-2xl sm:text-3xl font-light text-white uppercase tracking-[0.15em]">
              One memory has awakened.
            </h2>
            <div className="h-[1px] w-10 bg-[#4A5D4E] mx-auto mt-4"></div>
          </div>

          <div className="space-y-2">
            <p className="text-lg font-serif italic text-[#a0a0a0]">
              It has waited
            </p>
            <p className="text-2xl font-mono text-[#4A5D4E] font-light tracking-wider uppercase">
              One Year
            </p>
            <p className="text-lg font-serif italic text-[#a0a0a0]">
              to be read.
            </p>
          </div>

          <button
            onClick={() => handleConfirmRitualOpen(ritualActiveId)}
            className="w-full py-4 bg-[#4A5D4E] hover:bg-[#3d4f41] text-[#f3f4f6] font-mono text-xs uppercase tracking-[0.2em] transition-colors cursor-pointer shadow-lg"
          >
            Open Memory
          </button>
        </div>
      </div>
    );
  }

  // 4. MAIN ARCHIVE VIEW
  return (
    <div className="min-h-screen bg-[#080808] text-[#D1D1D1] p-6 sm:p-12 lg:p-16 max-w-4xl mx-auto space-y-12 font-serif animate-fade-in">
      {/* Top Header */}
      <div className="relative flex justify-between items-center border-b border-[#262626] pb-6 font-mono text-xs text-[#737373]">
        <button
          onClick={onGoHome}
          className="text-[#a3a3a3] hover:text-[#e5e5e5] transition-colors cursor-pointer uppercase tracking-widest"
        >
          ← Return Home
        </button>

        {/* Site Name with Amnesia Fade Animation */}
        <div className="absolute left-1/2 -translate-x-1/2">
          <AmnesiaLogo size="small" />
        </div>

        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={() => setShowKeyModal(true)}
            className="text-[#a3a3a3] hover:text-[#e5e5e5] transition-colors cursor-pointer uppercase tracking-widest px-3 py-1"
          >
            <AmnesiaText text="Memory Key" autoAnimate={false} />
          </button>
          <button
            onClick={toggleAmbience}
            aria-label={isAudioPlaying ? 'Turn off archive ambience' : 'Turn on archive ambience'}
            aria-pressed={isAudioPlaying}
            title={isAudioPlaying ? 'Turn off archive ambience' : 'Turn on archive ambience'}
            className={`p-2 border transition-colors cursor-pointer ${
              isAudioPlaying
                ? 'border-[#4A5D4E] text-[#4A5D4E]'
                : 'border-transparent text-[#737373] hover:border-[#262626] hover:text-[#e5e5e5]'
            }`}
          >
            {isAudioPlaying ? <Volume2 size={14} strokeWidth={1.5} /> : <VolumeX size={14} strokeWidth={1.5} />}
          </button>
          <button
            onClick={handleCloseSession}
            aria-label="Close session"
            title="Close session"
            className="p-2 text-[#737373] hover:text-[#e5e5e5] border border-transparent hover:border-[#262626] transition-colors cursor-pointer"
          >
            <LogOut size={14} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Memory Key Modal / Reveal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 bg-[#080808]/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-[#262626] max-w-md w-full p-6 sm:p-8 space-y-6 font-mono shadow-2xl animate-fade-in">
            <div className="space-y-2 text-center border-b border-[#262626] pb-4">
              <h3 className="text-sm font-light text-white uppercase tracking-[0.2em]">
                Your Memory Key
              </h3>
              <p className="text-[10px] text-[#737373] tracking-wide">
                Keep this key safe. Amnesia cannot recover lost keys.
              </p>
            </div>

            <div className="p-4 bg-[#080808] border border-[#262626] text-center select-all space-y-3">
              <div className="text-[10px] uppercase tracking-[0.25em] text-[#737373]">Recovery Phrase</div>
              <div className="flex flex-col items-center gap-1 font-mono text-sm text-[#4A5D4E] font-semibold">
                {recoveryGroups.length > 0
                  ? recoveryGroups.map((group, index) => <span key={`${group}-${index}`}>{group}{index < recoveryGroups.length - 1 ? '-' : ''}</span>)
                  : <span className="text-[#737373]">Unavailable after session reload</span>}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCopyKey}
                className="flex-1 py-3 bg-[#4A5D4E] hover:bg-[#3d4f41] text-[#f3f4f6] text-xs uppercase tracking-widest transition-colors cursor-pointer"
              >
                {copiedKey ? 'Copied ✓' : 'Copy Key'}
              </button>
              <button
                onClick={() => setShowKeyModal(false)}
                className="flex-1 py-3 border border-[#262626] text-[#737373] hover:text-[#e5e5e5] text-xs uppercase tracking-widest transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Write Memory Form */}
      <div className="bg-[#111111] border border-[#262626] p-6 sm:p-8 space-y-6">
        <div className="border-b border-[#262626] pb-4 flex justify-between items-baseline">
          <h2 className="text-lg font-light text-[#e5e5e5] tracking-widest uppercase">
            Seal A Memory
          </h2>
          <span className="font-mono text-[10px] text-[#888888] uppercase tracking-wider">
            1 Memory per day limit
          </span>
        </div>

        {hasWrittenToday ? (
          <div className="p-6 bg-[#080808] border border-[#262626] text-center space-y-2">
            <p className="font-serif italic text-base text-[#e5e5e5]">
              Today's memory has been safely archived.
            </p>
            <p className="font-mono text-xs text-[#888888]">
              Return tomorrow to leave another memory behind.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Unfinished Local Draft Alert */}
            {hasDraftPrompt && (
              <div className="p-4 bg-[#171717] border border-[#4A5D4E]/40 text-xs font-mono flex flex-col sm:flex-row justify-between items-center gap-3">
                <span className="text-[#e5e5e5]">An unfinished memory was found on this device.</span>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={handleContinueDraft}
                    className="flex-1 sm:flex-none px-4 py-2 bg-[#4A5D4E] hover:bg-[#3d4f41] text-[#f3f4f6] uppercase tracking-wider cursor-pointer"
                  >
                    Continue
                  </button>
                  <button
                    onClick={handleDiscardDraft}
                    className="flex-1 sm:flex-none px-4 py-2 border border-[#262626] text-[#737373] hover:text-[#e5e5e5] uppercase tracking-wider cursor-pointer"
                  >
                    Discard
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleStartReview} className="space-y-4">
              <div className="relative">
                <textarea
                  value={memoryText}
                  onChange={(e) => handleTextChange(e.target.value)}
                  placeholder="Leave something behind..."
                  rows={6}
                  className="w-full bg-[#080808] border border-[#262626] focus:border-[#4A5D4E] p-5 text-[#e5e5e5] font-serif text-base leading-relaxed placeholder-[#525252] outline-none transition-colors resize-none"
                />
                <div className="absolute bottom-3 right-4 font-mono text-[10px] text-[#737373]">
                  {memoryText.length} / 2000
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <span className="font-mono text-[10px] text-[#737373] tracking-wide italic">
                  Drafts are kept in this browser tab only and are cleared when the tab closes, or when you seal, discard, or sign out.
                </span>

                <button
                  type="submit"
                  disabled={isSubmitting || !memoryText.trim()}
                  className="w-full sm:w-auto px-8 py-3.5 bg-[#4A5D4E] hover:bg-[#3d4f41] text-[#f3f4f6] disabled:opacity-40 font-mono text-xs uppercase tracking-[0.2em] transition-all cursor-pointer shadow-lg"
                >
                  Seal Memory
                </button>
              </div>

              {submitError && (
                <p className="font-mono text-xs text-[#f87171] pt-2">{submitError}</p>
              )}
            </form>
          </div>
        )}
      </div>

      {/* Final Review Modal Before Sealing */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 bg-[#080808]/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-[#262626] max-w-xl w-full p-6 sm:p-10 space-y-6 font-serif shadow-2xl animate-fade-in">
            <div className="space-y-2 text-center border-b border-[#262626] pb-4">
              <h3 className="text-xl font-light text-white uppercase tracking-[0.2em]">
                Review your memory one final time
              </h3>
              <p className="text-xs font-mono text-[#a0a0a0] pt-2 leading-relaxed">
                Once sealed it cannot be changed or read again until{' '}
                <span className="text-[#4A5D4E] font-medium">{getTargetUnlockDateFormatted()}</span>
              </p>
            </div>

            <div className="p-6 bg-[#080808] border border-[#262626] text-[#f3f4f6] text-base leading-relaxed font-serif whitespace-pre-wrap max-h-60 overflow-y-auto">
              {memoryText}
            </div>

            <div className="text-center font-mono text-[10px] text-[#737373] tracking-wider uppercase space-y-1">
              <div>Every memory is encrypted before it is archived.</div>
              <div>Your Memory Key is never stored. We cannot recover lost Memory Keys.</div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 font-mono text-xs pt-2">
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="w-full sm:w-1/2 py-3.5 border border-[#262626] text-[#737373] hover:text-[#e5e5e5] cursor-pointer uppercase tracking-widest transition-colors"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={handleSealForever}
                disabled={isSubmitting}
                className="w-full sm:w-1/2 py-3.5 bg-[#4A5D4E] hover:bg-[#3d4f41] text-[#f3f4f6] cursor-pointer uppercase tracking-widest transition-colors shadow-lg font-medium"
              >
                {isSubmitting ? 'Sealing...' : 'Seal Forever'}
              </button>
            </div>
          </div>
        </div>
      )}

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

            {/* Check if first time read or already read */}
            {(!readingMemory.firstReadAt && !openedMemoryIds.includes(readingMemory.id)) ? (
              <div className="py-16 text-center space-y-8 my-12 animate-fade-in">
                <div className="space-y-3">
                  <p className="font-serif italic text-xl sm:text-2xl text-[#e5e5e5]">
                    This memory waited
                  </p>
                  <p className="text-2xl sm:text-3xl font-mono text-[#4A5D4E] font-light uppercase tracking-[0.2em]">
                    365 Days
                  </p>
                  <p className="font-serif italic text-xl sm:text-2xl text-[#e5e5e5]">
                    to be read.
                  </p>
                </div>
                <button
                  onClick={() => handleConfirmRitualOpen(readingMemory.id)}
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

      {/* Memory Index / Archive List */}
      <div className="space-y-8 pt-6">
        <div className="border-b border-[#262626] pb-3 flex flex-wrap justify-between items-baseline gap-2">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-light text-white tracking-widest uppercase font-serif">
              Archive Index
            </h2>
          </div>
          <span className="font-mono text-xs text-[#888888] uppercase tracking-wider">
            TIME LOCKED VAULT
          </span>
        </div>

        {memories.length === 0 ? (
          <div className="py-12 px-6 text-center text-[#737373] font-serif italic text-sm border border-dashed border-[#262626] space-y-4">
            <div>The archive is waiting for its first memory.</div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Awakened Memories Section */}
            {memories.filter((m) => m.unlocked).length > 0 && (
              <div className="space-y-4">
                <div className="font-mono text-xs text-[#a3a3a3] uppercase tracking-widest border-l-2 border-[#4A5D4E] pl-3 py-0.5">
                  Awakened Memories ({memories.filter((m) => m.unlocked).length})
                </div>
                <div className="space-y-3">
                  {memories
                    .filter((m) => m.unlocked)
                    .map((mem) => {
                       const stampId = formatEntryId(mem.id);
                      const createdStr = formatDate(mem.createdAt);
                      const unlockStr = formatDate(mem.unlockAt);
                      const isOpenedInSession = openedMemoryIds.includes(mem.id);
                      const hasBeenReadBefore = Boolean(mem.firstReadAt) || isOpenedInSession;
                      const preview = mem.content
                        ? mem.content.length > 90
                          ? mem.content.slice(0, 90) + '...'
                          : mem.content
                        : '';

                      return (
                        <div
                          key={mem.id}
                          className="bg-[#111111] border border-[#262626] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:border-[#4A5D4E]/50 group"
                        >
                          <div className="space-y-1.5 font-mono text-xs max-w-xl">
                            <div className="flex items-center gap-2">
                              <span className="text-[#e5e5e5] font-semibold text-[11px] tracking-wider">
                                ENTRY {stampId}
                              </span>
                              <span className="px-2 py-0.5 bg-[#4A5D4E]/10 border border-[#4A5D4E]/40 text-[#4A5D4E] text-[9px] font-semibold uppercase tracking-widest">
                                Awakened
                              </span>
                              {!hasBeenReadBefore && (
                                <span className="px-2 py-0.5 bg-[#f59e0b]/10 border border-[#f59e0b]/40 text-[#f59e0b] text-[9px] font-semibold uppercase tracking-widest">
                                  Unread
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[#737373]">
                              Sealed {createdStr} • Awakened {unlockStr}
                            </div>
                            {hasBeenReadBefore && preview && (
                              <div className="font-serif italic text-xs text-[#a3a3a3] pt-0.5 line-clamp-1">
                                "{preview}"
                              </div>
                            )}
                            {!hasBeenReadBefore && (
                              <div className="font-serif italic text-xs text-[#4A5D4E] pt-0.5">
                                This memory is waiting to be opened for the first time.
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => setReadingMemory(mem)}
                            className="self-start sm:self-center px-4 py-2 bg-[#171717] hover:bg-[#222222] border border-[#333333] hover:border-[#4A5D4E] text-[#f3f4f6] font-mono text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap shadow-sm group-hover:border-[#4A5D4E]"
                          >
                            <span>{!hasBeenReadBefore ? 'Open Memory' : 'Read Memory'}</span>
                            <span className="text-[#4A5D4E] transition-transform group-hover:translate-x-0.5">→</span>
                          </button>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Sleeping Memories Section */}
            {memories.filter((m) => !m.unlocked).length > 0 && (
              <div className="space-y-4">
                <div className="font-mono text-xs text-[#888888] uppercase tracking-widest border-l-2 border-[#262626] pl-3 py-0.5">
                  Sleeping Memories ({memories.filter((m) => !m.unlocked).length})
                </div>
                <div className="space-y-3">
                  {memories
                    .filter((m) => !m.unlocked)
                    .map((mem) => {
                       const stampId = formatEntryId(mem.id);
                      const createdStr = formatDate(mem.createdAt);
                      const unlockStr = formatDate(mem.unlockAt);
                      const daysLeft = calculateDaysLeft(mem.unlockAt);

                      return (
                        <div
                          key={mem.id}
                          className="bg-[#0e0e0e] border border-[#1f1f1f] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-xs transition-colors hover:border-[#2a2a2a]"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[#a3a3a3] font-semibold text-[11px] tracking-wider">
                                ENTRY {stampId}
                              </span>
                              <span className="px-2 py-0.5 bg-[#1a1a1a] border border-[#2a2a2a] text-[#737373] text-[9px] uppercase tracking-widest">
                                Sleeping
                              </span>
                            </div>
                            <div className="text-[11px] text-[#525252]">
                              Sealed {createdStr} • Awakens {unlockStr}
                            </div>
                          </div>

                          <div className="text-[#4A5D4E] text-[11px] tracking-wider uppercase font-mono self-start sm:self-center">
                            Awakens in {daysLeft} {daysLeft === 1 ? 'day' : 'days'}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

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

      {/* Archive Integrity Modal */}
      {showIntegrityModal && (
        <div className="fixed inset-0 z-50 bg-[#080808]/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-[#262626] max-w-sm w-full p-6 space-y-6 font-mono text-xs animate-fade-in shadow-2xl">
            <div className="space-y-1 border-b border-[#262626] pb-3 text-center">
              <h3 className="text-xs font-light text-white uppercase tracking-[0.2em]">Archive Integrity</h3>
              <p className="text-[10px] text-[#737373]">Verification Protocol & System Health</p>
            </div>

            <div className="space-y-3 bg-[#080808] p-4 border border-[#262626] text-xs">
              <div className="flex justify-between items-center">
                <span className="text-[#737373] text-[10px] uppercase">Archive Status</span>
                <span className="text-[#4A5D4E] font-medium uppercase">Encrypted</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#737373] text-[10px] uppercase">Vault Health</span>
                <span className="text-[#e5e5e5]">Healthy</span>
              </div>
              <div className="flex justify-between items-center">
                  <span className="text-[#737373] text-[10px] uppercase">Archive Engine</span>
                  <span className="text-[#e5e5e5]">SQLite</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#737373] text-[10px] uppercase">Last Verified</span>
                  <span className="text-[#a3a3a3]">Today 03:00 UTC</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#737373] text-[10px] uppercase">Archive Size</span>
                  <span className="text-[#a3a3a3]">
                    {stats.archiveSizeBytes
                      ? `${(stats.archiveSizeBytes / 1024).toFixed(1)} KB`
                      : '0 KB'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#737373] text-[10px] uppercase">Timekeeper</span>
                  <span className="text-[#4A5D4E]">{isTimekeeperAwakening ? 'Awakening...' : 'Healthy'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#737373] text-[10px] uppercase">Version</span>
                  <span className="text-[#a3a3a3]">1.0.0</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#737373] text-[10px] uppercase">Build</span>
                  <span className="text-[#a3a3a3]">2026.08.07</span>
                </div>
            </div>

            <button
              onClick={() => setShowIntegrityModal(false)}
              className="w-full py-2.5 border border-[#262626] text-[#737373] hover:text-[#e5e5e5] uppercase tracking-widest text-[11px] cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-[#080808]/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-[#262626] max-w-md w-full p-6 sm:p-8 space-y-6 font-serif">
            <div className="space-y-2">
              <h3 className="text-lg font-light text-[#f87171] uppercase tracking-widest">
                Delete Archive
              </h3>
              <p className="text-xs text-[#a3a3a3] leading-relaxed">
                This action is irreversible. Every memory in this archive will be permanently destroyed and the Memory Key will be permanently retired.
              </p>
            </div>

            <form onSubmit={handleDeleteArchive} className="space-y-4">
              <div className="space-y-2 font-mono text-xs">
                <label className="text-[#737373] block text-[10px] uppercase">
                  Type DELETE to Confirm
                </label>
                <input
                  type="text"
                  value={confirmKeyInput}
                  onChange={(e) => setConfirmKeyInput(e.target.value)}
                  placeholder="DELETE"
                  className="w-full px-4 py-3 bg-[#080808] border border-[#262626] focus:border-[#f87171] text-[#e5e5e5] text-xs outline-none"
                />
              </div>

              {deleteError && (
                <p className="font-mono text-xs text-[#f87171]">{deleteError}</p>
              )}

              <div className="flex items-center gap-3 pt-2 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setConfirmKeyInput('');
                    setDeleteError('');
                  }}
                  className="flex-1 py-3 border border-[#262626] text-[#737373] hover:text-[#e5e5e5] cursor-pointer uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDeleting || confirmKeyInput.trim() !== 'DELETE'}
                  className="flex-1 py-3 bg-[#f87171]/10 hover:bg-[#f87171]/20 text-[#f87171] border border-[#f87171]/30 disabled:opacity-30 uppercase tracking-wider transition-colors cursor-pointer"
                >
                  {isDeleting ? 'Deleting...' : 'Delete Permanently'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
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
