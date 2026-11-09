import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function check() {
  const { rows } = await pool.query(
    "SELECT qs.id, qs.model, qs.remaining_pct, qs.resets_at, qs.fetched_at FROM quota_snapshots qs JOIN accounts a ON qs.account_id = a.id WHERE a.email = 'etiksilawati21@gmail.com' ORDER BY qs.fetched_at DESC"
  );
  console.log('Total snapshots for etiksilawati21:', rows.length);
  console.log(rows);
  await pool.end();
}

check();

