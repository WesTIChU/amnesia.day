import React from 'react';
import { AmnesiaText } from '../AmnesiaLogo';
import { LogOut, Volume2, VolumeX } from 'lucide-react';
import { TopBar } from '../TopBar';

interface ArchiveHeaderProps {
  isAudioPlaying: boolean;
  onToggleAmbience: () => void;
  onGoHome: () => void;
  onShowKey: () => void;
  onCloseSession: () => void;
}

export const ArchiveHeader: React.FC<ArchiveHeaderProps> = ({
  isAudioPlaying,
  onToggleAmbience,
  onGoHome,
  onShowKey,
  onCloseSession,
}) => {
  return (
    <TopBar
      left={
        <button
          onClick={onGoHome}
          className="text-[#a3a3a3] hover:text-[#e5e5e5] transition-colors cursor-pointer uppercase tracking-widest"
        >
          ← Return Home
        </button>
      }
      right={
        <>
          <button
            onClick={onShowKey}
            className="text-[#a3a3a3] hover:text-[#e5e5e5] transition-colors cursor-pointer uppercase tracking-widest px-3 py-1"
          >
            <AmnesiaText text="Memory Key" autoAnimate={false} />
          </button>
          <button
            onClick={onToggleAmbience}
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
            onClick={onCloseSession}
            aria-label="Close session"
            title="Close session"
            className="p-2 text-[#737373] hover:text-[#e5e5e5] border border-transparent hover:border-[#262626] transition-colors cursor-pointer"
          >
            <LogOut size={14} strokeWidth={1.5} />
          </button>
        </>
      }
    />
  );
};
