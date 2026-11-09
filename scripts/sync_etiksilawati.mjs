import fs from 'node:fs';
import dotenv from 'dotenv';
import pg from 'pg';

const env = dotenv.parse(fs.readFileSync('.env.local'));
Object.assign(process.env, env);

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function fix() {
  const accRes = await pool.query("SELECT id FROM accounts WHERE email = 'etiksilawati21@gmail.com'");
  if (accRes.rows.length === 0) {
    console.log('Account not found');
    return;
  }
  const id = accRes.rows[0].id;
  
  // Insert Gemini snapshot 0% with reset at 2026-11-15T11:29:44.000Z
  await pool.query(
    "INSERT INTO quota_snapshots (account_id, model, remaining_pct, resets_at, fetched_at) VALUES ($1, 'gemini', 0, '2026-11-15T11:29:44.000Z', NOW())",
    [id]
  );
  
  // Insert Claude snapshot 100% with reset at 2026-11-16T04:09:07.000Z
  await pool.query(
    "INSERT INTO quota_snapshots (account_id, model, remaining_pct, resets_at, fetched_at) VALUES ($1, 'claude', 100, '2026-11-16T04:09:07.000Z', NOW())",
    [id]
  );
  
  const statusRes = await pool.query("SELECT * FROM account_status WHERE email = 'etiksilawati21@gmail.com'");
  console.log('Updated status:');
  console.log(statusRes.rows[0]);
  await pool.end();
}

fix().catch(err => {
  console.error(err);
  process.exit(1);
});

