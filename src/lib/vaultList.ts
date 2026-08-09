import type { Memory } from '../types';

export const VAULT_PREVIEW_LIMIT = 5;

export interface VaultPreview {
  awakened: Memory[];
  sleeping: Memory[];
  total: number;
  truncated: boolean;
}

// The main /vault index shows at most VAULT_PREVIEW_LIMIT entry cards. The
// full list lives on /vault/entries, so the dashboard never renders hundreds
// of cards directly. Awakened entries are shown first, then sleeping ones,
// matching the order of the two existing index sections.
export function previewVaultLists(awakened: Memory[], sleeping: Memory[]): VaultPreview {
  const flat = [...awakened, ...sleeping];
  const preview = flat.slice(0, VAULT_PREVIEW_LIMIT);
  return {
    awakened: preview.filter((m) => m.unlocked),
    sleeping: preview.filter((m) => !m.unlocked),
    total: flat.length,
    truncated: flat.length > VAULT_PREVIEW_LIMIT,
  };
}
