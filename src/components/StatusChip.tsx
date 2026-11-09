import React from 'react';
import { AccountStatusType } from '@/lib/types';

interface StatusChipProps {
  status: AccountStatusType;
  label?: string;
  className?: string;
}

const STATUS_CONFIG: Record<
  AccountStatusType,
  { defaultLabel: string; color: string }
> = {
  aktif: { defaultLabel: 'Aktif', color: '#4ADE9A' },
  hampir_limit: { defaultLabel: 'Hampir limit', color: '#F5B544' },
  limit: { defaultLabel: 'Limit', color: '#FF7A7A' },
  dijeda: { defaultLabel: 'Dijeda', color: '#9AA1B2' },
  tidak_diketahui: { defaultLabel: 'Tidak diketahui', color: '#9AA1B2' },
};

export const StatusChip: React.FC<StatusChipProps> = ({
  status,
  label,
  className = '',
}) => {
  const conf = STATUS_CONFIG[status] || STATUS_CONFIG.aktif;
  const displayLabel = label || conf.defaultLabel;

  return (
    <span
      className={`chip ${className}`}
      style={{ '--c': conf.color } as React.CSSProperties}
    >
      <i className="dot" />
      {displayLabel}
    </span>
  );
};

export default StatusChip;

