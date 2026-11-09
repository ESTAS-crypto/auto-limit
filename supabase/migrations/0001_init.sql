-- 0001_init.sql: Inisialisasi Database Quota Radar
-- Schema lengkap untuk tabel, view status, RLS ketat, dan Supabase Realtime

-- 1. Tabel accounts
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nickname TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    tier TEXT NOT NULL CHECK (tier IN ('ultra', 'pro', 'free')),
    paused BOOLEAN NOT NULL DEFAULT false,
    tracked_models TEXT[] NOT NULL DEFAULT ARRAY['claude', 'gemini'],
    in_rotation BOOLEAN NOT NULL DEFAULT true,
    credentials_enc TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Tabel quota_snapshots (riwayat snapshot)
CREATE TABLE IF NOT EXISTS quota_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    model TEXT NOT NULL CHECK (model IN ('claude', 'gemini')),
    remaining_pct NUMERIC NOT NULL CHECK (remaining_pct >= 0 AND remaining_pct <= 100),
    resets_at TIMESTAMPTZ,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_acc_fetch ON quota_snapshots (account_id, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_acc_model_fetch ON quota_snapshots (account_id, model, fetched_at DESC);

-- 3. Tabel rotation_settings (singleton 1 baris)
CREATE TABLE IF NOT EXISTS rotation_settings (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    mode TEXT NOT NULL DEFAULT 'hybrid' CHECK (mode IN ('auto', 'manual', 'hybrid')),
    threshold_pct INT NOT NULL DEFAULT 5 CHECK (threshold_pct >= 0 AND threshold_pct <= 50),
    tier_priority JSONB NOT NULL DEFAULT '["ultra", "pro", "free"]'::jsonb,
    active_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    stop_when_all_exhausted BOOLEAN NOT NULL DEFAULT true,
    rotation_target TEXT NOT NULL DEFAULT 'proxy' CHECK (rotation_target IN ('proxy', 'ide')),
    quota_semantics TEXT NOT NULL DEFAULT 'remaining' CHECK (quota_semantics IN ('remaining', 'used'))
);

-- 4. Tabel rotation_events
CREATE TABLE IF NOT EXISTS rotation_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    to_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    reason TEXT NOT NULL CHECK (reason IN ('limit', 'below_threshold', 'manual')),
    at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Tabel notification_settings (singleton 1 baris)
CREATE TABLE IF NOT EXISTS notification_settings (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    webhook_enc TEXT,
    rules JSONB NOT NULL DEFAULT '{"low_quota": true, "limit_hit": true, "recovered": true, "daily_summary": false}'::jsonb,
    low_quota_pct INT NOT NULL DEFAULT 20,
    daily_summary_time TEXT NOT NULL DEFAULT '08:00',
    cooldown_minutes INT NOT NULL DEFAULT 30
);

-- 6. Tabel notification_log
CREATE TABLE IF NOT EXISTS notification_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind TEXT NOT NULL,
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ok BOOLEAN NOT NULL DEFAULT true
);

-- 7. View account_status
-- Mengambil snapshot terbaru per akun dan model, menghitung kuota terendah & status
CREATE OR REPLACE VIEW account_status AS
WITH latest_snapshots AS (
    SELECT DISTINCT ON (account_id, model)
        account_id,
        model,
        remaining_pct,
        resets_at,
        fetched_at
    FROM quota_snapshots
    ORDER BY account_id, model, fetched_at DESC
),
aggregated_models AS (
    SELECT
        a.id AS account_id,
        a.nickname,
        a.email,
        a.tier,
        a.paused,
        a.tracked_models,
        a.in_rotation,
        a.created_at,
        c.remaining_pct AS claude_pct,
        c.resets_at AS claude_resets_at,
        c.fetched_at AS claude_fetched_at,
        g.remaining_pct AS gemini_pct,
        g.resets_at AS gemini_resets_at,
        g.fetched_at AS gemini_fetched_at,
        -- Hitung kuota terendah di antara model yang dipantau
        LEAST(
            CASE WHEN 'claude' = ANY(a.tracked_models) THEN c.remaining_pct ELSE 100 END,
            CASE WHEN 'gemini' = ANY(a.tracked_models) THEN g.remaining_pct ELSE 100 END
        ) AS lowest_tracked_pct,
        -- Cek ketersediaan data snapshot
        (
            ('claude' = ANY(a.tracked_models) AND c.remaining_pct IS NOT NULL) OR
            ('gemini' = ANY(a.tracked_models) AND g.remaining_pct IS NOT NULL)
        ) AS has_valid_snapshot
    FROM accounts a
    LEFT JOIN latest_snapshots c ON c.account_id = a.id AND c.model = 'claude'
    LEFT JOIN latest_snapshots g ON g.account_id = a.id AND g.model = 'gemini'
)
SELECT
    account_id,
    nickname,
    email,
    tier,
    paused,
    tracked_models,
    in_rotation,
    created_at,
    claude_pct,
    claude_resets_at,
    claude_fetched_at,
    gemini_pct,
    gemini_resets_at,
    gemini_fetched_at,
    lowest_tracked_pct,
    CASE
        WHEN paused = true THEN 'dijeda'
        WHEN NOT has_valid_snapshot THEN 'tidak_diketahui'
        WHEN lowest_tracked_pct = 0 THEN 'limit'
        WHEN lowest_tracked_pct > 0 AND lowest_tracked_pct <= 20 THEN 'hampir_limit'
        ELSE 'aktif'
    END AS status
FROM aggregated_models;

-- 8. Row Level Security (RLS)
-- Aktifkan RLS di semua tabel dan tolak semua akses publik/anon
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE quota_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE rotation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE rotation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

-- Tolak akses untuk peran 'anon' dan 'authenticated'
DROP POLICY IF EXISTS "Deny anon access on accounts" ON accounts;
CREATE POLICY "Deny anon access on accounts" ON accounts FOR ALL TO anon USING (false);

DROP POLICY IF EXISTS "Deny anon access on quota_snapshots" ON quota_snapshots;
CREATE POLICY "Deny anon access on quota_snapshots" ON quota_snapshots FOR ALL TO anon USING (false);

DROP POLICY IF EXISTS "Deny anon access on rotation_settings" ON rotation_settings;
CREATE POLICY "Deny anon access on rotation_settings" ON rotation_settings FOR ALL TO anon USING (false);

DROP POLICY IF EXISTS "Deny anon access on rotation_events" ON rotation_events;
CREATE POLICY "Deny anon access on rotation_events" ON rotation_events FOR ALL TO anon USING (false);

DROP POLICY IF EXISTS "Deny anon access on notification_settings" ON notification_settings;
CREATE POLICY "Deny anon access on notification_settings" ON notification_settings FOR ALL TO anon USING (false);

DROP POLICY IF EXISTS "Deny anon access on notification_log" ON notification_log;
CREATE POLICY "Deny anon access on notification_log" ON notification_log FOR ALL TO anon USING (false);

-- Berikan akses penuh untuk service_role (server backend lokal)
DROP POLICY IF EXISTS "Service role full access on accounts" ON accounts;
CREATE POLICY "Service role full access on accounts" ON accounts FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on quota_snapshots" ON quota_snapshots;
CREATE POLICY "Service role full access on quota_snapshots" ON quota_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on rotation_settings" ON rotation_settings;
CREATE POLICY "Service role full access on rotation_settings" ON rotation_settings FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on rotation_events" ON rotation_events;
CREATE POLICY "Service role full access on rotation_events" ON rotation_events FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on notification_settings" ON notification_settings;
CREATE POLICY "Service role full access on notification_settings" ON notification_settings FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on notification_log" ON notification_log;
CREATE POLICY "Service role full access on notification_log" ON notification_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 9. Realtime Publication
-- Aktifkan Realtime hanya untuk quota_snapshots, accounts, dan rotation_events
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE quota_snapshots, accounts, rotation_events;
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;
END $$;

