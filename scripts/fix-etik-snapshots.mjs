import fs from 'node:fs';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function fixSnapshots() {
  const accRes = await pool.query("SELECT id FROM accounts WHERE email = 'etiksilawati21@gmail.com'");
  const id = accRes.rows[0].id;

  // Hapus semua snapshot gemini 100% yang salah untuk etiksilawati21
  await pool.query("DELETE FROM quota_snapshots WHERE account_id = $1 AND model = 'gemini' AND remaining_pct = 100", [id]);

  // Masukkan snapshot gemini 0% dengan reset yang akurat
  await pool.query(
    "INSERT INTO quota_snapshots (account_id, model, remaining_pct, resets_at, fetched_at) VALUES ($1, 'gemini', 0, '2026-11-15T11:29:44.000Z', NOW())",
    [id]
  );

  const status = await pool.query("SELECT * FROM account_status WHERE email = 'etiksilawati21@gmail.com'");
  console.log('Fixed etiksilawati21 status:');
  console.log(status.rows[0]);

  await pool.end();
}

fixSnapshots();

