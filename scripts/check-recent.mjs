import fs from 'node:fs';
import dotenv from 'dotenv';
import pg from 'pg';
const env = dotenv.parse(fs.readFileSync('.env.local'));
const pool = new pg.Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function checkRecentSnapshots() {
  const { rows } = await pool.query(`
    SELECT qs.id, a.email, qs.model, qs.remaining_pct, qs.resets_at, qs.fetched_at 
    FROM quota_snapshots qs
    JOIN accounts a ON qs.account_id = a.id
    ORDER BY qs.fetched_at DESC
    LIMIT 20
  `);
  console.log(rows);
  await pool.end();
}

checkRecentSnapshots();

