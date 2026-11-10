'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Navbar from '@/components/Navbar';
import Ring from '@/components/Ring';
import QuotaBar from '@/components/QuotaBar';
import StatusChip from '@/components/StatusChip';
import Icon from '@/components/Icon';
import Blip from '@/components/Blip';
import Switch from '@/components/Switch';
import FlashButton from '@/components/FlashButton';
import Counter from '@/components/Counter';
import { AccountWithStatus, RotationSettings, RotationEvent } from '@/lib/types';
import { formatResetTime, formatRelativeTime } from '@/lib/status';
import { selectBestAccount } from '@/lib/rotation-eval';

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'aktif' | 'hampir_limit' | 'limit'>('all');

  // Fetch accounts
  const { data: accountsData, isLoading: loadingAccounts, isFetching: isSyncing } = useQuery<{
    ok: boolean;
    data: AccountWithStatus[];
  }>({
    queryKey: ['accounts'],
    queryFn: async () => {
      const res = await fetch('/api/accounts');
      return res.json();
    },
    refetchInterval: 15000,
  });

  // Fetch rotation
  const { data: rotationData } = useQuery<{
    ok: boolean;
    data: { settings: RotationSettings; events: RotationEvent[] };
  }>({
    queryKey: ['rotation'],
    queryFn: async () => {
      const res = await fetch('/api/rotation');
      return res.json();
    },
    refetchInterval: 15000,
  });

  // Manual sync mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/poll', { method: 'POST' });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['rotation'] });
    },
  });

  // Switch account mutation
  const switchMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const res = await fetch('/api/rotation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'switch', account_id: accountId }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['rotation'] });
    },
  });

  // Toggle mode mutation
  const modeMutation = useMutation({
    mutationFn: async (newMode: 'auto' | 'manual' | 'hybrid') => {
      const res = await fetch('/api/rotation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: newMode }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rotation'] });
    },
  });

  const accounts = accountsData?.data || [];
  const settings = rotationData?.data?.settings;
  const events = rotationData?.data?.events || [];
  const isIdeTarget = (settings?.rotation_target || 'ide') === 'ide';

  // Summary counts
  const totalCount = accounts.length;
  const readyCount = accounts.filter((a) => a.status === 'aktif').length;
  const nearLimitCount = accounts.filter((a) => a.status === 'hampir_limit').length;
  const limitCount = accounts.filter((a) => a.status === 'limit').length;

  // Filtered accounts
  const filteredAccounts = accounts.filter((acc) => {
    if (filter === 'all') return true;
    return acc.status === filter;
  });

  // Best account recommendation
  const bestEval = settings
    ? selectBestAccount(accounts, {
        threshold_pct: settings.threshold_pct,
        tier_priority: settings.tier_priority,
      })
    : { bestAccount: null, allExhausted: false, fastestResetAccount: null, fastestResetTime: null };

  const recommended = bestEval.bestAccount;

  return (
    <div className="pg min-h-screen px-4 md:px-8 py-7 pb-24 md:pb-14">
      <div className="wrap">
        {/* Navigation */}
        <Navbar onRefresh={() => syncMutation.mutate()} isSyncing={isSyncing} />

        {/* Header Title */}
        <div className="rise mt-10 md:mt-11" style={{ '--i': 2 } as React.CSSProperties}>
          <h1 className="h1 text-4xl sm:text-5xl md:text-[56px] leading-[1.02]">
            Semua akun, satu layar.
          </h1>
          <p className="sub text-base sm:text-[17px] mt-3.5 max-w-[620px]">
            Pantau sisa kuota Antigravity tiap akun Google dan langsung tahu kapan harus ganti.
          </p>
        </div>

        {/* 4 Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5 mt-8 md:mt-10">
          <div
            className="card rise p-5 sm:p-6"
            style={{ '--i': 3 } as React.CSSProperties}
          >
            <div className="sub flex items-center gap-2">
              <Icon name="stack" size={16} />
              <span>Total akun</span>
            </div>
            <div className="text-3xl sm:text-[44px] mt-1.5 font-bold">
              <Counter value={totalCount} />
            </div>
          </div>

          <div
            className="card rise p-5 sm:p-6"
            style={{ '--i': 4 } as React.CSSProperties}
          >
            <div className="sub flex items-center gap-2 text-radar-green">
              <Icon name="check" size={16} />
              <span>Siap dipakai</span>
            </div>
            <div className="text-3xl sm:text-[44px] mt-1.5 font-bold text-radar-green">
              <Counter value={readyCount} />
            </div>
          </div>

          <div
            className="card rise p-5 sm:p-6"
            style={{ '--i': 5 } as React.CSSProperties}
          >
            <div className="sub flex items-center gap-2 text-radar-yellow">
              <Icon name="clock" size={16} />
              <span>Hampir limit</span>
            </div>
            <div className="text-3xl sm:text-[44px] mt-1.5 font-bold text-radar-yellow">
              <Counter value={nearLimitCount} />
            </div>
          </div>

          <div
            className="card rise p-5 sm:p-6"
            style={{ '--i': 6 } as React.CSSProperties}
          >
            <div className="sub flex items-center gap-2 text-radar-red">
              <Icon name="bolt" size={16} />
              <span>Kena limit</span>
            </div>
            <div className="text-3xl sm:text-[44px] mt-1.5 font-bold text-radar-red">
              <Counter value={limitCount} />
            </div>
          </div>
        </div>

        {/* Main 2-column Grid */}
        <div className="two items-start !mt-10 md:!mt-12">
          {/* Left Column: Filter & Account Cards */}
          <div>
            {/* Filter Tabs */}
            <div
              className="rise flex gap-3 flex-wrap mb-6"
              style={{ '--i': 7 } as React.CSSProperties}
            >
              <button
                className="tab px-4.5 py-2 text-sm font-medium transition-all"
                aria-pressed={filter === 'all'}
                onClick={() => setFilter('all')}
              >
                Semua · {totalCount}
              </button>
              <button
                className="tab px-4.5 py-2 text-sm font-medium transition-all"
                aria-pressed={filter === 'aktif'}
                onClick={() => setFilter('aktif')}
              >
                Aktif · {readyCount}
              </button>
              <button
                className="tab px-4.5 py-2 text-sm font-medium transition-all"
                aria-pressed={filter === 'hampir_limit'}
                onClick={() => setFilter('hampir_limit')}
              >
                Hampir limit · {nearLimitCount}
              </button>
              <button
                className="tab px-4.5 py-2 text-sm font-medium transition-all"
                aria-pressed={filter === 'limit'}
                onClick={() => setFilter('limit')}
              >
                Limit · {limitCount}
              </button>
            </div>

            {/* Account Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {filteredAccounts.map((acc, idx) => {
                const isLimit = acc.status === 'limit';
                const cardClass = isLimit ? 'card hot p-5.5 sm:p-6' : 'card rise ld p-5.5 sm:p-6';
                const overallPct =
                  typeof acc.lowest_tracked_pct === 'number' && Number.isFinite(acc.lowest_tracked_pct)
                    ? acc.lowest_tracked_pct
                    : null;

                return (
                  <div
                    key={acc.id}
                    className={cardClass}
                    style={
                      {
                        '--i': 8 + idx,
                        '--c':
                          acc.status === 'limit'
                            ? '#FF7A7A'
                            : acc.status === 'hampir_limit'
                            ? '#F5B544'
                            : '#4ADE9A',
                      } as React.CSSProperties
                    }
                  >
                    <div className="flex justify-between items-center gap-2.5 pb-1">
                      <div className="min-w-0">
                        <div className="mono text-sm truncate font-medium">
                          {acc.email}
                        </div>
                        <div className="sub text-xs mt-0.5 capitalize">
                          {acc.tier}{' '}
                          {acc.is_active ? '· dipakai sekarang' : ''}
                        </div>
                      </div>
                      <StatusChip status={acc.status} />
                    </div>

                    <div className="flex gap-4 sm:gap-5 items-center mt-5">
                      <Ring value={overallPct} size={64} />
                      <div className="flex-1 grid gap-2.5">
                        <QuotaBar
                          label={`Gemini (mingguan)${acc.gemini_source === 'manual' ? ' (manual)' : ''}`}
                          value={acc.gemini_pct}
                          resetText={formatResetTime(acc.gemini_resets_at)}
                        />
                        <QuotaBar
                          label="Claude dan GPT (mingguan)"
                          value={acc.claude_pct}
                          resetText={formatResetTime(acc.claude_resets_at)}
                        />
                      </div>
                    </div>

                    {!acc.is_active && acc.status !== 'limit' && (
                      <div className="mt-5 pt-3.5 border-t border-border flex justify-end">
                        <FlashButton
                          variant="secondary"
                          successText={isIdeTarget ? 'Ditandai Aktif' : 'Proxy Dialihkan'}
                          onClick={() => switchMutation.mutate(acc.id)}
                          className="w-full justify-center text-xs py-2"
                        >
                          <Icon name="loop" size={14} />
                          <span>{isIdeTarget ? 'Tandai aktif di Radar' : 'Pakai akun ini'}</span>
                        </FlashButton>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {filteredAccounts.length === 0 && (
              <div className="card rise p-8 text-center flex flex-col items-center gap-3">
                <Blip mood="senang" size={80} />
                <div className="t">Tidak ada akun di kategori ini</div>
                <div className="sub">Coba pilih filter lain atau tambahkan akun baru.</div>
              </div>
            )}
          </div>

          {/* Right Column: Best Account Recommendation & Rotation Panel */}
          <div className="space-y-4">
            {/* Status Feedback Toast */}
            {switchMutation.data?.message && (
              <div className="card rise p-4 bg-[color-mix(in_srgb,#4ADE9A_10%,transparent)] border border-radar-green flex items-start gap-3">
                <Icon name="check" size={18} className="text-radar-green shrink-0 mt-0.5" />
                <div className="text-xs text-text leading-relaxed">
                  {switchMutation.data.message}
                </div>
              </div>
            )}

            {/* Recommended Account Card */}
            <div
              className="card rise p-6 bg-[#14171F]"
              style={{ '--i': 8 } as React.CSSProperties}
            >
              <div className="sub mb-2 font-medium">Rekomendasi akun terbaik</div>

              {recommended ? (
                <>
                  <div className="mono text-base font-semibold mt-1">
                    {recommended.email}
                  </div>
                  <div className="sub mt-0.5 capitalize">
                    {recommended.tier} · Gemini (mingguan) {recommended.gemini_pct !== null && recommended.gemini_pct !== undefined ? `${recommended.gemini_pct}%` : '?'} · Claude dan GPT (mingguan) {recommended.claude_pct !== null && recommended.claude_pct !== undefined ? `${recommended.claude_pct}%` : '?'}
                  </div>

                  <div className="mt-5">
                    <FlashButton
                      variant="primary"
                      successText={isIdeTarget ? 'Ditandai Aktif' : 'Berhasil dipindah'}
                      onClick={() => switchMutation.mutate(recommended.id)}
                      className="w-full justify-center py-2.5 font-semibold text-sm"
                    >
                      <Icon name="loop" size={16} />
                      <span>{isIdeTarget ? 'Tandai Rekomendasi Ini' : 'Ganti ke akun ini'}</span>
                    </FlashButton>
                  </div>

                  {/* Informative Helper Badge */}
                  <div className="mt-3.5 p-3 rounded-xl bg-[color-mix(in_srgb,#F5B544_8%,transparent)] border border-[color-mix(in_srgb,#F5B544_20%,transparent)] text-xs text-text-sub flex items-start gap-2.5 leading-relaxed">
                    <Icon name="shield" size={15} className="text-radar-yellow shrink-0 mt-0.5" />
                    <span>
                      {isIdeTarget ? (
                        <>
                          <strong>Mode IDE:</strong> Pergantian akun Google utama dilakukan secara manual di jendela aplikasi IDE Antigravity Anda. Radar mencatat akun aktif untuk menghitung sisa kuota dan rotasi.
                        </>
                      ) : (
                        <>
                          <strong>Mode Proxy:</strong> Menjalankan perintah <code>ccs agy --use</code> untuk tool CLI yang terhubung ke proxy.
                        </>
                      )}
                    </span>
                  </div>
                </>
              ) : bestEval.allExhausted ? (
                <div className="py-2">
                  <div className="flex items-center gap-3">
                    <Blip mood="tidur" size={56} />
                    <div>
                      <div className="text-radar-red text-sm font-medium">Semua akun habis</div>
                      <div className="sub text-xs mt-0.5">
                        Reset tercepat:{' '}
                        {bestEval.fastestResetAccount?.nickname || 'Akun'} (
                        {formatRelativeTime(bestEval.fastestResetTime)})
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="sub py-2">Semua akun saat ini sudah terpakai optimal.</div>
              )}

              {/* Automatic Rotation Switch */}
              <div className="opt mt-5 pt-4">
                <div>
                  <div className="t text-sm">Rotasi otomatis</div>
                  <div className="sub text-xs">
                    Pindah akun otomatis saat kuota di bawah ambang
                  </div>
                </div>
                <Switch
                  checked={settings?.mode === 'auto'}
                  onChange={(val) => modeMutation.mutate(val ? 'auto' : 'manual')}
                  ariaLabel="Saklar rotasi otomatis"
                />
              </div>
            </div>

            {/* Notification / Activity Feed */}
            <div
              className="card rise p-5 md:p-6"
              style={{ '--i': 9 } as React.CSSProperties}
            >
              <div className="flex justify-between items-center mb-4">
                <div className="t text-sm">Aktivitas Terakhir</div>
                <Link href="/notifikasi" className="sub hover:text-foreground text-xs flex items-center gap-1">
                  <span>Discord</span>
                  <Icon name="chat" size={14} />
                </Link>
              </div>

              <div className="space-y-3.5">
                {events.slice(0, 3).map((ev) => (
                  <div key={ev.id} className="feed flex gap-3 text-xs leading-relaxed text-muted">
                    <i
                      className="dot mt-1.5"
                      style={
                        {
                          '--c': ev.reason === 'limit' ? '#FF7A7A' : '#4ADE9A',
                        } as React.CSSProperties
                      }
                    />
                    <div>
                      <b className="text-foreground font-medium block">
                        {ev.from_nickname || 'Akun'} ke {ev.to_nickname || 'Akun baru'}
                      </b>
                      <span>
                        {ev.reason === 'limit'
                          ? 'Kuotanya habis'
                          : ev.reason === 'below_threshold'
                          ? 'Di bawah ambang batas'
                          : 'Pergantian manual'}
                      </span>
                    </div>
                  </div>
                ))}

                {events.length === 0 && (
                  <div className="sub text-xs py-2 text-center">Belum ada riwayat rotasi.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

