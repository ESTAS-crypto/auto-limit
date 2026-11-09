import React, { useState } from 'react';
import Icon from './Icon';

interface FlashButtonProps {
  children: React.ReactNode;
  successText: string;
  onClick?: () => Promise<void> | void;
  className?: string;
  variant?: 'primary' | 'secondary' | 'icon';
  disabled?: boolean;
}

export const FlashButton: React.FC<FlashButtonProps> = ({
  children,
  successText,
  onClick,
  className = '',
  variant = 'secondary',
  disabled = false,
}) => {
  const [isSuccess, setIsSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (disabled || isSuccess || loading) return;
    try {
      setLoading(true);
      if (onClick) {
        await onClick();
      }
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
      }, 2000);
    } catch {
      // Biarkan jika error ditangani oleh caller
    } finally {
      setLoading(false);
    }
  };

  const baseClass = variant === 'primary' ? 'btn pri' : 'btn';

  return (
    <button
      className={`${baseClass} flash ${isSuccess ? 'success' : ''} ${className}`}
      onClick={handleClick}
      disabled={disabled || loading}
    >
      <span className="l">{children}</span>
      <span className="c" aria-hidden={!isSuccess}>
        <Icon name="check" size={18} />
        {successText}
      </span>
    </button>
  );
};

export default FlashButton;

