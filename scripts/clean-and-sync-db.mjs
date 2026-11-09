import fs from 'node:fs';
import dotenv from 'dotenv';
import pg from 'pg';

const env = dotenv.parse(fs.readFileSync('.env.local'));
const pool = new pg.Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  console.log('1. Membersihkan akun dummy (akun-01 s/d akun-07)...');
  await pool.query("DELETE FROM quota_snapshots WHERE account_id IN (SELECT id FROM accounts WHERE email LIKE 'akun-%@gmail.com')");
  await pool.query("DELETE FROM rotation_events WHERE from_account_id IN (SELECT id FROM accounts WHERE email LIKE 'akun-%@gmail.com') OR to_account_id IN (SELECT id FROM accounts WHERE email LIKE 'akun-%@gmail.com')");
  await pool.query("DELETE FROM accounts WHERE email LIKE 'akun-%@gmail.com'");

  console.log('2. Memastikan akun real terdaftar di database...');
  // Pastikan antigravity109 terdaftar
  const acc109 = await pool.query("SELECT id FROM accounts WHERE email = 'antigravity109@gmail.com'");
  let acc109Id;
  if (acc109.rows.length === 0) {
    const res = await pool.query(
      "INSERT INTO accounts (email, nickname, tier, tracked_models, in_rotation, paused) VALUES ('antigravity109@gmail.com', 'antigravity109', 'free', '{\"claude\", \"gemini\"}', true, false) RETURNING id"
    );
    acc109Id = res.rows[0].id;
  } else {
    acc109Id = acc109.rows[0].id;
  }

  // Ambil ID etiksilawati21
  const etikRes = await pool.query("SELECT id FROM accounts WHERE email = 'etiksilawati21@gmail.com'");
  if (etikRes.rows.length === 0) {
    throw new Error('etiksilawati21@gmail.com not found in accounts');
  }
  const etikId = etikRes.rows[0].id;

  // Ambil ID bangcuy74
  const bangcuyRes = await pool.query("SELECT id FROM accounts WHERE email = 'bangcuy74@gmail.com'");
  let bangcuyId;
  if (bangcuyRes.rows.length === 0) {
    const res = await pool.query(
      "INSERT INTO accounts (email, nickname, tier, tracked_models, in_rotation, paused) VALUES ('bangcuy74@gmail.com', 'bangcuy', 'free', '{\"claude\", \"gemini\"}', true, false) RETURNING id"
    );
    bangcuyId = res.rows[0].id;
  } else {
    bangcuyId = bangcuyRes.rows[0].id;
  }

  // Ambil ID evan (eatharasya)
  const evanRes = await pool.query("SELECT id FROM accounts WHERE email = 'eatharasya@gmail.com'");
  let evanId;
  if (evanRes.rows.length > 0) {
    evanId = evanRes.rows[0].id;
  }

  console.log('3. Memperbarui active_account_id di rotation_settings menjadi etiksilawati21...');
  await pool.query("UPDATE rotation_settings SET active_account_id = $1 WHERE id = 1", [etikId]);

  console.log('4. Memasukkan kuota real yang akurat...');
  // etiksilawati21: Gemini 0% (reset 15 Nov 18:29:44 WIB / 11:29:44 UTC), Claude 100%
  await pool.query(
    "INSERT INTO quota_snapshots (account_id, model, remaining_pct, resets_at, fetched_at) VALUES ($1, 'gemini', 0, '2026-11-15T11:29:44.000Z', NOW())",
    [etikId]
  );
  await pool.query(
    "INSERT INTO quota_snapshots (account_id, model, remaining_pct, resets_at, fetched_at) VALUES ($1, 'claude', 100, '2026-11-16T04:09:07.000Z', NOW())",
    [etikId]
  );

  // bangcuy74: Gemini 0% (reset 15 Nov 18:04:10 WIB / 11:04:10 UTC), Claude 100%
  await pool.query(
    "INSERT INTO quota_snapshots (account_id, model, remaining_pct, resets_at, fetched_at) VALUES ($1, 'gemini', 0, '2026-11-15T11:04:10.000Z', NOW())",
    [bangcuyId]
  );
  await pool.query(
    "INSERT INTO quota_snapshots (account_id, model, remaining_pct, resets_at, fetched_at) VALUES ($1, 'claude', 100, '2026-11-16T04:09:07.000Z', NOW())",
    [bangcuyId]
  );

  // antigravity109: Gemini 100%, Claude 100%
  await pool.query(
    "INSERT INTO quota_snapshots (account_id, model, remaining_pct, resets_at, fetched_at) VALUES ($1, 'gemini', 100, NULL, NOW())",
    [acc109Id]
  );
  await pool.query(
    "INSERT INTO quota_snapshots (account_id, model, remaining_pct, resets_at, fetched_at) VALUES ($1, 'claude', 100, NULL, NOW())",
    [acc109Id]
  );

  // eatharasya: Gemini 100%, Claude 100%
  if (evanId) {
    await pool.query(
      "INSERT INTO quota_snapshots (account_id, model, remaining_pct, resets_at, fetched_at) VALUES ($1, 'gemini', 100, NULL, NOW())",
      [evanId]
    );
    await pool.query(
      "INSERT INTO quota_snapshots (account_id, model, remaining_pct, resets_at, fetched_at) VALUES ($1, 'claude', 100, NULL, NOW())",
      [evanId]
    );
  }

  console.log('5. Hasil view account_status terkini:');
  const statusRes = await pool.query('SELECT nickname, email, status, lowest_tracked_pct, gemini_pct, gemini_resets_at, claude_pct FROM account_status');
  console.table(statusRes.rows);

  await pool.end();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

