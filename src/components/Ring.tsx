import React from 'react';

interface RingProps {
  value?: number | null; // 0 to 100, or null if unknown
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export const Ring: React.FC<RingProps> = ({
  value,
  size = 64,
  strokeWidth = 6,
  className = '',
}) => {
  const isKnown = typeof value === 'number' && Number.isFinite(value);
  const clamped = isKnown ? Math.max(0, Math.min(100, Math.round(value!))) : 0;
  // Circumference for r=26 is ~163.36
  const offset = isKnown ? 163.4 * (1 - clamped / 100) : 163.4;

  let color = '#4ADE9A';
  if (!isKnown) color = '#64748B';
  else if (clamped === 0) color = '#FF7A7A';
  else if (clamped <= 20) color = '#F5B544';

  return (
    <div
      className={`rw ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        role="img"
        aria-label={isKnown ? `Sisa kuota ${clamped} persen` : 'Sisa kuota tidak diketahui'}
      >
        <circle className="track" cx="32" cy="32" r="26" strokeWidth={strokeWidth} />
        <circle
          className="ring"
          cx="32"
          cy="32"
          r="26"
          strokeWidth={strokeWidth}
          style={
            {
              '--c': color,
              '--o': `${offset}`,
            } as React.CSSProperties
          }
        />
      </svg>
      <b className="mono" style={{ fontSize: size <= 56 ? '13px' : '15px' }}>
        {isKnown ? clamped : '?'}
      </b>
    </div>
  );
};

export default Ring;

