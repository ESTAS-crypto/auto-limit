import React, { useEffect, useState } from 'react';

interface CounterProps {
  value: number;
  className?: string;
  style?: React.CSSProperties;
}

export const Counter: React.FC<CounterProps> = ({ value, className = '', style = {} }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTime: number | null = null;
    const duration = 1600; // 1.6 detik sesuai spesifikasi
    const startVal = displayValue;
    const diff = value - startVal;

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = easeOutCubic(progress);
      setDisplayValue(Math.round(startVal + diff * eased));

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };

    const animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [value]);

  return (
    <span className={`mono ${className}`} style={style}>
      {displayValue}
    </span>
  );
};

export default Counter;

