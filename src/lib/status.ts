/**
 * src/lib/status.ts
 * Logika penentuan status akun berdasarkan sisa kuota model yang dipantau.
 */

import { AccountStatusType, TrackedModel } from './types';

export interface StatusInput {
  paused: boolean;
  tracked_models: TrackedModel[];
  claude_pct?: number | null;
  gemini_pct?: number | null;
  has_error?: boolean;
}

export interface StatusOutput {
  status: AccountStatusType;
  lowest_pct: number | null;
  statusLabel: string;
  colorHex: string;
}

export function calculateAccountStatus(input: StatusInput): StatusOutput {
  // 1. Akun yang dijeda
  if (input.paused) {
    return {
      status: 'dijeda',
      lowest_pct: null,
      statusLabel: 'Dijeda',
      colorHex: '#9AA1B2',
    };
  }

  // 2. Jika ada kegagalan pengecekan atau snapshot tidak tersedia
  if (input.has_error) {
    return {
      status: 'tidak_diketahui',
      lowest_pct: null,
      statusLabel: 'Tidak diketahui',
      colorHex: '#9AA1B2',
    };
  }

  const tracked = input.tracked_models || ['claude', 'gemini'];
  const values: number[] = [];

  if (tracked.includes('claude') && typeof input.claude_pct === 'number') {
    values.push(input.claude_pct);
  }
  if (tracked.includes('gemini') && typeof input.gemini_pct === 'number') {
    values.push(input.gemini_pct);
  }

  // Jika tidak ada data kuota sama sekali untuk model yang dipantau
  if (values.length === 0) {
    return {
      status: 'tidak_diketahui',
      lowest_pct: null,
      statusLabel: 'Tidak diketahui',
      colorHex: '#9AA1B2',
    };
  }

  // Sisa kuota terendah di antara model yang dipantau
  const minPct = Math.min(...values);

  // Status Rules:
  // - Limit: salah satu model yang dipantau bernilai 0%
  if (minPct === 0) {
    return {
      status: 'limit',
      lowest_pct: 0,
      statusLabel: 'Limit',
      colorHex: '#FF7A7A',
    };
  }

  // - Hampir limit: terendah > 0% dan <= 20%
  if (minPct <= 20) {
    return {
      status: 'hampir_limit',
      lowest_pct: minPct,
      statusLabel: 'Hampir limit',
      colorHex: '#F5B544',
    };
  }

  // - Aktif (siap dipakai): di atas 20%
  return {
    status: 'aktif',
    lowest_pct: minPct,
    statusLabel: 'Aktif',
    colorHex: '#4ADE9A',
  };
}

export function formatResetTime(isoOrText?: string | null): string {
  if (!isoOrText) return '-';
  // Jika sudah format "03:15"
  if (/^\d{2}:\d{2}$/.test(isoOrText)) return isoOrText;

  try {
    const d = new Date(isoOrText);
    if (!isNaN(d.getTime())) {
      const hours = d.getHours().toString().padStart(2, '0');
      const minutes = d.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    }
  } catch {}

  return isoOrText;
}

export function formatRelativeTime(isoDate?: string | null): string {
  if (!isoDate) return '-';
  try {
    const target = new Date(isoDate).getTime();
    const now = Date.now();
    const diffMs = target - now;

    if (diffMs <= 0) return 'sekarang';

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 0) {
      return `${diffHours}j ${diffMinutes}m`;
    }
    return `${diffMinutes}m`;
  } catch {
    return isoDate;
  }
}

