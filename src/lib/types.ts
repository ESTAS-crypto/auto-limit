/**
 * src/lib/types.ts
 * Tipe data TypeScript lengkap untuk Quota Radar
 */

export type AccountTier = 'ultra' | 'pro' | 'free';
export type TrackedModel = 'claude' | 'gemini';
export type AccountStatusType = 'aktif' | 'hampir_limit' | 'limit' | 'dijeda' | 'tidak_diketahui';

export interface Account {
  id: string;
  nickname: string;
  email: string;
  tier: AccountTier;
  paused: boolean;
  tracked_models: TrackedModel[];
  in_rotation: boolean;
  credentials_enc?: string | null;
  created_at?: string;
}

export interface QuotaSnapshot {
  id: string;
  account_id: string;
  model: TrackedModel;
  remaining_pct: number;
  resets_at: string | null;
  fetched_at: string;
}

export interface AccountWithStatus extends Account {
  claude_pct?: number | null;
  claude_resets_at?: string | null;
  gemini_pct?: number | null;
  gemini_resets_at?: string | null;
  lowest_tracked_pct?: number | null;
  status: AccountStatusType;
  is_active?: boolean;
}

export type RotationMode = 'auto' | 'manual' | 'hybrid';
export type RotationTarget = 'proxy' | 'ide';
export type QuotaSemantics = 'remaining' | 'used';
export type RotationReason = 'limit' | 'below_threshold' | 'manual';

export interface RotationSettings {
  id: number;
  mode: RotationMode;
  threshold_pct: number;
  tier_priority: AccountTier[];
  active_account_id: string | null;
  stop_when_all_exhausted: boolean;
  rotation_target: RotationTarget;
  quota_semantics: QuotaSemantics;
}

export interface RotationEvent {
  id: string;
  from_account_id: string | null;
  to_account_id: string | null;
  reason: RotationReason;
  at: string;
  from_nickname?: string;
  to_nickname?: string;
}

export interface NotificationRules {
  low_quota: boolean;
  limit_hit: boolean;
  recovered: boolean;
  daily_summary: boolean;
}

export interface NotificationSettings {
  id: number;
  webhook_enc: string | null;
  rules: NotificationRules;
  low_quota_pct: number;
  daily_summary_time: string;
  cooldown_minutes: number;
  is_connected?: boolean;
}

export interface NotificationLog {
  id: string;
  kind: string;
  account_id: string | null;
  payload: Record<string, unknown>;
  sent_at: string;
  ok: boolean;
}

export interface ProviderQuotaResult {
  email: string;
  nickname?: string;
  tier: AccountTier;
  claude_pct: number;
  claude_resets_at: string | null;
  gemini_pct: number;
  gemini_resets_at: string | null;
  error?: string;
}

