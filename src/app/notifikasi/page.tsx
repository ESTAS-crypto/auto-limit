'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Navbar from '@/components/Navbar';
import Icon from '@/components/Icon';
import Switch from '@/components/Switch';
import FlashButton from '@/components/FlashButton';
import StatusChip from '@/components/StatusChip';

interface NotificationSettingsResponse {
  is_connected: boolean;
  masked_webhook: string;
  rules: {
    low_quota: boolean;
    limit_hit: boolean;
    recovered: boolean;
    daily_summary: boolean;
  };
  low_quota_pct: number;
  daily_summary_time: string;
  cooldown_minutes: number;
}

export default function NotifikasiPage() {
  const queryClient = useQueryClient();
  const [webhookUrl, setWebhookUrl] = useState('');
  const [rules, setRules] = useState({
    low_quota: true,
    limit_hit: true,
    recovered: true,
    daily_summary: false,
  });

  const { data, isLoading } = useQuery<{ ok: boolean; data: NotificationSettingsResponse }>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await fetch('/api/notifications');
      return res.json();
    },
  });

  useEffect(() => {
    if (data?.data) {
      if (data.data.rules) setRules(data.data.rules);
      if (data.data.masked_webhook && !webhookUrl) {
        setWebhookUrl(data.data.masked_webhook);
      }
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = { rules };
      if (webhookUrl && !webhookUrl.includes('••••')) {
        payload.webhook_url = webhookUrl;
      }
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {};
      if (webhookUrl && !webhookUrl.includes('••••')) {
        payload.webhook_url = webhookUrl;
      }
      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Gagal tes kirim');
      return json;
    },
  });

  const isConnected = data?.data?.is_connected;

  return (
    <div className="pg min-h-screen px-4 md:px-8 py-7 pb-24 md:pb-14">
      <div className="wrap">
        <Navbar />

        {/* Title */}
        <div className="rise mt-10" style={{ '--i': 2 } as React.CSSProperties}>
          <h1 className="h1 text-4xl sm:text-5xl">Notifikasi Discord</h1>
          <p className="sub text-base mt-2">
            Dapat kabar di Discord tiap ada akun yang hampir atau sudah kena limit.
          </p>
        </div>

        {/* Form and Preview Layout */}
        <div className="two items-start">
          <div className="space-y-4">
            {/* Webhook Card */}
            <div className="card rise p-6 sm:p-7" style={{ '--i': 3 } as React.CSSProperties}>
              <div className="flex justify-between items-center gap-2.5 mb-4.5">
                <div className="t font-medium">Webhook</div>
                <StatusChip
                  status={isConnected ? 'aktif' : 'dijeda'}
                  label={isConnected ? 'Terhubung' : 'Belum terhubung'}
                />
              </div>

              <label className="lbl" htmlFor="wh">
                URL webhook Discord
              </label>
              <input
                className="in mono text-sm"
                id="wh"
                placeholder="https://discord.com/api/webhooks/..."
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
              />

              <div className="flex gap-3 mt-5 flex-wrap">
                <FlashButton
                  variant="primary"
                  successText="Terkirim"
                  onClick={() => testMutation.mutateAsync()}
                  disabled={testMutation.isPending}
                >
                  <Icon name="chat" size={16} />
                  <span>{testMutation.isPending ? 'Mengirim...' : 'Tes kirim'}</span>
                </FlashButton>

                <FlashButton
                  variant="secondary"
                  successText="Tersimpan"
                  onClick={() => saveMutation.mutateAsync()}
                  disabled={saveMutation.isPending}
                >
                  <Icon name="check" size={16} />
                  <span>{saveMutation.isPending ? 'Menyimpan...' : 'Simpan'}</span>
                </FlashButton>
              </div>
            </div>

            {/* Notification Rules Card */}
            <div className="card rise px-6 sm:px-7 py-2" style={{ '--i': 4 } as React.CSSProperties}>
              <div className="t font-medium pt-4.5 pb-1">Kapan dikirim</div>

              <div className="opt">
                <div>
                  <div className="t text-sm">Kuota hampir habis</div>
                  <div className="sub text-xs">Kirim saat sisa di bawah ambang batas (≤ 20%)</div>
                </div>
                <Switch
                  checked={rules.low_quota}
                  onChange={(val) => setRules((r) => ({ ...r, low_quota: val }))}
                  ariaLabel="Kuota hampir habis"
                />
              </div>

              <div className="opt">
                <div>
                  <div className="t text-sm">Akun kena limit</div>
                  <div className="sub text-xs">Kirim saat sisa kuota 0%</div>
                </div>
                <Switch
                  checked={rules.limit_hit}
                  onChange={(val) => setRules((r) => ({ ...r, limit_hit: val }))}
                  ariaLabel="Akun kena limit"
                />
              </div>

              <div className="opt">
                <div>
                  <div className="t text-sm">Akun pulih</div>
                  <div className="sub text-xs">Kirim saat kuota kembali terisi setelah reset</div>
                </div>
                <Switch
                  checked={rules.recovered}
                  onChange={(val) => setRules((r) => ({ ...r, recovered: val }))}
                  ariaLabel="Akun pulih"
                />
              </div>

              <div className="opt">
                <div>
                  <div className="t text-sm">Ringkasan harian</div>
                  <div className="sub text-xs">Rekap semua akun tiap pukul 08:00 pagi</div>
                </div>
                <Switch
                  checked={rules.daily_summary}
                  onChange={(val) => setRules((r) => ({ ...r, daily_summary: val }))}
                  ariaLabel="Ringkasan harian"
                />
              </div>
            </div>
          </div>

          {/* Right Column: Live Discord Message Preview */}
          <div
            className="card rise p-5 sm:p-6 bg-[#1E2128]"
            style={{ '--i': 5 } as React.CSSProperties}
          >
            <div className="sub mb-4 text-xs font-medium">Pratinjau pesan Discord</div>

            <div className="flex gap-3">
              <i
                className="logo w-10 h-10 flex-none"
                style={{ animation: 'none' }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">Quota Radar</span>
                  <span
                    className="chip text-[11px] py-0.5 px-2"
                    style={{ '--c': '#7C8CFF' } as React.CSSProperties}
                  >
                    BOT
                  </span>
                </div>

                <div className="mt-2.5 p-4 rounded-xl bg-[#2A2E37] grid gap-3 border-l-4 border-radar-red">
                  <div className="t text-radar-red font-medium">akun-04 kena limit</div>
                  <div className="sub text-xs">
                    Claude Opus habis (0%). Reset dalam 2j 14m.
                  </div>
                  <div className="flex gap-6 text-xs">
                    <div>
                      <div className="sub">Gemini</div>
                      <div className="mono font-medium text-foreground">55%</div>
                    </div>
                    <div>
                      <div className="sub">Disarankan</div>
                      <div className="mono font-medium text-radar-green">akun-05</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

