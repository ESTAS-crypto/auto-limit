'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Navbar from '@/components/Navbar';
import Icon from '@/components/Icon';
import Blip from '@/components/Blip';
import Segmented from '@/components/Segmented';
import Switch from '@/components/Switch';
import FlashButton from '@/components/FlashButton';
import StatusChip from '@/components/StatusChip';
import { AccountWithStatus, RotationSettings, RotationEvent, RotationMode } from '@/lib/types';
import { selectBestAccount } from '@/lib/rotation-eval';
import { formatRelativeTime } from '@/lib/status';

export default function RotasiPage() {
  const queryClient = useQueryClient();

  const { data: accountsData } = useQuery<{ ok: boolean; data: AccountWithStatus[] }>({
    queryKey: ['accounts'],
    queryFn: async () => {
      const res = await fetch('/api/accounts');
      return res.json();
    },
  });

  const { data: rotationData } = useQuery<{
    ok: boolean;
    data: { settings: RotationSettings; events: RotationEvent[] };
  }>({
    queryKey: ['rotation'],
    queryFn: async () => {
      const res = await fetch('/api/rotation');
      return res.json();
    },
  });

  const settings = rotationData?.data?.settings;
  const events = rotationData?.data?.events || [];
  const accounts = accountsData?.data || [];

  const [mode, setMode] = useState<RotationMode>('hybrid');
  const [threshold, setThreshold] = useState<number>(5);

  React.useEffect(() => {
    if (settings) {
      setMode(settings.mode);
      setThreshold(settings.threshold_pct);
    }
  }, [settings]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (patch: Partial<RotationSettings>) => {
      const res = await fetch('/api/rotation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rotation'] });
    },
  });

  const switchAccountMutation = useMutation({
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

  const handleModeChange = (newMode: RotationMode) => {
    setMode(newMode);
    updateSettingsMutation.mutate({ mode: newMode });
  };

  const handleThresholdChange = (newThreshold: number) => {
    setThreshold(newThreshold);
    updateSettingsMutation.mutate({ threshold_pct: newThreshold });
  };

  const activeAccount = accounts.find((a) => a.id === settings?.active_account_id) || accounts[0];

  const bestEval = settings
    ? selectBestAccount(accounts, {
        threshold_pct: threshold,
        tier_priority: settings.tier_priority,
      })
    : { bestAccount: null, allExhausted: false, fastestResetAccount: null, fastestResetTime: null };

  return (
    <div className="pg min-h-screen px-4 md:px-8 py-7 pb-24 md:pb-14">
      <div className="wrap">
        <Navbar />

        {/* Title */}
        <div className="rise mt-10" style={{ '--i': 2 } as React.CSSProperties}>
          <h1 className="h1 text-4xl sm:text-5xl">Rotasi akun</h1>
          <p className="sub text-base mt-2">
            Atur kapan dan ke akun mana Quota Radar berpindah.
          </p>
        </div>

        {/* Two-Column Grid */}
        <div className="two items-start">
          {/* Left Column: Mode & Controls */}
          <div className="space-y-4">
            {/* Mode Selector Card */}
            <div className="card rise p-6 sm:p-7" style={{ '--i': 3 } as React.CSSProperties}>
              <div className="t font-medium mb-3.5">Mode</div>
              <Segmented<RotationMode>
                options={[
                  { value: 'auto', label: 'Otomatis' },
                  { value: 'manual', label: 'Manual' },
                  { value: 'hybrid', label: 'Hybrid' },
                ]}
                value={mode}
                onChange={handleModeChange}
              />
              <p className="sub text-xs sm:text-sm mt-3.5">
                {mode === 'hybrid' &&
                  'Hybrid: Quota Radar berpindah secara otomatis, namun kamu tetap bisa memilih akun manual sewaktu-waktu.'}
                {mode === 'auto' &&
                  'Otomatis: Quota Radar memilih dan memindah akun sendiri. Kamu tidak perlu melakukan apa-apa.'}
                {mode === 'manual' &&
                  'Manual: Tidak ada perpindahan otomatis. Kamu memilih sendiri akun yang ingin dipakai.'}
              </p>
            </div>

            {/* Target Rotasi Card (Skenario A vs Skenario B) */}
            <div className="card rise p-6 sm:p-7" style={{ '--i': 3.5 } as React.CSSProperties}>
              <div className="t font-medium mb-3.5">Target Rotasi</div>
              <Segmented<'ide' | 'proxy'>
                options={[
                  { value: 'ide', label: 'IDE Antigravity (Skenario B)' },
                  { value: 'proxy', label: 'Proxy CCS CLI (Skenario A)' },
                ]}
                value={settings?.rotation_target || 'ide'}
                onChange={(target) => updateSettingsMutation.mutate({ rotation_target: target })}
              />
              <p className="sub text-xs sm:text-sm mt-3.5">
                {settings?.rotation_target === 'ide'
                  ? 'Skenario B (IDE Antigravity): Radar mencatat akun aktif, menghitung kuota, dan merekomendasikan akun terbaik. Pergantian akun di IDE dilakukan manual di jendela Antigravity.'
                  : 'Skenario A (Proxy CCS): Radar memicu perintah `ccs agy --use` untuk tool coding eksternal yang terhubung ke proxy lokal.'}
              </p>
            </div>

            {/* Threshold Slider Card (Used in Hybrid & Auto) */}
            <div className="card rise p-6 sm:p-7" style={{ '--i': 4 } as React.CSSProperties}>
              <div className="flex justify-between items-baseline">
                <label className="t font-medium" htmlFor="th">
                  Lewati akun di bawah
                </label>
                <span className="mono text-2xl sm:text-3xl text-radar-yellow font-bold">
                  {threshold}%
                </span>
              </div>
              <input
                id="th"
                type="range"
                min="0"
                max="50"
                value={threshold}
                onChange={(e) => handleThresholdChange(parseInt(e.target.value, 10))}
                className="w-full my-4 accent-radar-green cursor-pointer"
              />
              <div className="sub text-xs">
                Akun yang kuotanya di bawah ambang ini tidak akan dipakai sampai kuotanya reset.
              </div>
            </div>

            {/* Content for HYBRID Mode */}
            {mode === 'hybrid' && (
              <div className="card rise px-6 sm:px-7 py-2" style={{ '--i': 5 } as React.CSSProperties}>
                <div className="t font-medium pt-4 pb-1">Urutan prioritas tier</div>
                <i className="fl block my-2" />
                <div className="opt">
                  <span className="mono text-radar-green font-bold">1</span>
                  <span className="t flex-1">Ultra</span>
                  <span className="sub text-xs">paling awal</span>
                </div>
                <div className="opt">
                  <span className="mono text-radar-green font-bold">2</span>
                  <span className="t flex-1">Pro</span>
                  <span className="sub text-xs">kuota terbanyak</span>
                </div>
                <div className="opt">
                  <span className="mono text-radar-green font-bold">3</span>
                  <span className="t flex-1">Free</span>
                  <span className="sub text-xs">paling akhir</span>
                </div>
              </div>
            )}

            {/* Content for OTOMATIS Mode: How it works */}
            {mode === 'auto' && (
              <div className="card rise p-6" style={{ '--i': 5 } as React.CSSProperties}>
                <div className="t font-medium">Cara kerja rotasi otomatis</div>
                <div className="flex items-start mt-5">
                  <div className="grid justify-items-center gap-2.5 text-center w-[120px]">
                    <span className="w-13 h-13 rounded-full flex items-center justify-center text-radar-green bg-[color-mix(in_srgb,#4ADE9A_14%,transparent)] border-2 border-radar-green">
                      <Icon name="clock" size={20} />
                    </span>
                    <span className="sub text-xs">Cek kuota berkala</span>
                  </div>
                  <i className="fl mt-6" />
                  <div className="grid justify-items-center gap-2.5 text-center w-[120px]">
                    <span className="w-13 h-13 rounded-full flex items-center justify-center text-radar-green bg-[color-mix(in_srgb,#4ADE9A_14%,transparent)] border-2 border-radar-green">
                      <Icon name="radar" size={20} />
                    </span>
                    <span className="sub text-xs">Pilih akun terbaik</span>
                  </div>
                  <i className="fl mt-6" />
                  <div className="grid justify-items-center gap-2.5 text-center w-[120px]">
                    <span className="w-13 h-13 rounded-full flex items-center justify-center text-radar-green bg-[color-mix(in_srgb,#4ADE9A_14%,transparent)] border-2 border-radar-green">
                      <Icon name="loop" size={20} />
                    </span>
                    <span className="sub text-xs">Pindah otomatis</span>
                  </div>
                </div>
              </div>
            )}

            {/* Content for MANUAL Mode: Warning card & Account Picker */}
            {mode === 'manual' && (
              <>
                {activeAccount && activeAccount.status === 'hampir_limit' && (
                  <div
                    className="card rise p-5 flex gap-4 items-center flex-wrap"
                    style={{ '--i': 5, '--c': '#F5B544' } as React.CSSProperties}
                  >
                    <Blip mood="cemas" size={56} />
                    <div className="flex-1 min-w-[200px]">
                      <div className="t text-radar-yellow font-medium">
                        {activeAccount.nickname} tinggal {activeAccount.lowest_tracked_pct}%
                      </div>
                      <div className="sub text-xs">
                        Kuotanya hampir habis dan kamu belum mengganti akun.
                      </div>
                    </div>
                    {bestEval.bestAccount && (
                      <FlashButton
                        variant="primary"
                        successText="Berpindah"
                        onClick={() => switchAccountMutation.mutate(bestEval.bestAccount!.id)}
                      >
                        <Icon name="loop" size={16} />
                        <span>Ganti ke {bestEval.bestAccount.nickname}</span>
                      </FlashButton>
                    )}
                  </div>
                )}

                <div className="t rise mt-2" style={{ '--i': 6 } as React.CSSProperties}>
                  Pilih akun aktif
                </div>

                <div className="space-y-2">
                  {accounts.map((acc, idx) => {
                    const isLimit = acc.status === 'limit';
                    const isCurrent = acc.id === settings?.active_account_id;

                    return (
                      <div
                        key={acc.id}
                        className={`card rise p-3.5 px-4.5 flex items-center gap-3.5 ${
                          isLimit ? 'opacity-40' : ''
                        } ${isCurrent ? 'border-radar-green' : ''}`}
                        style={{ '--i': 7 + idx } as React.CSSProperties}
                      >
                        <span className="mono text-xs w-8 h-8 rounded-full flex items-center justify-center bg-[color-mix(in_srgb,#4ADE9A_14%,transparent)] text-radar-green border border-radar-green">
                          {acc.nickname.slice(-2)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="mono text-sm truncate font-medium">{acc.email}</div>
                          <div className="sub text-xs capitalize">
                            {acc.tier} · Claude {acc.claude_pct ?? 0}%
                          </div>
                        </div>

                        {isCurrent ? (
                          <StatusChip status="aktif" label="Aktif" />
                        ) : isLimit ? (
                          <span className="sub text-xs">Tidak bisa dipilih</span>
                        ) : (
                          <FlashButton
                            variant="secondary"
                            successText="Dipakai"
                            onClick={() => switchAccountMutation.mutate(acc.id)}
                            className="text-xs py-1.5 px-3"
                          >
                            <span>Pakai</span>
                          </FlashButton>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Right Column: Status / History Card */}
          <div className="space-y-4">
            {/* Active Account or All Exhausted Card */}
            {mode === 'hybrid' && (
              <div
                className="card rise p-6 flex flex-col items-start gap-4"
                style={{ '--i': 6, '--c': '#FF7A7A' } as React.CSSProperties}
              >
                <Blip mood="tidur" size={96} />
                <div>
                  <div className="t font-medium">Kalau semua akun habis</div>
                  <div className="sub text-xs mt-1">
                    Quota Radar berhenti merekomendasikan dan memberi tahu kamu di Discord.
                  </div>
                </div>
                <span className="chip" style={{ '--c': '#F5B544' } as React.CSSProperties}>
                  <Icon name="clock" size={16} />
                  <span>
                    Reset tercepat:{' '}
                    {bestEval.fastestResetAccount?.nickname || 'akun-04'},{' '}
                    {formatRelativeTime(bestEval.fastestResetTime || '2h 14m')}
                  </span>
                </span>
              </div>
            )}

            {mode === 'auto' && (
              <>
                <div
                  className="card rise p-6 flex gap-4 items-center"
                  style={{ '--i': 6 } as React.CSSProperties}
                >
                  <Blip mood="senang" size={64} />
                  <div>
                    <div className="sub text-xs">Akun aktif sekarang</div>
                    <div className="mono text-base font-semibold my-0.5">
                      {activeAccount?.email || '-'}
                    </div>
                    <StatusChip status={activeAccount?.status || 'aktif'} />
                  </div>
                </div>

                <div className="card rise px-6 py-2" style={{ '--i': 7 } as React.CSSProperties}>
                  <div className="t font-medium pt-4 pb-1">Riwayat perpindahan</div>
                  {events.slice(0, 4).map((ev) => (
                    <div key={ev.id} className="opt">
                      <div>
                        <div className="t text-sm">
                          {ev.from_nickname || 'Akun'} ke {ev.to_nickname || 'Akun baru'}
                        </div>
                        <div className="sub text-xs">
                          {ev.reason === 'limit'
                            ? 'Claude habis'
                            : ev.reason === 'below_threshold'
                            ? `Di bawah ${threshold}%`
                            : 'Manual'}
                        </div>
                      </div>
                      <span className="mono sub text-xs">{formatRelativeTime(ev.at)}</span>
                    </div>
                  ))}
                  {events.length === 0 && (
                    <div className="sub text-xs py-4 text-center">Belum ada riwayat.</div>
                  )}
                </div>
              </>
            )}

            {mode === 'manual' && (
              <div className="card rise p-6" style={{ '--i': 8 } as React.CSSProperties}>
                <div className="opt border-t-0 pt-0">
                  <div>
                    <div className="t text-sm">Ingatkan di Discord</div>
                    <div className="sub text-xs">Saat akun aktif turun di bawah 20%</div>
                  </div>
                  <Switch
                    checked={true}
                    onChange={() => {}}
                    ariaLabel="Pengingat Discord"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

