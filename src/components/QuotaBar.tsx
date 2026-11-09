import React from 'react';

interface QuotaBarProps {
  label: string;
  value: number; // 0 to 100
  resetText?: string | null;
  className?: string;
}

export const QuotaBar: React.FC<QuotaBarProps> = ({
  label,
  value,
  resetText,
  className = '',
}) => {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));

  let color = '#4ADE9A';
  if (clamped === 0) color = '#FF7A7A';
  else if (clamped <= 20) color = '#F5B544';

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex justify-between text-[13px] text-muted">
        <span>{label}</span>
        <span className="mono">
          {clamped}% {resetText ? `· reset ${resetText}` : ''}
        </span>
      </div>
      <div className="bar">
        <div
          className="fill"
          style={
            {
              '--v': clamped,
              '--c': color,
            } as React.CSSProperties
          }
        />
      </div>
    </div>
  );
};

export default QuotaBar;

