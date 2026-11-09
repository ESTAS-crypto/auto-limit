-- seed.sql: Data contoh untuk Quota Radar
-- Sesuai dengan spesifikasi mockup di paket desain

-- 1. Inisialisasi pengaturan rotasi bawaan
INSERT INTO rotation_settings (id, mode, threshold_pct, tier_priority, stop_when_all_exhausted, rotation_target, quota_semantics)
VALUES (
    1,
    'hybrid',
    5,
    '["ultra", "pro", "free"]'::jsonb,
    true,
    'proxy',
    'remaining'
)
ON CONFLICT (id) DO UPDATE SET
    mode = EXCLUDED.mode,
    threshold_pct = EXCLUDED.threshold_pct,
    tier_priority = EXCLUDED.tier_priority;

-- 2. Inisialisasi pengaturan notifikasi bawaan
INSERT INTO notification_settings (id, webhook_enc, rules, low_quota_pct, daily_summary_time, cooldown_minutes)
VALUES (
    1,
    NULL,
    '{"low_quota": true, "limit_hit": true, "recovered": true, "daily_summary": false}'::jsonb,
    20,
    '08:00',
    30
)
ON CONFLICT (id) DO NOTHING;

-- 3. Akun contoh
DO $$
DECLARE
    id_05 UUID := '00000000-0000-0000-0000-000000000005';
    id_01 UUID := '00000000-0000-0000-0000-000000000001';
    id_02 UUID := '00000000-0000-0000-0000-000000000002';
    id_03 UUID := '00000000-0000-0000-0000-000000000003';
    id_04 UUID := '00000000-0000-0000-0000-000000000004';
    id_06 UUID := '00000000-0000-0000-0000-000000000006';
BEGIN
    INSERT INTO accounts (id, nickname, email, tier, paused, tracked_models, in_rotation)
    VALUES
        (id_05, 'akun-05', 'akun-05@gmail.com', 'ultra', false, ARRAY['claude', 'gemini'], true),
        (id_01, 'akun-01', 'akun-01@gmail.com', 'pro',   false, ARRAY['claude', 'gemini'], true),
        (id_02, 'akun-02', 'akun-02@gmail.com', 'pro',   false, ARRAY['claude', 'gemini'], true),
        (id_03, 'akun-03', 'akun-03@gmail.com', 'pro',   false, ARRAY['claude', 'gemini'], true),
        (id_04, 'akun-04', 'akun-04@gmail.com', 'pro',   false, ARRAY['claude', 'gemini'], true),
        (id_06, 'akun-06', 'akun-06@gmail.com', 'free',  false, ARRAY['claude', 'gemini'], true)
    ON CONFLICT (email) DO NOTHING;

    -- Set active_account_id ke akun-05
    UPDATE rotation_settings SET active_account_id = id_05 WHERE id = 1;

    -- Snapshot kuota untuk tiap akun
    INSERT INTO quota_snapshots (account_id, model, remaining_pct, resets_at, fetched_at)
    VALUES
        -- akun-05 (Ultra, 100% / 100%)
        (id_05, 'claude', 100, now() + interval '3 hours 15 minutes', now()),
        (id_05, 'gemini', 100, now() + interval '2 hours 45 minutes', now()),

        -- akun-01 (Pro, 82% / 95%)
        (id_01, 'claude', 82,  now() + interval '1 hour 20 minutes',  now()),
        (id_01, 'gemini', 95,  now() + interval '3 hours 00 minutes', now()),

        -- akun-02 (Pro, 41% / 70%)
        (id_02, 'claude', 41,  now() + interval '4 hours 10 minutes', now()),
        (id_02, 'gemini', 70,  now() + interval '2 hours 30 minutes', now()),

        -- akun-03 (Pro, 12% / 38% - Hampir Limit)
        (id_03, 'claude', 12,  now() + interval '1 hour 05 minutes',  now()),
        (id_03, 'gemini', 38,  now() + interval '0 hours 50 minutes', now()),

        -- akun-04 (Pro, 0% / 55% - Limit)
        (id_04, 'claude', 0,   now() + interval '2 hours 14 minutes', now()),
        (id_04, 'gemini', 55,  now() + interval '2 hours 14 minutes', now()),

        -- akun-06 (Free, 0% / 0% - Limit)
        (id_06, 'claude', 0,   now() + interval '5 hours 00 minutes', now()),
        (id_06, 'gemini', 0,   now() + interval '5 hours 00 minutes', now());

    -- Riwayat perpindahan (rotation_events)
    INSERT INTO rotation_events (from_account_id, to_account_id, reason, at)
    VALUES
        (id_04, id_05, 'limit', now() - interval '45 minutes'),
        (id_01, id_04, 'below_threshold', now() - interval '2 hours 15 minutes'),
        (id_02, id_01, 'below_threshold', now() - interval '1 day');
END $$;

