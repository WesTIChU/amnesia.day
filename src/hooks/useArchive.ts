import { useEffect, useState } from 'react';
import { ArchiveData, Memory } from '../types';
import { buildV2TimekeeperAad, clearV2KeyCache, decryptV2Memory, decryptV2TimekeeperLayer } from '../lib/crypto';
import { ambientSound } from '../lib/audio';
import { getCsrfToken } from '../lib/http';

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

interface UseArchiveOptions {
  memoryKey?: string;
  onSessionExpired?: () => void;
}

export function useArchive({ memoryKey, onSessionExpired }: UseArchiveOptions) {
  const [data, setData] = useState<ArchiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [readingMemory, setReadingMemory] = useState<Memory | null>(null);
  const [openedMemoryIds, setOpenedMemoryIds] = useState<number[]>([]);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [isTimekeeperAwakening, setIsTimekeeperAwakening] = useState(false);

  const fetchArchive = async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/archive/session', { signal });
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

  // Re-fetch only when the Memory Key changes; a parent re-render must not refetch.
  useEffect(() => {
    const controller = new AbortController();
    fetchArchive(controller.signal);
    return () => controller.abort();
  }, [memoryKey]);

  useEffect(() => () => clearV2KeyCache(), []);

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const check = () => {
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
    check();
    const interval = window.setInterval(check, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const confirmRitualOpen = async (id: number) => {
    try {
      ambientSound.playPaperEnvelopeOpen();
    } catch {
      // Decorative audio only; a playback error must never block opening the memory.
    }

    setOpenedMemoryIds((prev) => (prev.includes(id) ? prev : [...prev, id]));

    try {
      const res = await fetch('/api/archive/memory/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
        body: JSON.stringify({ memoryId: id })
      });
      const resData = await res.json();
      if (res.ok && resData.firstReadAt) {
        setData((prev) =>
          prev
            ? { ...prev, memories: prev.memories.map((m) => (m.id === id ? { ...m, firstReadAt: resData.firstReadAt, readCount: resData.readCount } : m)) }
            : prev
        );
        setReadingMemory((prev) =>
          prev && prev.id === id ? { ...prev, firstReadAt: resData.firstReadAt, readCount: resData.readCount } : prev
        );
      }
    } catch {
      // Read receipt is best-effort; the memory still opens locally even if the call fails.
    }
  };

  return {
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
  };
}
