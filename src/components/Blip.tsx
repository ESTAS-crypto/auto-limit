import React from 'react';

export type BlipMood = 'senang' | 'cemas' | 'tidur';

interface BlipProps {
  mood?: BlipMood;
  className?: string;
  size?: number;
  style?: React.CSSProperties;
}

export const Blip: React.FC<BlipProps> = ({
  mood = 'senang',
  className = '',
  size = 96,
  style = {},
}) => {
  const moodClass = mood === 'senang' ? 'stk-ok' : mood === 'cemas' ? 'stk-warn' : 'stk-sleep';

  return (
    <i
      className={`stk ${moodClass} ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        ...style,
      }}
      role="img"
      aria-label={`Maskot Blip suasana ${mood}`}
    />
  );
};

export default Blip;

