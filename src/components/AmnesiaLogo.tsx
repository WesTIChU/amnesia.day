import React, { useState, useEffect, useRef } from 'react';

interface AmnesiaTextProps {
  text: string;
  className?: string;
  autoAnimate?: boolean;
}

export const AmnesiaText: React.FC<AmnesiaTextProps> = ({
  text,
  className = '',
  autoAnimate = true,
}) => {
  const [opacity, setOpacity] = useState<number>(1.0);
  const [softenedIndex, setSoftenedIndex] = useState<number | null>(null);
  const isAnimatingRef = useRef(false);
  const characters = text.split('');

  const triggerEffect = () => {
    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;

    const validIndices = characters
      .map((character, index) => (character.trim() ? index : -1))
      .filter((index) => index !== -1);
    const randomIndex = validIndices[Math.floor(Math.random() * validIndices.length)];

    setOpacity(0.95);
    setSoftenedIndex(randomIndex);

    setTimeout(() => {
      setSoftenedIndex(null);
      setOpacity(1.0);
      setTimeout(() => {
        isAnimatingRef.current = false;
      }, 400);
    }, 800);
  };

  useEffect(() => {
    if (!autoAnimate) return;

    let timer: number | null = null;
    const scheduleNext = () => {
      triggerEffect();
       const nextInterval = Math.floor(Math.random() * (15000 - 5000) + 5000);
      timer = window.setTimeout(scheduleNext, nextInterval);
    };

     const initialDelay = Math.floor(Math.random() * (15000 - 5000) + 5000);
    timer = window.setTimeout(scheduleNext, initialDelay);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [autoAnimate, text]);

  return (
    <span
      className={`inline-block select-none ${className}`}
      style={{
        opacity,
        transition: 'opacity 400ms ease-in-out',
      }}
    >
      {characters.map((character, index) => (
        <span
          key={`${character}-${index}`}
          style={{
            opacity: softenedIndex === index ? 0.25 : 1,
            filter: softenedIndex === index ? 'blur(1.5px)' : 'none',
            transition: 'opacity 400ms ease-in-out, filter 400ms ease-in-out',
          }}
        >
          {character}
        </span>
      ))}
    </span>
  );
};

interface AmnesiaLogoProps {
  className?: string;
  size?: 'large' | 'small';
}

export const AmnesiaLogo: React.FC<AmnesiaLogoProps> = ({
  className = '',
  size = 'large',
}) => {
  const sizeClasses =
    size === 'large'
      ? 'text-3xl sm:text-[48px] tracking-[0.4em]'
      : 'text-sm sm:text-base tracking-[0.35em]';

  return (
    <span className={`inline-flex items-center gap-2 ${size === 'large' ? 'mb-6' : ''} ${className}`}>
      <svg
        aria-hidden="true"
        viewBox="0 0 32 32"
        className={size === 'large' ? 'h-[26px] w-[26px] sm:h-8 sm:w-8' : 'h-3.5 w-3.5'}
        fill="none"
      >
        <circle cx="16" cy="16" r="11" fill="#151515" stroke="#303030" />
        <path d="M22.5 7.5A11 11 0 0 0 21 26.2 11 11 0 0 0 22.5 7.5Z" fill="#4A5D4E" />
      </svg>
      <AmnesiaText
        text="AMNESIA"
        className={`font-light text-white uppercase font-serif ${sizeClasses}`}
        autoAnimate={true}
      />
    </span>
  );
};
