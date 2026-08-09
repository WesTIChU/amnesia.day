import React from 'react';
import { AmnesiaLogo } from './AmnesiaLogo';

interface TopBarProps {
  left: React.ReactNode;
  right?: React.ReactNode;
}

export const TopBar: React.FC<TopBarProps> = ({ left, right }) => {
  return (
    <div className="relative border-b border-[#262626] pb-6 font-mono text-xs text-[#737373]">
      <div className="flex flex-col items-center gap-4 sm:grid sm:grid-cols-3 sm:items-center sm:gap-3">
        {/* Mobile logo: on small screens the logo sits above the return row. */}
        <div className="sm:hidden">
          <AmnesiaLogo size="small" />
        </div>

        <div className="flex items-center justify-between w-full gap-3 sm:contents">
          <div className="sm:justify-self-start">{left}</div>

          {/* Desktop logo: centered on the same line as the return link. */}
          <div className="hidden sm:block sm:justify-self-center">
            <AmnesiaLogo size="small" />
          </div>

          {right && <div className="flex items-center gap-3 sm:justify-self-end">{right}</div>}
        </div>
      </div>
    </div>
  );
};
