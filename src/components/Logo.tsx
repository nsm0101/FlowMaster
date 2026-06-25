import type { CSSProperties } from 'react';

type LogoProps = {
  /** Pixel size of the square wave mark. */
  size?: number;
  /** Render the "PEM FlowMaster" wordmark next to the wave mark. */
  withWordmark?: boolean;
  className?: string;
  style?: CSSProperties;
};

/**
 * PEM FlowMaster brand mark: a cresting wave ("flow") in an ocean-blue badge.
 * Inline SVG so it stays crisp at any size, needs no network request, and can be
 * reused in the hero, headers, and empty states.
 */
export function WaveMark({ size = 40, style, className }: Pick<LogoProps, 'size' | 'style' | 'className'>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="PEM FlowMaster wave logo"
      className={className}
      style={style}
    >
      <defs>
        <linearGradient id="fmWaveBg" x1="8" y1="6" x2="54" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#39B7F0" />
          <stop offset="1" stopColor="#0061B0" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#fmWaveBg)" />
      <path
        d="M10 43 C 9 28, 21 18, 35 20 C 47 22, 51 33, 45 40 C 41 44, 33 44, 32 38 C 31.4 34, 35.5 32.5, 38 35 C 35 31, 28.5 32.5, 28.5 39 C 28.5 46, 37 49, 45 45"
        stroke="#ffffff"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="20" cy="46" r="2.2" fill="#ffffff" />
      <circle cx="27" cy="49" r="1.6" fill="#ffffff" fillOpacity="0.85" />
    </svg>
  );
}

export function Logo({ size = 40, withWordmark = false, className, style }: LogoProps) {
  if (!withWordmark) {
    return <WaveMark size={size} className={className} style={style} />;
  }
  return (
    <span className={`logo ${className ?? ''}`} style={style}>
      <WaveMark size={size} />
      <span className="logoWordmark" aria-hidden="true">
        PEM <b>FlowMaster</b>
      </span>
    </span>
  );
}

export default Logo;
