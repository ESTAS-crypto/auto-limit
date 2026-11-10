import React from 'react';

interface QuotaBarProps {
  label: string;
  value?: number | null; // 0 to 100, or null/undefined if unknown
  resetText?: string | null;
  className?: string;
}

export const QuotaBar: React.FC<QuotaBarProps> = ({
  label,
  value,
  resetText,
  className = '',
}) => {
  const isKnown = typeof value === 'number' && Number.isFinite(value);
  const clamped = isKnown ? Math.max(0, Math.min(100, Math.round(value!))) : 0;

  let color = '#4ADE9A';
  if (!isKnown) color = '#64748B';
  else if (clamped === 0) color = '#FF7A7A';
  else if (clamped <= 20) color = '#F5B544';

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex justify-between text-[13px] text-muted">
        <span>{label}</span>
        <span className="mono">
          {isKnown ? `${clamped}%` : 'Tidak diketahui'}
          {isKnown && resetText ? ` · reset ${resetText}` : ''}
        </span>
      </div>
      <div className="bar">
        <div
          className="fill"
          style={
            {
              '--v': isKnown ? clamped : 0,
              '--c': color,
            } as React.CSSProperties
          }
        />
      </div>
    </div>
  );
};

export default QuotaBar;

