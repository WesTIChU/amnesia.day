import React from 'react';
import { WEEKDAYS, buildMonthCells, dayKeyFor } from '../../lib/calendar';
import type { CalendarDayMaps } from '../../lib/calendar';

interface MonthCardProps {
  year: number;
  month: number;
  monthName: string;
  maps: CalendarDayMaps;
  todayKey: string;
  selectedDay: string;
  onSelectDay: (key: string) => void;
  compact?: boolean;
  showMonthName?: boolean;
}

// Renders one month's grid. Mobile and desktop share this component so the
// day/status logic (sealed dots, awakened dots, today outline, selection) can
// never drift between the two layouts.
export const MonthCard: React.FC<MonthCardProps> = ({
  year,
  month,
  monthName,
  maps,
  todayKey,
  selectedDay,
  onSelectDay,
  compact = false,
  showMonthName = true,
}) => (
  <div className="bg-[#0e0e0e] border border-[#1f1f1f] p-3">
    {showMonthName && (
      <div className="font-mono text-[10px] text-[#888888] uppercase tracking-widest mb-2">
        {monthName}
      </div>
    )}
    <div className="grid grid-cols-7 gap-px mb-1">
      {WEEKDAYS.map((w) => (
        <div key={w} className="text-center text-[8px] font-mono uppercase tracking-widest text-[#525252]">
          {w}
        </div>
      ))}
    </div>
    <div className="grid grid-cols-7 gap-px">
      {buildMonthCells(year, month).map((day, i) => {
        if (day === null) return <div key={`empty-${i}`} />;
        const key = dayKeyFor(year, month, day);
        const hasSealed = (maps.sealedByDay.get(key)?.length ?? 0) > 0;
        const hasAwakened = (maps.awakenedByDay.get(key)?.length ?? 0) > 0;
        const isSelected = key === selectedDay;
        const isToday = key === todayKey;
        return (
          <button
            key={key}
            onClick={() => onSelectDay(key)}
            aria-label={`${day} ${monthName} ${year}`}
            className={`${
              compact ? 'h-10' : 'aspect-square'
            } flex flex-col items-center justify-center text-[11px] font-mono transition-colors cursor-pointer border ${
              isSelected
                ? 'bg-[#4A5D4E]/15 border-[#4A5D4E]/60 text-[#e5e5e5]'
                : `border-transparent hover:border-[#262626] hover:bg-[#111111] ${
                    hasAwakened || hasSealed ? 'text-[#a3a3a3]' : 'text-[#737373]'
                  } ${isToday ? 'border-[#262626]' : ''}`
            }`}
          >
            <span>{day}</span>
            <span className="flex gap-1 h-1.5 items-center justify-center">
              {hasAwakened && <span className="w-1 h-1 rounded-full bg-[#4A5D4E]" />}
              {hasSealed && <span className="w-1 h-1 rounded-full bg-[#525252]" />}
            </span>
          </button>
        );
      })}
    </div>
  </div>
);
