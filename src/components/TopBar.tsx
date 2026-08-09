import React from 'react';
import { AmnesiaLogo } from './AmnesiaLogo';

interface TopBarProps {
  left: React.ReactNode;
  right?: React.ReactNode;
}

export const TopBar: React.FC<TopBarProps> = ({ left, right }) => {
  return (
    <div className="relative border-b border-[#262626] pb-6 font-mono text-xs text-[#737373]">
      <div className="hidden sm:block absolute left-1/2 -translate-x-1/2">
        <AmnesiaLogo size="small" />
      </div>

      <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div className="sm:hidden">
          <AmnesiaLogo size="small" />
        </div>

        <div className="flex items-center justify-between w-full sm:w-full gap-3">
          {left}
          {right && <div className="ml-auto flex items-center gap-3">{right}</div>}
        </div>
      </div>
    </div>
  );
};
