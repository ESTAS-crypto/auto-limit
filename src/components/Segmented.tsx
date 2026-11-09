import React from 'react';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  name?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className = '',
  name = 'segmented_ctrl',
}: SegmentedProps<T>) {
  const activeIndex = options.findIndex((o) => o.value === value);

  return (
    <div
      className={`seg2 ${className}`}
      style={{ '--n': options.length } as React.CSSProperties}
    >
      {options.map((opt, idx) => (
        <React.Fragment key={opt.value}>
          <input
            type="radio"
            name={name}
            id={`${name}_${idx}`}
            checked={opt.value === value}
            onChange={() => onChange(opt.value)}
          />
          <label htmlFor={`${name}_${idx}`}>{opt.label}</label>
        </React.Fragment>
      ))}
      <i
        className="ind"
        style={{
          transform: `translateX(${activeIndex * 100}%)`,
        }}
      />
    </div>
  );
}

export default Segmented;

