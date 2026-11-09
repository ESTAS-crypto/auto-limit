import React from 'react';

export type IconName =
  | 'radar'
  | 'stack'
  | 'bell'
  | 'loop'
  | 'plus'
  | 'bolt'
  | 'chat'
  | 'shield'
  | 'clock'
  | 'pause'
  | 'link'
  | 'check';

interface IconProps {
  name: IconName;
  className?: string;
  size?: number;
  style?: React.CSSProperties;
}

export const Icon: React.FC<IconProps> = ({ name, className = '', size = 20, style = {} }) => {
  return (
    <i
      className={`ic ic-${name} ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        ...style,
      }}
      aria-hidden="true"
    />
  );
};

export default Icon;

