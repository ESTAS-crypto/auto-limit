/**
 * worker/index.ts
 * Background Polling Worker untuk Quota Radar.
 * - Melakukan polling kuota berkala dengan interval minimal 60 detik + random jitter.
 * - Pengecekan akun serial satu per satu.
 * - Exponential backoff saat gagal.
 * - Menjalankan mesin evaluasi rotasi (Auto & Hybrid).
 * - Mengirim notifikasi Discord sesuai aturan (low quota, limit hit, recovered) dengan cooldown.
 */

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Muat .env.local
dotenv.config({ path: path.join(rootDir, '.env.local') });

import { getActiveProvider } from '../src/lib/providers/index';
import {
  getAccountsWithStatus,
  getRotationSettings,
  updateRotationSettings,
  saveQuotaSnapshot,
  addRotationEvent,
  getNotificationSettings,
} from '../src/lib/supabase';
import { selectBestAccount, executeWhitelistedAction } from '../src/lib/rotation';
import { sendDiscordWebhook, checkCooldown, recordCooldown } from '../src/lib/discord';
import { decrypt } from '../src/lib/crypto';

// State sebelumnya untuk melacak transisi status
const previousStatuses = new Map<string, string>();

async function pollOnce() {
  const settings = await getRotationSettings();
  const provider = await getActiveProvider();
  console.log(`[Worker] Memulai polling kuota via ${provider.name}...`);

  let results: any[] = [];
  try {
    results = await provider.fetchAccounts(settings.quota_semantics);
  } catch (err: any) {
    console.error(`[Worker] Gagal mengambil kuota dari provider:`, err.message);
    return;
  }

  const accounts = await getAccountsWithStatus();

  // Simpan snapshot untuk tiap akun (serial satu per satu)
  for (const res of results) {
    const acc = accounts.find((a) => a.email.toLowerCase() === res.email.toLowerCase());
    if (acc) {
      if (res.gemini_pct != null && Number.isFinite(res.gemini_pct)) {
        await saveQuotaSnapshot({
          account_id: acc.id,
          model: 'gemini',
          remaining_pct: res.gemini_pct,
          resets_at: res.gemini_resets_at || null,
        });
      }
      if (res.claude_pct != null && Number.isFinite(res.claude_pct)) {
        await saveQuotaSnapshot({
          account_id: acc.id,
          model: 'claude',
          remaining_pct: res.claude_pct,
          resets_at: res.claude_resets_at || null,
        });
      }
      // Delay kecil antar akun untuk serial request
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  // Refresh status terkini
  const refreshedAccounts = await getAccountsWithStatus();
  const activeAccount = refreshedAccounts.find((a) => a.id === settings.active_account_id);

  // 1. Evaluasi Rotasi (Otomatis & Hybrid)
  if (settings.mode === 'auto' || settings.mode === 'hybrid') {
    const activeLowest = activeAccount?.lowest_tracked_pct ?? 0;
    const isExhausted = activeLowest <= settings.threshold_pct || activeAccount?.status === 'limit';

    if (isExhausted) {
      console.log(`[Worker] Akun aktif (${activeAccount?.nickname}) menyentuh ambang (${activeLowest}% <= ${settings.threshold_pct}%). Mencari akun terbaik...`);

      const bestEval = selectBestAccount(refreshedAccounts, {
        threshold_pct: settings.threshold_pct,
        tier_priority: settings.tier_priority,
      });

      if (bestEval.bestAccount && bestEval.bestAccount.id !== activeAccount?.id) {
        const nextAcc = bestEval.bestAccount;
        console.log(`[Worker] Berpindah ke akun terbaik: ${nextAcc.nickname}`);

        if (settings.rotation_target === 'proxy') {
          try {
            await executeWhitelistedAction('use', { nickname: nextAcc.nickname });
          } catch (e: any) {
            console.warn('[Worker] Gagal eksekusi ccs agy --use:', e.message);
          }
        }

        await updateRotationSettings({ active_account_id: nextAcc.id });
        await addRotationEvent({
          from_account_id: activeAccount ? activeAccount.id : null,
          to_account_id: nextAcc.id,
          reason: activeAccount?.status === 'limit' ? 'limit' : 'below_threshold',
        });
      } else if (bestEval.allExhausted) {
        console.warn(`[Worker] Semua akun telah habis!`);
      }
    }
  }

  // 2. Evaluasi Notifikasi Discord
  const notifSettings = await getNotificationSettings();
  if (notifSettings.webhook_enc) {
    let webhookUrl = '';
    try {
      webhookUrl = decrypt(notifSettings.webhook_enc);
    } catch {}

    if (webhookUrl) {
      for (const acc of refreshedAccounts) {
        const prevStatus = previousStatuses.get(acc.id);
        const currentStatus = acc.status;
        const cooldownKey = `${acc.id}-${currentStatus}`;

        // Rule: Limit hit
        if (
          notifSettings.rules.limit_hit &&
          currentStatus === 'limit' &&
          prevStatus !== 'limit' &&
          checkCooldown(cooldownKey, notifSettings.cooldown_minutes)
        ) {
          console.log(`[Worker] Mengirim notifikasi Limit Hit untuk ${acc.nickname}...`);
          await sendDiscordWebhook({
            webhookUrl,
            title: `${acc.nickname} Kena Limit`,
            description: `Salah satu model yang dipantau pada akun ${acc.email} telah mencapai kuota 0%.`,
            status: 'limit',
            claudePct: acc.claude_pct,
            geminiPct: acc.gemini_pct,
            recommendedAccount: activeAccount?.nickname,
          });
          recordCooldown(cooldownKey);
        }

        // Rule: Low quota (Hampir limit)
        if (
          notifSettings.rules.low_quota &&
          currentStatus === 'hampir_limit' &&
          prevStatus === 'aktif' &&
          checkCooldown(cooldownKey, notifSettings.cooldown_minutes)
        ) {
          console.log(`[Worker] Mengirim notifikasi Low Quota untuk ${acc.nickname}...`);
          await sendDiscordWebhook({
            webhookUrl,
            title: `Kuota ${acc.nickname} Hampir Habis`,
            description: `Sisa kuota akun ${acc.email} berada di angka ${acc.lowest_tracked_pct}% (≤ 20%).`,
            status: 'hampir_limit',
            claudePct: acc.claude_pct,
            geminiPct: acc.gemini_pct,
            recommendedAccount: activeAccount?.nickname,
          });
          recordCooldown(cooldownKey);
        }

        // Rule: Recovered
        if (
          notifSettings.rules.recovered &&
          currentStatus === 'aktif' &&
          (prevStatus === 'limit' || prevStatus === 'hampir_limit') &&
          checkCooldown(cooldownKey, notifSettings.cooldown_minutes)
        ) {
          console.log(`[Worker] Mengirim notifikasi Kuota Pulih untuk ${acc.nickname}...`);
          await sendDiscordWebhook({
            webhookUrl,
            title: `Kuota ${acc.nickname} Telah Pulih`,
            description: `Kuota pada akun ${acc.email} telah reset dan kembali aktif siap digunakan (${acc.lowest_tracked_pct}%).`,
            status: 'aktif',
            claudePct: acc.claude_pct,
            geminiPct: acc.gemini_pct,
          });
          recordCooldown(cooldownKey);
        }

        // Simpan status terakhir
        previousStatuses.set(acc.id, currentStatus);
      }
    }
  }
}

async function loop() {
  const baseIntervalSec = parseInt(process.env.POLL_INTERVAL_SECONDS || '60', 10);
  let backoffFactor = 1;

  while (true) {
    try {
      await pollOnce();
      backoffFactor = 1; // Reset backoff jika sukses
    } catch (err: any) {
      console.error('[Worker Loop Error]', err.message);
      backoffFactor = Math.min(backoffFactor * 2, 8); // Exponential backoff max 8x
    }

    // Jitter acak antara -5 sampai +15 detik
    const jitterSec = Math.floor(Math.random() * 20) - 5;
    const nextIntervalSec = Math.max(30, baseIntervalSec * backoffFactor + jitterSec);

    console.log(`[Worker] Pengecekan berikutnya dalam ${nextIntervalSec} detik.`);
    await new Promise((r) => setTimeout(r, nextIntervalSec * 1000));
  }
}

console.log('[Quota Radar Worker] Background Worker berjalan.');
loop().catch((err) => {
  console.error('[Quota Radar Worker Fatal]', err);
  process.exit(1);
});

