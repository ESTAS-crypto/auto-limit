'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Navbar from '@/components/Navbar';
import Icon from '@/components/Icon';
import Blip from '@/components/Blip';
import Ring from '@/components/Ring';
import QuotaBar from '@/components/QuotaBar';
import StatusChip from '@/components/StatusChip';
import FlashButton from '@/components/FlashButton';
import { AccountWithStatus } from '@/lib/types';
import { formatResetTime } from '@/lib/status';

export default function AkunPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'aktif' | 'hampir_limit' | 'limit'>('all');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  // Edit Quota Modal State
  const [editingAccount, setEditingAccount] = useState<AccountWithStatus | null>(null);
  const [editManualGeminiPct, setEditManualGeminiPct] = useState<string>('');
  const [editManualGeminiResetsAt, setEditManualGeminiResetsAt] = useState<string>('');

  const { data, isLoading } = useQuery<{ ok: boolean; data: AccountWithStatus[] }>({
    queryKey: ['accounts'],
    queryFn: async () => {
      const res = await fetch('/api/accounts');
      return res.json();
    },
  });

  const pauseMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/accounts/${id}`, { method: 'PATCH' });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });

  const updateManualGeminiMutation = useMutation({
    mutationFn: async ({
      id,
      gemini_manual_pct,
      gemini_manual_resets_at,
      gemini_manual_clear,
    }: {
      id: string;
      gemini_manual_pct?: number | null;
      gemini_manual_resets_at?: string | null;
      gemini_manual_clear?: boolean;
    }) => {
      const res = await fetch(`/api/accounts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gemini_manual_pct,
          gemini_manual_resets_at,
          gemini_manual_clear,
        }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setEditingAccount(null);
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!confirm('Yakin ingin menghapus akun ini dari Radar?')) return;
      const res = await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });

  const switchMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch('/api/rotation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'switch', account_id: id }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['rotation'] });
    },
  });

  const accounts = data?.data || [];
  const readyCount = accounts.filter((a) => a.status === 'aktif').length;

  const filteredAccounts = accounts.filter((a) => {
    if (filter === 'all') return true;
    return a.status === filter;
  });

  const selectedAccount =
    accounts.find((a) => a.id === selectedAccountId) ||
    accounts.find((a) => a.status === 'hampir_limit') ||
    accounts[0];

  const openEditModal = (acc: AccountWithStatus) => {
    setEditingAccount(acc);
    setEditManualGeminiPct(
      acc.gemini_manual_pct !== null && acc.gemini_manual_pct !== undefined
        ? String(acc.gemini_manual_pct)
        : ''
    );
    if (acc.gemini_manual_resets_at) {
      try {
        const d = new Date(acc.gemini_manual_resets_at);
        const localIso = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
        setEditManualGeminiResetsAt(localIso);
      } catch {
        setEditManualGeminiResetsAt('');
      }
    } else {
      setEditManualGeminiResetsAt('');
    }
  };

  return (
    <div className="pg min-h-screen px-4 md:px-8 py-7 pb-28 md:pb-14">
      <div className="wrap">
        <Navbar />

        {/* Desktop Header */}
        <div
          className="rise hidden md:flex justify-between items-end gap-4 flex-wrap mt-10"
          style={{ '--i': 2 } as React.CSSProperties}
        >
          <div>
            <h1 className="h1 text-4xl sm:text-5xl">Kelola akun</h1>
            <p className="sub text-base mt-2">
              Jeda, sesuaikan sisa kuota, atau hapus akun Google yang terdaftar di Radar.
            </p>
          </div>
          <Link href="/tambah-akun" className="btn pri">
            <Icon name="plus" size={18} />
            <span>Tambah akun</span>
          </Link>
        </div>

        {/* Mobile Header */}
        <div className="rise md:hidden mt-6" style={{ '--i': 1 } as React.CSSProperties}>
          <h1 className="h1 text-3xl">Akun</h1>
          <div className="sub mt-1 text-sm">
            {accounts.length} akun · {readyCount} siap dipakai
          </div>
          <div className="rise flex gap-2 my-4 overflow-x-auto scr" style={{ '--i': 2 } as React.CSSProperties}>
            <button
              className="pill"
              aria-pressed={filter === 'all'}
              onClick={() => setFilter('all')}
            >
              Semua · {accounts.length}
            </button>
            <button
              className="pill"
              aria-pressed={filter === 'aktif'}
              onClick={() => setFilter('aktif')}
            >
              Aktif · {readyCount}
            </button>
            <button
              className="pill"
              aria-pressed={filter === 'hampir_limit'}
              onClick={() => setFilter('hampir_limit')}
            >
              Hampir · {accounts.filter((a) => a.status === 'hampir_limit').length}
            </button>
            <button
              className="pill"
              aria-pressed={filter === 'limit'}
              onClick={() => setFilter('limit')}
            >
              Limit · {accounts.filter((a) => a.status === 'limit').length}
            </button>
          </div>
        </div>

        {/* Mobile Layout: Featured Selected Account Card */}
        {selectedAccount && (
          <div className="md:hidden card rise mc p-4 mb-5" style={{ '--i': 3 } as React.CSSProperties}>
            <div className="flex justify-between items-center gap-2">
              <div>
                <div className="sub text-xs">Dipilih</div>
                <div className="mono text-sm font-medium mt-0.5">{selectedAccount.email}</div>
              </div>
              <StatusChip status={selectedAccount.status} />
            </div>

            <div className="flex gap-4 items-center mt-3.5">
              <Ring value={selectedAccount.lowest_tracked_pct} size={72} />
              <div className="flex-1 space-y-2">
                <QuotaBar
                  label="Gemini (mingguan)"
                  value={selectedAccount.gemini_pct}
                  resetText={formatResetTime(selectedAccount.gemini_resets_at)}
                />
                <QuotaBar
                  label="Claude dan GPT (mingguan)"
                  value={selectedAccount.claude_pct}
                  resetText={formatResetTime(selectedAccount.claude_resets_at)}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-4 flex-wrap">
              <FlashButton
                variant="primary"
                successText="Ditandai"
                onClick={() => switchMutation.mutate(selectedAccount.id)}
                className="flex-1 justify-center min-h-[44px]"
              >
                <Icon name="loop" size={16} />
                <span>Tandai Aktif</span>
              </FlashButton>
              <button
                className="btn min-h-[44px] px-3.5"
                onClick={() => openEditModal(selectedAccount)}
              >
                <Icon name="radar" size={16} />
                <span>Sesuaikan</span>
              </button>
              <button
                className="btn min-h-[44px] px-3.5"
                onClick={() => pauseMutation.mutate(selectedAccount.id)}
              >
                <Icon name="pause" size={16} />
                <span>{selectedAccount.paused ? 'Lanjutkan' : 'Jeda'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Desktop Table */}
        <div
          className="card rise hidden md:block mt-7 overflow-x-auto"
          style={{ '--i': 3 } as React.CSSProperties}
        >
          <div className="min-w-[800px]">
            <div className="tr th font-medium">
              <span>Akun</span>
              <span>Tier</span>
              <span>Gemini (mingguan)</span>
              <span>Claude dan GPT (mingguan)</span>
              <span>Status</span>
              <span>Aksi</span>
            </div>

            {filteredAccounts.map((acc, idx) => (
              <div
                key={acc.id}
                className="tr rise items-center"
                style={{ '--i': 4 + idx } as React.CSSProperties}
              >
                <div className="min-w-0">
                  <div className="mono text-sm font-medium truncate">{acc.email}</div>
                  <div className="sub text-xs">{acc.nickname}</div>
                </div>
                <span className="sub capitalize">{acc.tier}</span>
                <span className="mono text-sm">
                  {acc.gemini_pct !== null && acc.gemini_pct !== undefined ? (
                    <span className="flex items-center gap-1.5">
                      <span>{acc.gemini_pct}%</span>
                      {acc.gemini_source === 'manual' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          manual
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-text-sub text-xs italic">tidak tersedia dari server</span>
                  )}
                </span>
                <span className="mono text-sm">
                  {acc.claude_pct !== null && acc.claude_pct !== undefined
                    ? `${acc.claude_pct}%`
                    : <span className="text-text-sub text-xs italic">tidak tersedia</span>}
                </span>
                <div>
                  <StatusChip status={acc.status} />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="btn text-xs py-1.5 px-3"
                    title="Sesuaikan sisa kuota Gemini mingguan dari IDE"
                    onClick={() => openEditModal(acc)}
                  >
                    <span>Sesuaikan</span>
                  </button>
                  <button
                    className="ib"
                    title={acc.paused ? 'Lanjutkan akun' : 'Jeda akun'}
                    aria-label={`Jeda ${acc.email}`}
                    onClick={() => pauseMutation.mutate(acc.id)}
                  >
                    <Icon name="pause" size={18} />
                  </button>
                  <button
                    className="ib text-radar-red hover:bg-[color-mix(in_srgb,#FF7A7A_12%,transparent)]"
                    title="Hapus akun dari Radar"
                    onClick={() => deleteAccountMutation.mutate(acc.id)}
                  >
                    <Icon name="bolt" size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Edit Quota Modal */}
        {editingAccount && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="card rise p-6 sm:p-7 max-w-lg w-full border border-border shadow-2xl">
              <div className="flex justify-between items-center pb-3 border-b border-border">
                <div className="disp text-xl font-bold">Sesuaikan Kuota Akun</div>
                <button
                  className="sub hover:text-foreground text-sm"
                  onClick={() => setEditingAccount(null)}
                >
                  ✕
                </button>
              </div>

              <div className="mt-3">
                <div className="mono text-sm text-text font-medium">{editingAccount.email}</div>
                <div className="sub text-xs mt-0.5">
                  Tier: <span className="capitalize">{editingAccount.tier}</span> · Status saat ini: <StatusChip status={editingAccount.status} />
                </div>
              </div>

              {/* Claude and GPT status from Server */}
              <div className="mt-5 p-3.5 rounded-xl border border-border bg-surface/40 space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-medium text-text">Claude dan GPT (mingguan)</span>
                  <span className="mono font-bold text-radar-green">
                    {editingAccount.claude_pct !== null && editingAccount.claude_pct !== undefined
                      ? `${editingAccount.claude_pct}% sisa real`
                      : 'Tidak tersedia'}
                  </span>
                </div>
                <div className="text-[11px] text-text-sub flex justify-between">
                  <span>Sumber: Google Cloud Code API</span>
                  <span>Reset: {formatResetTime(editingAccount.claude_resets_at)}</span>
                </div>
              </div>

              {/* Manual Input for Gemini Weekly */}
              <div className="mt-5 space-y-4">
                <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-text">Gemini mingguan (dari IDE)</span>
                      {editingAccount.gemini_source === 'manual' && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          {editingAccount.gemini_is_expired ? 'Kedaluwarsa' : 'Sedang Aktif (Manual)'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-sub mt-1 leading-relaxed">
                      Google API tidak menyediakan limit mingguan Gemini. Masukkan persentase dan tanggal reset dari menu <strong>Models &amp; Usage</strong> di Antigravity IDE jika ingin dipantau. Nilai otomatis kedaluwarsa setelah waktu reset.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="lbl text-xs" htmlFor="gemini-pct-input">
                        Sisa Persen (0 - 100)
                      </label>
                      <input
                        id="gemini-pct-input"
                        type="number"
                        min="0"
                        max="100"
                        placeholder="Contoh: 0 atau 61"
                        value={editManualGeminiPct}
                        onChange={(e) => setEditManualGeminiPct(e.target.value)}
                        className="in font-mono text-sm py-2 px-3"
                      />
                    </div>

                    <div>
                      <label className="lbl text-xs" htmlFor="gemini-reset-input">
                        Tanggal &amp; Jam Reset (opsional)
                      </label>
                      <input
                        id="gemini-reset-input"
                        type="datetime-local"
                        value={editManualGeminiResetsAt}
                        onChange={(e) => setEditManualGeminiResetsAt(e.target.value)}
                        className="in font-mono text-xs py-2 px-3"
                      />
                    </div>
                  </div>

                  {editingAccount.gemini_manual_updated_at && (
                    <div className="text-[11px] text-text-sub pt-1">
                      Terakhir diisi manual: {new Date(editingAccount.gemini_manual_updated_at).toLocaleString('id-ID')}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 mt-6 flex-wrap">
                <button
                  className="btn pri flex-1 justify-center text-xs py-2.5"
                  disabled={updateManualGeminiMutation.isPending}
                  onClick={() => {
                    const rawVal = editManualGeminiPct.trim();
                    const numVal = rawVal === '' ? null : Number(rawVal);
                    if (numVal !== null && (isNaN(numVal) || numVal < 0 || numVal > 100)) {
                      alert('Masukkan angka persentase valid antara 0 dan 100');
                      return;
                    }
                    const resetIso = editManualGeminiResetsAt
                      ? new Date(editManualGeminiResetsAt).toISOString()
                      : null;
                    updateManualGeminiMutation.mutate({
                      id: editingAccount.id,
                      gemini_manual_pct: numVal,
                      gemini_manual_resets_at: resetIso,
                    });
                  }}
                >
                  <Icon name="check" size={16} />
                  <span>{updateManualGeminiMutation.isPending ? 'Menyimpan...' : 'Simpan Nilai Manual'}</span>
                </button>

                {editingAccount.gemini_manual_pct !== null && (
                  <button
                    className="btn text-xs py-2.5 px-3 text-radar-red"
                    disabled={updateManualGeminiMutation.isPending}
                    onClick={() => {
                      updateManualGeminiMutation.mutate({
                        id: editingAccount.id,
                        gemini_manual_clear: true,
                      });
                    }}
                  >
                    <span>Hapus Manual</span>
                  </button>
                )}

                <button className="btn text-xs py-2.5 px-3" onClick={() => setEditingAccount(null)}>
                  Batal
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mobile: Other accounts list */}
        <div className="md:hidden space-y-2 mt-4">
          <div className="sub text-xs">Akun lain</div>
          {accounts
            .filter((a) => a.id !== selectedAccount?.id)
            .map((acc, idx) => {
              const claudeText = acc.claude_pct !== null && acc.claude_pct !== undefined ? `${acc.claude_pct}%` : '-';
              const geminiText = acc.gemini_pct !== null && acc.gemini_pct !== undefined
                ? `${acc.gemini_pct}%${acc.gemini_source === 'manual' ? ' (m)' : ''}`
                : 'n/a';

              return (
                <div
                  key={acc.id}
                  className="card rise p-2.5 px-3.5 flex items-center gap-3 cursor-pointer"
                  style={{ '--i': 5 + idx } as React.CSSProperties}
                  onClick={() => setSelectedAccountId(acc.id)}
                >
                  <Ring value={acc.lowest_tracked_pct} size={44} />
                  <div className="flex-1 min-w-0">
                    <div className="mono text-xs truncate font-medium">{acc.email}</div>
                    <div className="sub text-[11px] capitalize">
                      {acc.tier} · Claude {claudeText} · Gemini {geminiText}
                    </div>
                  </div>
                  <StatusChip status={acc.status} />
                </div>
              );
            })}
        </div>

        {/* Floating Add Account Button for Mobile */}
        <Link
          href="/tambah-akun"
          className="btn pri md:hidden fixed right-4 bottom-24 min-h-[52px] px-5 rounded-full shadow-lg z-40 flex items-center gap-2"
        >
          <Icon name="plus" size={18} />
          <span>Tambah akun</span>
        </Link>

        {/* Blip Tips Card */}
        <div
          className="card rise mt-6 p-5 sm:p-6 flex items-center gap-5"
          style={{ '--i': 11 } as React.CSSProperties}
        >
          <Blip mood="senang" size={64} />
          <div>
            <div className="t font-medium">Sinkronisasi Fleksibel</div>
            <div className="sub text-sm mt-0.5">
              Anda bisa mengatur sisa kuota kapan saja dengan tombol <strong>Sesuaikan</strong>, atau hubungkan akun melalui <strong>Login Akun Google CCS.bat</strong> untuk sinkronisasi otomatis.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
