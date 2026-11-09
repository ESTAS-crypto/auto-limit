import fs from 'node:fs';
import dotenv from 'dotenv';
import pg from 'pg';
const env = dotenv.parse(fs.readFileSync('.env.local'));
const pool = new pg.Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function check() {
  const { rows: accs } = await pool.query('SELECT id, nickname, email, tier FROM accounts');
  console.log('Accounts in DB:');
  console.log(accs);

  const { rows: rot } = await pool.query('SELECT * FROM rotation_settings');
  console.log('Rotation settings:', rot);

  await pool.end();
}

check();

