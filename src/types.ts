export interface ArchiveStats {
  archivesOpened: number;
  sleepingMemories: number;
  unlockedToday: number;
  oldestArchiveDate: string | null;
}

export interface Memory {
  id: number;
  createdAt: string;
  unlockAt: string;
  unlocked: boolean;
  content?: string;
  firstReadAt?: string | null;
  readCount?: number;
  encryptionVersion?: number;
  memoryId?: string;
  clientSalt?: string;
  unlockMaterial?: {
    secret: string;
    ciphertext: string;
    nonce: string;
    authTag: string;
  };
}

export interface ArchiveData {
  archive: {
    id: number;
    createdAt: string;
    lastActiveAt: string;
    previousLastActiveAt?: string | null;
    daysSinceLastVisit?: number;
    archiveVersion?: number;
    encryptionSalt?: string | null;
  };
  stats: {
    totalMemories: number;
    waitingMemories: number;
    openedMemories: number;
    nextUnlockDate: string | null;
    awakenedCount?: number;
    archiveSizeBytes?: number;
  };
  hasWrittenToday: boolean;
  memories: Memory[];
}

export interface ArchiveIntegrityStatus {
  lastVerifiedAt: string | null;
  archiveSizeBytes: number;
}

export interface MachineMetrics {
  loadAverage: number;
  ramUsedMb: number;
  ramTotalMb: number;
  diskUsedGb: number;
  diskTotalGb: number;
  tempCelsius: number | null;
  uptimeSeconds: number;
  uptimeFormatted: string;
  dbSizeBytes: number;
  dbSizeFormatted: string;
  archivesCount: number;
  memoriesCount: number;
  sleepingMemories: number;
  unlockedToday: number;
  oldestMemoryDate: string | null;
  newestMemoryDate: string | null;
  lastAwakeningDate: string | null;
  machineSince: string | null;
}
