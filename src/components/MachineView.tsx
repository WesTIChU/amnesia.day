import React, { useEffect, useState } from 'react';
import { MachineMetrics } from '../types';

const formatDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'None';

const formatAge = (value: string | null) => {
  if (!value) return 'Unavailable';
  const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / (1000 * 60 * 60 * 24)));
  if (days < 30) return `${days} ${days === 1 ? 'day' : 'days'}`;
  if (days < 365) {
    const months = Math.floor(days / 30.44);
    return `${months} ${months === 1 ? 'month' : 'months'}`;
  }
  const years = Math.floor(days / 365.25);
  return `${years} ${years === 1 ? 'year' : 'years'}`;
};

const formatDetailedAge = (value: string | null) => {
  if (!value) return 'Unavailable';
  const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / (1000 * 60 * 60 * 24)));
  if (days < 30) return `${days} ${days === 1 ? 'day' : 'days'}`;
  const months = Math.floor(days / 30.44);
  if (months < 12) return `${months} ${months === 1 ? 'month' : 'months'}`;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return remainingMonths ? `${years} years ${remainingMonths} months` : `${years} ${years === 1 ? 'year' : 'years'}`;
};

interface MachineViewProps {
  onGoHome: () => void;
  onNavigateTerms?: () => void;
  onNavigatePrivacy?: () => void;
  onNavigateAbout?: () => void;
}

export const MachineView: React.FC<MachineViewProps> = ({
  onGoHome,
  onNavigateTerms,
  onNavigatePrivacy,
  onNavigateAbout,
}) => {
  const [metrics, setMetrics] = useState<MachineMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [machineTime, setMachineTime] = useState(() => new Date());
  const isLoggedIn = document.cookie.includes('amnesia_csrf=');

  const fetchMetrics = () => {
    fetch('/api/machine')
      .then((res) => {
        if (!res.ok) throw new Error(`Machine request failed: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setMetrics(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setMachineTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const ukTime = machineTime.toLocaleTimeString('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
  const ukDate = machineTime.toLocaleDateString('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="max-w-4xl mx-auto p-6 sm:p-12 space-y-8 font-mono animate-fade-in text-[#d1d1d1]">
      {/* Back button */}
      <div className="flex justify-between items-center border-b border-[#262626] pb-6 text-xs text-[#737373]">
        <button
          onClick={onGoHome}
          className="hover:text-[#e5e5e5] transition-colors cursor-pointer uppercase tracking-widest"
        >
          ← Return to Amnesia
        </button>
         <span className="uppercase tracking-[0.2em] text-[10px]">The Machine</span>
      </div>

      {/* Main Machine Banner */}
      <div className="bg-[#111111] border border-[#262626] p-8 space-y-6 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#262626] pb-6">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl text-white font-light uppercase tracking-[0.2em]">
              Raspberry Pi Zero 2 WH
            </h1>
            <p className="text-xs text-[#737373] font-serif italic leading-relaxed">
              ARM Cortex-A53<br />
              512 MB RAM<br />
              Raspberry Pi OS
            </p>
          </div>
          <div className="flex flex-col sm:items-end gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#080808] border border-[#262626] text-[11px] text-[#4A5D4E]">
              <span className="w-2 h-2 rounded-full bg-[#4A5D4E] animate-machine-led"></span>
              Machine: Online
            </div>
            <div className="text-[10px] text-[#737373] tracking-widest uppercase">
              Timekeeper: Healthy
            </div>
          </div>
        </div>

        {/* Telemetry Grid */}
        {loading || !metrics ? (
          <div className="py-12 text-center text-xs text-[#737373] tracking-widest uppercase">
            Reading hardware sensors...
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
            <div className="space-y-1 bg-[#080808] p-4 border border-[#1f1f1f]">
              <span className="text-[#737373] text-[10px] uppercase tracking-wider block">CPU Temp</span>
              <span className="text-white text-lg font-light">{metrics.tempCelsius === null ? 'Unavailable' : `${metrics.tempCelsius} °C`}</span>
              <span className="text-[10px] text-[#737373] block pt-1">Passive Heatsink</span>
            </div>

            <div className="space-y-1 bg-[#080808] p-4 border border-[#1f1f1f]">
              <span className="text-[#737373] text-[10px] uppercase tracking-wider block">Uptime</span>
              <span className="text-white text-lg font-light">{metrics.uptimeFormatted}</span>
              <span className="text-[10px] text-[#4A5D4E] block pt-1">Continuous operation</span>
            </div>

            <div className="space-y-1 bg-[#080808] p-4 border border-[#1f1f1f]">
              <span className="text-[#737373] text-[10px] uppercase tracking-wider block">Database Size</span>
              <span className="text-white text-lg font-light">{metrics.dbSizeFormatted}</span>
              <span className="text-[10px] text-[#4A5D4E] block pt-1">SQLite WAL Mode</span>
            </div>

            <div className="space-y-1 bg-[#080808] p-4 border border-[#1f1f1f]">
              <span className="text-[#737373] text-[10px] uppercase tracking-wider block">Memories Sleeping</span>
              <span className="text-white text-lg font-light">{metrics.sleepingMemories?.toLocaleString() ?? 'Unavailable'}</span>
              <span className="text-[10px] text-[#737373] block pt-1">Awaiting server release</span>
            </div>

            <div className="space-y-1 bg-[#080808] p-4 border border-[#1f1f1f]">
              <span className="text-[#737373] text-[10px] uppercase tracking-wider block">Unique Archives</span>
              <span className="text-white text-lg font-light">{metrics.archivesCount.toLocaleString()}</span>
              <span className="text-[10px] text-[#737373] block pt-1">Unique archives</span>
            </div>

            <div className="space-y-1 bg-[#080808] p-4 border border-[#1f1f1f]">
              <span className="text-[#737373] text-[10px] uppercase tracking-wider block">Total Memories</span>
              <span className="text-white text-lg font-light">{metrics.memoriesCount.toLocaleString()}</span>
              <span className="text-[10px] text-[#737373] block pt-1">All archives</span>
            </div>

            <div className="space-y-1 bg-[#080808] p-4 border border-[#1f1f1f]">
              <span className="text-[#737373] text-[10px] uppercase tracking-wider block">Memories Awakened</span>
              <span className="text-[#4A5D4E] text-lg font-light">{metrics.unlockedToday.toLocaleString()}</span>
              <span className="text-[10px] text-[#4A5D4E] block pt-1">Today</span>
            </div>

            <div className="space-y-1 bg-[#080808] p-4 border border-[#1f1f1f]">
              <span className="text-[#737373] text-[10px] uppercase tracking-wider block">Load Average</span>
              <span className="text-white text-lg font-light">{metrics.loadAverage.toFixed(2)}</span>
              <span className="text-[10px] text-[#737373] block pt-1">1 minute average</span>
            </div>

            <div className="space-y-1 bg-[#080808] p-4 border border-[#1f1f1f]">
              <span className="text-[#737373] text-[10px] uppercase tracking-wider block">Memory (RAM)</span>
              <span className="text-white text-lg font-light">
                {(metrics.ramUsedMb / 1024).toFixed(1)} GB <span className="text-xs text-[#737373]">of {(metrics.ramTotalMb / 1024).toFixed(1)} GB</span>
              </span>
            </div>

            <div className="space-y-1 bg-[#080808] p-4 border border-[#4A5D4E]/50">
              <span className="text-[#737373] text-[10px] uppercase tracking-wider block">Vault Status</span>
              <span className="text-[#4A5D4E] text-base font-light">Encrypted</span>
              <span className="text-[10px] text-[#737373] block pt-1">Verified</span>
            </div>

            <div className="space-y-1 bg-[#080808] p-4 border border-[#1f1f1f]">
              <span className="text-[#737373] text-[10px] uppercase tracking-wider block">Archive Age</span>
              <span className="text-white text-lg font-light">
                {formatAge(metrics.machineSince)}
              </span>
              <span className="text-[10px] text-[#737373] block pt-1">Machine since {formatDate(metrics.machineSince)}</span>
            </div>

            <div className="space-y-1 bg-[#080808] p-4 border border-[#1f1f1f]">
              <span className="text-[#737373] text-[10px] uppercase tracking-wider block">Oldest Memory</span>
              <span className="text-white text-sm font-light">{formatDate(metrics.oldestMemoryDate)}</span>
              <span className="text-[10px] text-[#737373] block pt-1">Age {formatDetailedAge(metrics.oldestMemoryDate)}</span>
            </div>

            <div className="space-y-1 bg-[#080808] p-4 border border-[#1f1f1f]">
              <span className="text-[#737373] text-[10px] uppercase tracking-wider block">Newest Memory</span>
              <span className="text-white text-sm font-light">{formatDate(metrics.newestMemoryDate)}</span>
              <span className="text-[10px] text-[#737373] block pt-1">Most recent seal</span>
            </div>

            <div className="space-y-1 bg-[#080808] p-4 border border-[#1f1f1f]">
              <span className="text-[#737373] text-[10px] uppercase tracking-wider block">Last Awakening</span>
              <span className="text-white text-sm font-light">{formatDate(metrics.lastAwakeningDate)}</span>
              <span className="text-[10px] text-[#737373] block pt-1">Most recent unlock</span>
            </div>

            <div className="space-y-1 bg-[#080808] p-4 border border-[#1f1f1f]">
              <span className="text-[#737373] text-[10px] uppercase tracking-wider block">Machine Time</span>
              <span className="text-white text-lg font-light">{ukTime}</span>
              <span className="text-[10px] text-[#737373] block pt-1">Current</span>
            </div>

            <div className="space-y-1 bg-[#080808] p-4 border border-[#1f1f1f]">
              <span className="text-[#737373] text-[10px] uppercase tracking-wider block">Current Date</span>
              <span className="text-white text-sm font-light">{ukDate}</span>
              <span className="text-[10px] text-[#737373] block pt-1">Europe/London</span>
            </div>

            <div className="space-y-1 bg-[#080808] p-4 border border-[#1f1f1f]">
              <span className="text-[#737373] text-[10px] uppercase tracking-wider block">Service Uptime</span>
              <span className="text-white text-sm font-light">{metrics.uptimeFormatted}</span>
              <span className="text-[10px] text-[#737373] block pt-1">Current record</span>
            </div>
          </div>
        )}

        {/* Security & Privacy Protocol Section */}
        <div className="pt-6 border-t border-[#262626] space-y-4">
          <div className="flex items-center gap-2 text-xs text-[#e5e5e5] uppercase tracking-widest font-mono">
            <span className="w-2 h-2 rounded-full bg-[#4A5D4E]"></span>
            <span>Privacy & Encryption</span>
          </div>

          <div className="bg-[#080808] border border-[#1f1f1f] p-6 space-y-3 font-serif text-xs leading-relaxed text-[#a3a3a3]">
            <p className="text-sm font-medium text-white italic">
              "Memories are encrypted in your browser before they are sent to Amnesia."
            </p>
            <div className="font-mono text-[11px] text-[#737373] space-y-1 pt-1">
              <div>• <strong className="text-[#e5e5e5]">Encrypted Storage:</strong> The server stores encrypted data and archive metadata, not readable memory contents.</div>
              <div>• <strong className="text-[#e5e5e5]">Recovery Phrase Protection:</strong> Your Recovery Phrase is never sent to or stored by the server.</div>
              <div>• <strong className="text-[#e5e5e5]">Separated Authentication:</strong> Authentication data is cryptographically separated from encryption keys.</div>
              <div>• <strong className="text-[#e5e5e5]">Local Decryption:</strong> After a memory awakens, it is decrypted locally in your browser using your Recovery Phrase.</div>
            </div>
          </div>
        </div>

        <div className="border-t border-[#262626] pt-6 text-center font-serif italic text-sm text-[#737373] leading-relaxed">
          <div className="text-[#a3a3a3] not-italic font-mono text-[10px] uppercase tracking-[0.2em] mb-2">Machine Philosophy</div>
          <div>Designed to run quietly for years.</div>
          <div>Powered by a Raspberry Pi.</div>
          <div>No cloud required.</div>
        </div>

        {/* Footer */}
        <footer className="pt-8 border-t border-[#262626] flex flex-col gap-6 font-mono text-xs text-[#737373]">
          {/* Row 1: Terms, Privacy, About */}
          <div className="flex items-center justify-center gap-4 text-[#a3a3a3]">
            {onNavigateTerms && (
              <button onClick={onNavigateTerms} className="hover:text-white transition-colors cursor-pointer">
                Terms
              </button>
            )}
            <span className="text-white/10">•</span>
            {onNavigatePrivacy && (
              <button onClick={onNavigatePrivacy} className="hover:text-white transition-colors cursor-pointer">
                Privacy
              </button>
            )}
            {onNavigateAbout && (
              <>
                <span className="text-white/10">•</span>
                <button onClick={onNavigateAbout} className="hover:text-white transition-colors cursor-pointer">
                  About
                </button>
              </>
            )}
          </div>

          {/* Row 2: Quote & Copyright */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 text-[10px] text-[#525252]">
            <button
              onClick={onGoHome}
              className="hover:text-[#4A5D4E] transition-colors cursor-pointer text-[#a3a3a3] uppercase tracking-widest"
            >
              {isLoggedIn ? '← Return to your archive' : '← Return Home'}
            </button>
            <div>© {new Date().getFullYear()} AMNESIA.DAY • Running quietly on a Raspberry Pi</div>
          </div>
        </footer>
      </div>
    </div>
  );
};
