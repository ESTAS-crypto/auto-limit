import React from 'react';

interface RingProps {
  value: number; // 0 to 100
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
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  // Circumference for r=26 is ~163.36
  const offset = 163.4 * (1 - clamped / 100);

  let color = '#4ADE9A';
  if (clamped === 0) color = '#FF7A7A';
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
        aria-label={`Sisa kuota ${clamped} persen`}
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
        {clamped}
      </b>
    </div>
  );
};

export default Ring;

