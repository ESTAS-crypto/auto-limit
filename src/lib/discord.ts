/**
 * src/lib/discord.ts
 * Pengiriman notifikasi Discord Webhook dengan Embed warna status,
 * deduplikasi, cooldown, dan pencatatan log.
 */

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordEmbed {
  title: string;
  description: string;
  color: number; // Decimal color code
  fields?: DiscordEmbedField[];
  footer?: { text: string };
  timestamp?: string;
}

export interface SendDiscordNotificationParams {
  webhookUrl: string;
  title: string;
  description: string;
  status: 'aktif' | 'hampir_limit' | 'limit';
  claudePct?: number | null;
  geminiPct?: number | null;
  claudeReset?: string | null;
  geminiReset?: string | null;
  recommendedAccount?: string | null;
}

const STATUS_COLORS = {
  aktif: 0x4ade9a, // Hijau (#4ADE9A)
  hampir_limit: 0xf5b544, // Kuning (#F5B544)
  limit: 0xff7a7a, // Merah (#FF7A7A)
};

// Memory cooldown cache untuk deduplikasi
const cooldownMap = new Map<string, number>();

export function checkCooldown(key: string, cooldownMinutes = 30): boolean {
  const lastSent = cooldownMap.get(key);
  if (!lastSent) return true;
  const now = Date.now();
  const diffMinutes = (now - lastSent) / (1000 * 60);
  return diffMinutes >= cooldownMinutes;
}

export function recordCooldown(key: string): void {
  cooldownMap.set(key, Date.now());
}

export async function sendDiscordWebhook(
  params: SendDiscordNotificationParams
): Promise<{ ok: boolean; status: number; message: string }> {
  const { webhookUrl, title, description, status, claudePct, geminiPct, recommendedAccount } = params;

  if (!webhookUrl || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
    return { ok: false, status: 400, message: 'URL Webhook Discord tidak valid.' };
  }

  const fields: DiscordEmbedField[] = [];

  if (claudePct !== undefined && claudePct !== null) {
    fields.push({
      name: 'Claude Opus',
      value: `${claudePct}%`,
      inline: true,
    });
  }

  if (geminiPct !== undefined && geminiPct !== null) {
    fields.push({
      name: 'Gemini Pro',
      value: `${geminiPct}%`,
      inline: true,
    });
  }

  if (recommendedAccount) {
    fields.push({
      name: 'Disarankan',
      value: recommendedAccount,
      inline: true,
    });
  }

  const embed: DiscordEmbed = {
    title,
    description,
    color: STATUS_COLORS[status] || 0x4ade9a,
    fields,
    footer: { text: 'Quota Radar • Pemantau Antigravity' },
    timestamp: new Date().toISOString(),
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Quota Radar',
        avatar_url: 'https://raw.githubusercontent.com/google/antigravity/main/assets/radar.png',
        embeds: [embed],
      }),
    });

    if (res.ok || res.status === 204) {
      return { ok: true, status: res.status, message: 'Notifikasi berhasil dikirim ke Discord.' };
    }

    const text = await res.text();
    return { ok: false, status: res.status, message: `Discord menolak: ${text}` };
  } catch (err: any) {
    return { ok: false, status: 500, message: `Gagal mengirim ke Discord: ${err.message}` };
  }
}

