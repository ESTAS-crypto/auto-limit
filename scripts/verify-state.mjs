import fs from 'node:fs';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getAccountsWithStatus, getRotationSettings } from '../src/lib/supabase.ts';
import { getActiveIdeAccount } from '../src/lib/ide-switch.ts';

async function verify() {
  console.log('--- 1. ACTIVE IDE ACCOUNT ---');
  const ideActive = getActiveIdeAccount();
  console.log(ideActive);

  console.log('\n--- 2. ROTATION SETTINGS ---');
  const settings = await getRotationSettings();
  console.log('active_account_id:', settings.active_account_id);

  console.log('\n--- 3. ACCOUNTS WITH STATUS ---');
  const accounts = await getAccountsWithStatus();
  for (const acc of accounts) {
    console.log({
      email: acc.email,
      nickname: acc.nickname,
      status: acc.status,
      gemini_pct: acc.gemini_pct,
      gemini_resets_at: acc.gemini_resets_at,
      claude_pct: acc.claude_pct,
      is_active: acc.id === settings.active_account_id,
    });
  }
}

verify();
