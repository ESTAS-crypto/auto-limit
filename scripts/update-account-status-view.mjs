import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function updateView() {
  console.log('Updating account_status view to include mingguan dimension...');
  await pool.query(`DROP VIEW IF EXISTS account_status CASCADE;`);

  const sql = `
CREATE VIEW account_status AS
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
        m.remaining_pct AS mingguan_pct,
        m.resets_at AS mingguan_resets_at,
        m.fetched_at AS mingguan_fetched_at,
        -- Hitung kuota terendah di antara Claude, Gemini, dan Mingguan (jika ada)
        LEAST(
            COALESCE(CASE WHEN 'claude' = ANY(a.tracked_models) THEN c.remaining_pct ELSE NULL END, c.remaining_pct),
            COALESCE(CASE WHEN 'gemini' = ANY(a.tracked_models) THEN g.remaining_pct ELSE NULL END, g.remaining_pct),
            m.remaining_pct
        ) AS lowest_tracked_pct,
        -- Cek ketersediaan data snapshot
        (
            c.remaining_pct IS NOT NULL OR
            g.remaining_pct IS NOT NULL OR
            m.remaining_pct IS NOT NULL
        ) AS has_valid_snapshot
    FROM accounts a
    LEFT JOIN latest_snapshots c ON c.account_id = a.id AND c.model = 'claude'
    LEFT JOIN latest_snapshots g ON g.account_id = a.id AND g.model = 'gemini'
    LEFT JOIN latest_snapshots m ON m.account_id = a.id AND m.model = 'mingguan'
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
    mingguan_pct,
    mingguan_resets_at,
    mingguan_fetched_at,
    lowest_tracked_pct,
    CASE
        WHEN paused = true THEN 'dijeda'
        WHEN NOT has_valid_snapshot OR lowest_tracked_pct IS NULL THEN 'tidak_diketahui'
        WHEN lowest_tracked_pct <= 15 THEN 'limit'
        WHEN lowest_tracked_pct <= 25 THEN 'hampir_limit'
        ELSE 'aktif'
    END AS status
FROM aggregated_models;
`;

  await pool.query(sql);
  console.log('✔ View account_status berhasil dibuat ulang dengan kolom mingguan_pct!');

  try {
    await pool.query(`ALTER TABLE quota_snapshots DROP CONSTRAINT IF EXISTS quota_snapshots_model_check;`);
    await pool.query(`ALTER TABLE quota_snapshots ADD CONSTRAINT quota_snapshots_model_check CHECK (model IN ('claude', 'gemini', 'mingguan'));`);
    console.log('✔ Constraint quota_snapshots model diperbarui untuk claude, gemini, mingguan!');
  } catch (e) {
    console.log('Constraint note:', e.message);
  }

  // Update default tracked_models in accounts to include mingguan
  try {
    await pool.query(`UPDATE accounts SET tracked_models = '["claude", "gemini", "mingguan"]'::jsonb WHERE NOT tracked_models @> '["mingguan"]'::jsonb;`);
    console.log('✔ Akun diupdate dengan tracked_models: claude, gemini, mingguan!');
  } catch (e) {
    console.log('Tracked models note:', e.message);
  }

  // Bersihkan snapshot palsu/lama yang dibuat manual di database
  try {
    await pool.query(`DELETE FROM quota_snapshots WHERE account_id IN (SELECT id FROM accounts WHERE email = 'etiksilawati21@gmail.com') AND fetched_at < now() - INTERVAL '1 hour';`);
    console.log('✔ Snapshot lama dibersihkan!');
  } catch (e) {
    console.log('Cleanup note:', e.message);
  }

  await pool.end();
}

updateView().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
