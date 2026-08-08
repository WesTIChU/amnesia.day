import React, { useRef, useState } from 'react';
import { deriveV2AuthVerifier, deriveV2LookupVerifier } from '../lib/crypto';

interface OpenArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenArchive: (key: string) => void;
}

export const OpenArchiveModal: React.FC<OpenArchiveModalProps> = ({
  isOpen,
  onClose,
  onOpenArchive
}) => {
  const [keyInput, setKeyInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const requestInFlight = useRef(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyInput.trim() || requestInFlight.current) return;

    setError('');
    setLoading(true);
    requestInFlight.current = true;

    try {
      const trimmedKey = keyInput.trim();
      const keyParts = trimmedKey.split('-');
      const isLongV2Key = keyParts.length >= 7;
      let res: Response;

      if (isLongV2Key) {
        const auth = await deriveV2AuthVerifier(trimmedKey);
        res = await fetch('/api/archive/open', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ version: 2, ...auth })
        });
      } else {
        const lookupVerifier = await deriveV2LookupVerifier(trimmedKey);
        const lookup = await fetch('/api/archive/lookup-v2', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lookupVerifier })
        });
        if (!lookup.ok) throw new Error('Archive lookup failed');
        const { authSalt } = await lookup.json();
        const auth = await deriveV2AuthVerifier(trimmedKey, authSalt);
        res = await fetch('/api/archive/open', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ version: 2, ...auth })
        });

        // Six-part keys may be legacy V1 keys. Fall back without revealing
        // whether the lookup token matched an archive.
        if (res.status === 404) {
          res = await fetch('/api/archive/open', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: trimmedKey })
          });
        }
      }

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'No archive found matching this Memory Key.');
      } else {
        onOpenArchive(trimmedKey);
        setKeyInput('');
        onClose();
      }
    } catch (err) {
      setError('Error connecting to archive server.');
    } finally {
      setLoading(false);
      requestInFlight.current = false;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#080808]/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#121212] border border-[#262626] max-w-md w-full p-6 sm:p-8 space-y-6 text-center font-serif relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#737373] hover:text-[#e5e5e5] font-mono text-sm cursor-pointer"
        >
          ✕
        </button>

        <div className="space-y-2">
          <h3 className="text-xl font-light tracking-widest text-[#e5e5e5] uppercase">
            Open Archive
          </h3>
          <p className="text-xs text-[#a3a3a3] font-serif italic">
             Enter your Memory Key to reveal your vault.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <input
              type="text"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="e.g. ash-echo-midnight-forest-river-4821"
              className="w-full px-4 py-3 bg-[#080808] border border-[#262626] focus:border-[#4A5D4E] text-[#e5e5e5] font-mono text-xs tracking-wide placeholder-[#525252] outline-none transition-colors text-center"
              autoFocus
            />
            {error && (
              <p className="text-xs font-mono text-[#f87171] pt-1">
                {error}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 pt-2 font-mono text-xs">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-[#262626] text-[#737373] hover:text-[#e5e5e5] hover:bg-[#1a1a1a] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !keyInput.trim()}
              className="flex-1 py-3 bg-[#171717] hover:bg-[#262626] text-[#e5e5e5] border border-[#262626] hover:border-[#404040] disabled:opacity-50 tracking-wider uppercase transition-colors cursor-pointer"
            >
              {loading ? 'Opening...' : 'Unlock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
