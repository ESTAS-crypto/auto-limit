/**
 * src/lib/supabase.ts
 * Akses database Supabase (mendukung direct Postgres connection pool dan Supabase JS client).
 * Menjamin "Secret tidak pernah ke browser": Akses database hanya dijalankan di server.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import pg from 'pg';
import {
  Account,
  AccountWithStatus,
  QuotaSnapshot,
  RotationSettings,
  RotationEvent,
  NotificationSettings,
  NotificationLog,
} from './types';
import { calculateAccountStatus } from './status';

// Cek apakah kredensial Supabase terkonfigurasi
export function isSupabaseConfigured(): boolean {
  if (process.env.DATABASE_URL && (process.env.DATABASE_URL.includes('supabase') || process.env.DATABASE_URL.includes('postgres'))) {
    return true;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(
    url &&
    key &&
    !url.includes('your-project') &&
    !key.includes('your-')
  );
}

// PostgreSQL Connection Pool (Server-only)
let pool: pg.Pool | null = null;
function getPool(): pg.Pool | null {
  if (typeof window !== 'undefined') return null;
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || !dbUrl.includes('postgres')) return null;

  if (!pool) {
    pool = new pg.Pool({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }
  return pool;
}

// Klien Server Supabase REST
let serverClient: SupabaseClient | null = null;
export function getServerSupabase(): SupabaseClient | null {
  if (typeof window !== 'undefined') {
    throw new Error('getServerSupabase tidak boleh dipanggil di browser!');
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key || key.includes('your-')) return null;

  if (!serverClient) {
    serverClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, {
      auth: { persistSession: false },
    });
  }
  return serverClient;
}

// In-Memory Data Store Fallback (ketika database belum dikonfigurasi)
class LocalMockDatabase {
  accounts: Account[] = [
    {
      id: '00000000-0000-0000-0000-000000000005',
      nickname: 'akun-05',
      email: 'akun-05@gmail.com',
      tier: 'ultra',
      paused: false,
      tracked_models: ['claude', 'gemini'],
      in_rotation: true,
      created_at: new Date().toISOString(),
    },
    {
      id: '00000000-0000-0000-0000-000000000001',
      nickname: 'akun-01',
      email: 'akun-01@gmail.com',
      tier: 'pro',
      paused: false,
      tracked_models: ['claude', 'gemini'],
      in_rotation: true,
      created_at: new Date().toISOString(),
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      nickname: 'akun-02',
      email: 'akun-02@gmail.com',
      tier: 'pro',
      paused: false,
      tracked_models: ['claude', 'gemini'],
      in_rotation: true,
      created_at: new Date().toISOString(),
    },
    {
      id: '00000000-0000-0000-0000-000000000003',
      nickname: 'akun-03',
      email: 'akun-03@gmail.com',
      tier: 'pro',
      paused: false,
      tracked_models: ['claude', 'gemini'],
      in_rotation: true,
      created_at: new Date().toISOString(),
    },
    {
      id: '00000000-0000-0000-0000-000000000004',
      nickname: 'akun-04',
      email: 'akun-04@gmail.com',
      tier: 'pro',
      paused: false,
      tracked_models: ['claude', 'gemini'],
      in_rotation: true,
      created_at: new Date().toISOString(),
    },
    {
      id: '00000000-0000-0000-0000-000000000006',
      nickname: 'akun-06',
      email: 'akun-06@gmail.com',
      tier: 'free',
      paused: false,
      tracked_models: ['claude', 'gemini'],
      in_rotation: true,
      created_at: new Date().toISOString(),
    },
  ];

  snapshots: QuotaSnapshot[] = [
    {
      id: 's1',
      account_id: '00000000-0000-0000-0000-000000000005',
      model: 'claude',
      remaining_pct: 100,
      resets_at: new Date(Date.now() + 3.25 * 3600000).toISOString(),
      fetched_at: new Date().toISOString(),
    },
    {
      id: 's2',
      account_id: '00000000-0000-0000-0000-000000000005',
      model: 'gemini',
      remaining_pct: 100,
      resets_at: new Date(Date.now() + 2.75 * 3600000).toISOString(),
      fetched_at: new Date().toISOString(),
    },
    {
      id: 's3',
      account_id: '00000000-0000-0000-0000-000000000001',
      model: 'claude',
      remaining_pct: 82,
      resets_at: new Date(Date.now() + 1.33 * 3600000).toISOString(),
      fetched_at: new Date().toISOString(),
    },
    {
      id: 's4',
      account_id: '00000000-0000-0000-0000-000000000001',
      model: 'gemini',
      remaining_pct: 95,
      resets_at: new Date(Date.now() + 3.0 * 3600000).toISOString(),
      fetched_at: new Date().toISOString(),
    },
    {
      id: 's5',
      account_id: '00000000-0000-0000-0000-000000000002',
      model: 'claude',
      remaining_pct: 41,
      resets_at: new Date(Date.now() + 4.16 * 3600000).toISOString(),
      fetched_at: new Date().toISOString(),
    },
    {
      id: 's6',
      account_id: '00000000-0000-0000-0000-000000000002',
      model: 'gemini',
      remaining_pct: 70,
      resets_at: new Date(Date.now() + 2.5 * 3600000).toISOString(),
      fetched_at: new Date().toISOString(),
    },
    {
      id: 's7',
      account_id: '00000000-0000-0000-0000-000000000003',
      model: 'claude',
      remaining_pct: 12,
      resets_at: new Date(Date.now() + 1.08 * 3600000).toISOString(),
      fetched_at: new Date().toISOString(),
    },
    {
      id: 's8',
      account_id: '00000000-0000-0000-0000-000000000003',
      model: 'gemini',
      remaining_pct: 38,
      resets_at: new Date(Date.now() + 0.83 * 3600000).toISOString(),
      fetched_at: new Date().toISOString(),
    },
    {
      id: 's9',
      account_id: '00000000-0000-0000-0000-000000000004',
      model: 'claude',
      remaining_pct: 0,
      resets_at: new Date(Date.now() + 2.23 * 3600000).toISOString(),
      fetched_at: new Date().toISOString(),
    },
    {
      id: 's10',
      account_id: '00000000-0000-0000-0000-000000000004',
      model: 'gemini',
      remaining_pct: 55,
      resets_at: new Date(Date.now() + 2.23 * 3600000).toISOString(),
      fetched_at: new Date().toISOString(),
    },
    {
      id: 's11',
      account_id: '00000000-0000-0000-0000-000000000006',
      model: 'claude',
      remaining_pct: 0,
      resets_at: new Date(Date.now() + 5.0 * 3600000).toISOString(),
      fetched_at: new Date().toISOString(),
    },
    {
      id: 's12',
      account_id: '00000000-0000-0000-0000-000000000006',
      model: 'gemini',
      remaining_pct: 0,
      resets_at: new Date(Date.now() + 5.0 * 3600000).toISOString(),
      fetched_at: new Date().toISOString(),
    },
  ];

  rotationSettings: RotationSettings = {
    id: 1,
    mode: 'hybrid',
    threshold_pct: 5,
    tier_priority: ['ultra', 'pro', 'free'],
    active_account_id: '00000000-0000-0000-0000-000000000005',
    stop_when_all_exhausted: true,
    rotation_target: 'proxy',
    quota_semantics: 'remaining',
  };

  rotationEvents: RotationEvent[] = [
    {
      id: 'e1',
      from_account_id: '00000000-0000-0000-0000-000000000004',
      to_account_id: '00000000-0000-0000-0000-000000000005',
      reason: 'limit',
      at: new Date(Date.now() - 45 * 60000).toISOString(),
      from_nickname: 'akun-04',
      to_nickname: 'akun-05',
    },
    {
      id: 'e2',
      from_account_id: '00000000-0000-0000-0000-000000000001',
      to_account_id: '00000000-0000-0000-0000-000000000004',
      reason: 'below_threshold',
      at: new Date(Date.now() - 135 * 60000).toISOString(),
      from_nickname: 'akun-01',
      to_nickname: 'akun-04',
    },
    {
      id: 'e3',
      from_account_id: '00000000-0000-0000-0000-000000000002',
      to_account_id: '00000000-0000-0000-0000-000000000001',
      reason: 'below_threshold',
      at: new Date(Date.now() - 86400000).toISOString(),
      from_nickname: 'akun-02',
      to_nickname: 'akun-01',
    },
  ];

  notificationSettings: NotificationSettings = {
    id: 1,
    webhook_enc: null,
    rules: {
      low_quota: true,
      limit_hit: true,
      recovered: true,
      daily_summary: false,
    },
    low_quota_pct: 20,
    daily_summary_time: '08:00',
    cooldown_minutes: 30,
    is_connected: false,
  };
}

const localDb = new LocalMockDatabase();

// --- DATA ACCESS LAYER ---

export async function getAccountsWithStatus(): Promise<AccountWithStatus[]> {
  const pgPool = getPool();
  if (pgPool) {
    try {
      const { rows } = await pgPool.query('SELECT * FROM account_status;');
      const { rows: rotRows } = await pgPool.query('SELECT active_account_id FROM rotation_settings WHERE id = 1;');
      const activeId = rotRows[0]?.active_account_id;

      return rows.map((row: any) => ({
        id: row.account_id,
        nickname: row.nickname,
        email: row.email,
        tier: row.tier,
        paused: row.paused,
        tracked_models: row.tracked_models,
        in_rotation: row.in_rotation,
        created_at: row.created_at,
        claude_pct: row.claude_pct != null ? Number(row.claude_pct) : null,
        claude_resets_at: row.claude_resets_at,
        gemini_pct: row.gemini_pct != null ? Number(row.gemini_pct) : null,
        gemini_resets_at: row.gemini_resets_at,
        mingguan_pct: row.mingguan_pct != null ? Number(row.mingguan_pct) : null,
        mingguan_resets_at: row.mingguan_resets_at,
        lowest_tracked_pct: row.lowest_tracked_pct != null ? Number(row.lowest_tracked_pct) : null,
        status: row.status,
        is_active: row.account_id === activeId,
      }));
    } catch (err: any) {
      console.warn('[DB] PG pool error, fallback:', err.message);
    }
  }

  const supabase = getServerSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase.from('account_status').select('*');
      if (!error && data) {
        const { data: rot } = await supabase.from('rotation_settings').select('active_account_id').single();
        const activeId = rot?.active_account_id;

        return data.map((row: any) => ({
          id: row.account_id,
          nickname: row.nickname,
          email: row.email,
          tier: row.tier,
          paused: row.paused,
          tracked_models: row.tracked_models,
          in_rotation: row.in_rotation,
          created_at: row.created_at,
          claude_pct: row.claude_pct != null ? Number(row.claude_pct) : null,
          claude_resets_at: row.claude_resets_at,
          gemini_pct: row.gemini_pct != null ? Number(row.gemini_pct) : null,
          gemini_resets_at: row.gemini_resets_at,
          mingguan_pct: row.mingguan_pct != null ? Number(row.mingguan_pct) : null,
          mingguan_resets_at: row.mingguan_resets_at,
          lowest_tracked_pct: row.lowest_tracked_pct != null ? Number(row.lowest_tracked_pct) : null,
          status: row.status,
          is_active: row.account_id === activeId,
        }));
      }
    } catch {}
  }

  // Fallback to local memory store
  const activeId = localDb.rotationSettings.active_account_id;
  return localDb.accounts.map((acc) => {
    const claudeSnap = localDb.snapshots
      .filter((s) => s.account_id === acc.id && s.model === 'claude')
      .sort((a, b) => new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime())[0];

    const geminiSnap = localDb.snapshots
      .filter((s) => s.account_id === acc.id && s.model === 'gemini')
      .sort((a, b) => new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime())[0];

    const mingguanSnap = localDb.snapshots
      .filter((s) => s.account_id === acc.id && s.model === 'mingguan')
      .sort((a, b) => new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime())[0];

    const statusCalc = calculateAccountStatus({
      paused: acc.paused,
      tracked_models: acc.tracked_models,
      claude_pct: claudeSnap?.remaining_pct,
      gemini_pct: geminiSnap?.remaining_pct,
      mingguan_pct: mingguanSnap?.remaining_pct,
    });

    return {
      ...acc,
      claude_pct: claudeSnap?.remaining_pct ?? null,
      claude_resets_at: claudeSnap?.resets_at ?? null,
      gemini_pct: geminiSnap?.remaining_pct ?? null,
      gemini_resets_at: geminiSnap?.resets_at ?? null,
      mingguan_pct: mingguanSnap?.remaining_pct ?? null,
      mingguan_resets_at: mingguanSnap?.resets_at ?? null,
      lowest_tracked_pct: statusCalc.lowest_pct,
      status: statusCalc.status,
      is_active: acc.id === activeId,
    };
  });
}

export async function getRotationSettings(): Promise<RotationSettings> {
  const pgPool = getPool();
  if (pgPool) {
    try {
      const { rows } = await pgPool.query('SELECT * FROM rotation_settings WHERE id = 1;');
      if (rows.length > 0) return rows[0] as RotationSettings;
    } catch {}
  }

  const supabase = getServerSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase.from('rotation_settings').select('*').single();
      if (!error && data) return data as RotationSettings;
    } catch {}
  }
  return localDb.rotationSettings;
}

export async function updateRotationSettings(
  patch: Partial<RotationSettings>
): Promise<RotationSettings> {
  const pgPool = getPool();
  if (pgPool) {
    try {
      const keys = Object.keys(patch);
      if (keys.length > 0) {
        const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
        const values = keys.map((k) => {
          const val = (patch as any)[k];
          return Array.isArray(val) ? JSON.stringify(val) : val;
        });
        const { rows } = await pgPool.query(
          `UPDATE rotation_settings SET ${setClauses} WHERE id = 1 RETURNING *;`,
          values
        );
        if (rows.length > 0) return rows[0] as RotationSettings;
      }
    } catch (err: any) {
      console.warn('[DB] PG updateRotationSettings error:', err.message);
    }
  }

  const supabase = getServerSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('rotation_settings')
        .update(patch)
        .eq('id', 1)
        .select()
        .single();
      if (!error && data) return data as RotationSettings;
    } catch {}
  }

  localDb.rotationSettings = { ...localDb.rotationSettings, ...patch };
  return localDb.rotationSettings;
}

export async function getRotationEvents(): Promise<RotationEvent[]> {
  const pgPool = getPool();
  if (pgPool) {
    try {
      const query = `
        SELECT e.*, f.nickname as from_nickname, t.nickname as to_nickname
        FROM rotation_events e
        LEFT JOIN accounts f ON f.id = e.from_account_id
        LEFT JOIN accounts t ON t.id = e.to_account_id
        ORDER BY e.at DESC LIMIT 20;
      `;
      const { rows } = await pgPool.query(query);
      return rows as RotationEvent[];
    } catch {}
  }

  const supabase = getServerSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('rotation_events')
        .select('*, from_acc:accounts!from_account_id(nickname), to_acc:accounts!to_account_id(nickname)')
        .order('at', { ascending: false })
        .limit(20);
      if (!error && data) {
        return data.map((d: any) => ({
          id: d.id,
          from_account_id: d.from_account_id,
          to_account_id: d.to_account_id,
          reason: d.reason,
          at: d.at,
          from_nickname: d.from_acc?.nickname,
          to_nickname: d.to_acc?.nickname,
        }));
      }
    } catch {}
  }
  return localDb.rotationEvents;
}

export async function addRotationEvent(event: Omit<RotationEvent, 'id' | 'at'>): Promise<RotationEvent> {
  const pgPool = getPool();
  if (pgPool) {
    try {
      const { rows } = await pgPool.query(
        `INSERT INTO rotation_events (from_account_id, to_account_id, reason) VALUES ($1, $2, $3) RETURNING *;`,
        [event.from_account_id, event.to_account_id, event.reason]
      );
      if (rows.length > 0) return rows[0] as RotationEvent;
    } catch {}
  }

  const supabase = getServerSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('rotation_events')
        .insert({
          from_account_id: event.from_account_id,
          to_account_id: event.to_account_id,
          reason: event.reason,
        })
        .select()
        .single();
      if (!error && data) return data as RotationEvent;
    } catch {}
  }

  const newEvent: RotationEvent = {
    id: `ev-${Date.now()}`,
    ...event,
    at: new Date().toISOString(),
  };
  localDb.rotationEvents.unshift(newEvent);
  return newEvent;
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const pgPool = getPool();
  if (pgPool) {
    try {
      const { rows } = await pgPool.query('SELECT * FROM notification_settings WHERE id = 1;');
      if (rows.length > 0) {
        return {
          ...rows[0],
          is_connected: Boolean(rows[0].webhook_enc),
        } as NotificationSettings;
      }
    } catch {}
  }

  const supabase = getServerSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase.from('notification_settings').select('*').single();
      if (!error && data) {
        return {
          ...data,
          is_connected: Boolean(data.webhook_enc),
        } as NotificationSettings;
      }
    } catch {}
  }
  return {
    ...localDb.notificationSettings,
    is_connected: Boolean(localDb.notificationSettings.webhook_enc),
  };
}

export async function updateNotificationSettings(
  patch: Partial<NotificationSettings>
): Promise<NotificationSettings> {
  const pgPool = getPool();
  if (pgPool) {
    try {
      const keys = Object.keys(patch);
      if (keys.length > 0) {
        const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
        const values = keys.map((k) => {
          const val = (patch as any)[k];
          return typeof val === 'object' && val !== null ? JSON.stringify(val) : val;
        });
        const { rows } = await pgPool.query(
          `UPDATE notification_settings SET ${setClauses} WHERE id = 1 RETURNING *;`,
          values
        );
        if (rows.length > 0) {
          return { ...rows[0], is_connected: Boolean(rows[0].webhook_enc) } as NotificationSettings;
        }
      }
    } catch {}
  }

  const supabase = getServerSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('notification_settings')
        .update(patch)
        .eq('id', 1)
        .select()
        .single();
      if (!error && data) {
        return { ...data, is_connected: Boolean(data.webhook_enc) } as NotificationSettings;
      }
    } catch {}
  }

  localDb.notificationSettings = { ...localDb.notificationSettings, ...patch };
  return {
    ...localDb.notificationSettings,
    is_connected: Boolean(localDb.notificationSettings.webhook_enc),
  };
}

export async function togglePauseAccount(accountId: string): Promise<Account | null> {
  const pgPool = getPool();
  if (pgPool) {
    try {
      const { rows } = await pgPool.query(
        'UPDATE accounts SET paused = NOT paused WHERE id = $1 RETURNING *;',
        [accountId]
      );
      if (rows.length > 0) return rows[0] as Account;
    } catch {}
  }

  const supabase = getServerSupabase();
  if (supabase) {
    try {
      const { data: cur } = await supabase.from('accounts').select('paused').eq('id', accountId).single();
      if (cur) {
        const { data, error } = await supabase
          .from('accounts')
          .update({ paused: !cur.paused })
          .eq('id', accountId)
          .select()
          .single();
        if (!error && data) return data as Account;
      }
    } catch {}
  }

  const acc = localDb.accounts.find((a) => a.id === accountId);
  if (acc) {
    acc.paused = !acc.paused;
    return acc;
  }
  return null;
}

export async function saveAccount(account: Omit<Account, 'id' | 'created_at'>): Promise<Account> {
  const pgPool = getPool();
  if (pgPool) {
    try {
      const { rows } = await pgPool.query(
        `INSERT INTO accounts (nickname, email, tier, tracked_models, in_rotation)
         VALUES ($1, $2, $3, $4, $5) RETURNING *;`,
        [account.nickname, account.email, account.tier, account.tracked_models, account.in_rotation]
      );
      if (rows.length > 0) return rows[0] as Account;
    } catch {}
  }

  const supabase = getServerSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('accounts')
        .insert(account)
        .select()
        .single();
      if (!error && data) return data as Account;
    } catch {}
  }

  const newAcc: Account = {
    id: `acc-${Date.now()}`,
    ...account,
    created_at: new Date().toISOString(),
  };
  localDb.accounts.push(newAcc);
  return newAcc;
}

export async function saveQuotaSnapshot(snapshot: Omit<QuotaSnapshot, 'id' | 'fetched_at'>): Promise<QuotaSnapshot> {
  const pgPool = getPool();
  if (pgPool) {
    try {
      const { rows } = await pgPool.query(
        `INSERT INTO quota_snapshots (account_id, model, remaining_pct, resets_at)
         VALUES ($1, $2, $3, $4) RETURNING *;`,
        [snapshot.account_id, snapshot.model, snapshot.remaining_pct, snapshot.resets_at]
      );
      if (rows.length > 0) return rows[0] as QuotaSnapshot;
    } catch {}
  }

  const supabase = getServerSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('quota_snapshots')
        .insert(snapshot)
        .select()
        .single();
      if (!error && data) return data as QuotaSnapshot;
    } catch {}
  }

  const newSnap: QuotaSnapshot = {
    id: `snap-${Date.now()}`,
    ...snapshot,
    fetched_at: new Date().toISOString(),
  };
  localDb.snapshots.push(newSnap);
  return newSnap;
}
