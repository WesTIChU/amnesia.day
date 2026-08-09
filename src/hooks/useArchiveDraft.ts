import { useCallback, useEffect, useState } from 'react';

const MAX_MEMORY_LENGTH = 2000;
const draftStorageKey = (archiveId?: number) => (archiveId ? `amnesia_draft_${archiveId}` : 'amnesia_draft');

interface ArchiveDraftState {
  memoryText: string;
  foundDraftText: string;
  hasDraftPrompt: boolean;
}

// Pure resolver so the archive-switch reset is unit-testable. Switching archives
// must always produce an empty in-memory editor first: a saved draft for the new
// archive may be surfaced as a prompt, but text from a previously viewed archive
// is never carried over.
export function resolveArchiveDraftState(savedDraft: string | null): ArchiveDraftState {
  if (savedDraft && savedDraft.trim().length > 0) {
    return { memoryText: '', foundDraftText: savedDraft, hasDraftPrompt: true };
  }
  return { memoryText: '', foundDraftText: '', hasDraftPrompt: false };
}

export function useArchiveDraft(archiveId?: number) {
  const [memoryText, setMemoryText] = useState('');
  const [hasDraftPrompt, setHasDraftPrompt] = useState(false);
  const [foundDraftText, setFoundDraftText] = useState('');

  // Restore any draft saved for this archive only. Drafts are namespaced by
  // archive ID; switching archives clears the in-memory editor before restoring
  // the new archive's saved draft, and never touches another archive's draft.
  useEffect(() => {
    let savedDraft: string | null = null;
    if (archiveId) {
      try {
        savedDraft = sessionStorage.getItem(draftStorageKey(archiveId));
      } catch {
        // sessionStorage may be unavailable in private browsing; the draft simply is not restored.
      }
    }
    const next = resolveArchiveDraftState(savedDraft);
    setMemoryText(next.memoryText);
    setFoundDraftText(next.foundDraftText);
    setHasDraftPrompt(next.hasDraftPrompt);
  }, [archiveId]);

  const handleTextChange = useCallback((value: string) => {
    const sliced = value.slice(0, MAX_MEMORY_LENGTH);
    setMemoryText(sliced);
    if (!archiveId) return;
    try {
      if (sliced.trim().length > 0) {
        sessionStorage.setItem(draftStorageKey(archiveId), sliced);
      } else {
        sessionStorage.removeItem(draftStorageKey(archiveId));
      }
    } catch {
      // sessionStorage may be unavailable in private browsing; the draft lives in memory only.
    }
  }, [archiveId]);

  const continueDraft = useCallback(() => {
    setMemoryText(foundDraftText);
    setHasDraftPrompt(false);
  }, [foundDraftText]);

  const clearDraft = useCallback(() => {
    if (archiveId) {
      try {
        sessionStorage.removeItem(draftStorageKey(archiveId));
      } catch {
        // sessionStorage may be unavailable in private browsing; nothing to clear outside memory.
      }
    }
    setMemoryText('');
    setFoundDraftText('');
    setHasDraftPrompt(false);
  }, [archiveId]);

  return { memoryText, hasDraftPrompt, foundDraftText, handleTextChange, continueDraft, clearDraft };
}
