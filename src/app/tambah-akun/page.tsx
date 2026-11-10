'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Navbar from '@/components/Navbar';
import Icon from '@/components/Icon';
import Blip from '@/components/Blip';
import Switch from '@/components/Switch';
import Ring from '@/components/Ring';
import StatusChip from '@/components/StatusChip';

export default function TambahAkunPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form State
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [tier, setTier] = useState<'ultra' | 'pro' | 'free'>('pro');
  const [claudePct, setClaudePct] = useState<number | null>(null);
  const [geminiPct, setGeminiPct] = useState<number | null>(null);
  const [mingguanPct, setMingguanPct] = useState<number | null>(null);
  const [trackClaude, setTrackClaude] = useState(true);
  const [trackGemini, setTrackGemini] = useState(true);
  const [inRotation, setInRotation] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Google OAuth States
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [waitingForAuth, setWaitingForAuth] = useState(false);
  const [oauthAuthUrl, setOauthAuthUrl] = useState<string | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Bersihkan polling saat unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Mulai Sesi Login Google Asli
  const handleStartGoogleLogin = async () => {
    setErrorMsg('');
    setIsConnectingGoogle(true);

    try {
      const res = await fetch('/api/auth/google/start', { method: 'POST' });
      const data = await res.json();

      if (!data.ok || !data.authUrl) {
        throw new Error(data.error || 'Gagal menyiapkan URL login Google.');
      }

      setOauthAuthUrl(data.authUrl);
      setWaitingForAuth(true);

      // Buka tab login Google di browser
      window.open(data.authUrl, '_blank', 'width=600,height=750');

      // Mulai polling status tiap 2 detik
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

      pollIntervalRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch('/api/auth/google/status');
          const statusData = await statusRes.json();

          if (statusData.ok && statusData.completed && statusData.account) {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setWaitingForAuth(false);
            setIsConnectingGoogle(false);

            // Isi state dengan data real dari Google API
            const acc = statusData.account;
            setEmail(acc.email);
            setNickname(acc.email.split('@')[0]);
            setTier(acc.tier || 'pro');
            setClaudePct(typeof acc.claude_pct === 'number' && Number.isFinite(acc.claude_pct) ? acc.claude_pct : null);
            setGeminiPct(typeof acc.gemini_pct === 'number' && Number.isFinite(acc.gemini_pct) ? acc.gemini_pct : null);
            setMingguanPct(typeof acc.mingguan_pct === 'number' && Number.isFinite(acc.mingguan_pct) ? acc.mingguan_pct : null);

            // Invalidate cache react-query
            queryClient.invalidateQueries({ queryKey: ['accounts'] });

            // Langsung lompat ke Step 3 (sukses terhubung dengan data asli!)
            setStep(3);
          } else if (statusData.error) {
            console.warn('[OAuth Poll Status]', statusData.error);
          }
        } catch (pollErr) {
          console.error('[Polling Error]', pollErr);
        }
      }, 2000);
    } catch (err: any) {
      setIsConnectingGoogle(false);
      setWaitingForAuth(false);
      setErrorMsg(err.message || 'Terjadi kesalahan saat memulai login Google.');
    }
  };

  const handleCancelGoogleLogin = async () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setWaitingForAuth(false);
    setIsConnectingGoogle(false);
    try {
      await fetch('/api/auth/google/cancel', { method: 'POST' });
    } catch {
      // Abaikan
    }
  };

  // Mutation to save account manually
  const addAccountMutation = useMutation({
    mutationFn: async () => {
      const tracked: ('claude' | 'gemini')[] = [];
      if (trackClaude) tracked.push('claude');
      if (trackGemini) tracked.push('gemini');

      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: nickname.trim(),
          email: email.trim(),
          tier,
          tracked_models: tracked,
          in_rotation: inRotation,
          claude_pct: claudePct,
          gemini_pct: geminiPct,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Gagal menyimpan akun');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });

  const handleNextStep1Manual = () => {
    setErrorMsg('');
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorMsg('Masukkan alamat email Google yang valid (misal: nama@gmail.com)');
      return;
    }
    if (!nickname.trim()) {
      setNickname(cleanEmail.split('@')[0]);
    }
    setStep(2);
  };

  const handleNextStep2 = async () => {
    try {
      await addAccountMutation.mutateAsync();
      setStep(3);
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan saat menyimpan akun');
    }
  };

  return (
    <div className="pg min-h-screen px-4 md:px-8 py-7 pb-24 md:pb-14">
      <div className="wrap">
        <Navbar />

        {/* Title Header */}
        <div className="rise mt-10" style={{ '--i': 2 } as React.CSSProperties}>
          <h1 className="h1 text-4xl sm:text-5xl">
            {step === 1 && 'Hubungkan Akun Google'}
            {step === 2 && 'Konfirmasi detail akun'}
            {step === 3 && 'Akun Terhubung & Kuota Real'}
          </h1>
          <p className="sub text-base mt-2">
            {step === 1 && 'Login dengan akun Google untuk mendeteksi limit kuota asli tanpa estimasi manual.'}
            {step === 2 && 'Pastikan data akun sudah sesuai sebelum didaftarkan ke radar.'}
            {step === 3 && 'Akun berhasil diverifikasi dan data limit kuota asli sudah tercatat dari server Google.'}
          </p>
        </div>

        {/* 3-Step Stepper */}
        <div className="stp rise max-w-[640px]" style={{ '--i': 3 } as React.CSSProperties}>
          <span className={`sn ${step >= 1 ? 'on' : ''}`}>
            {step > 1 ? <Icon name="check" size={18} /> : '1'}
          </span>
          <span className={`ln ${step >= 2 ? 'on' : ''}`} />
          <span className={`sn ${step >= 2 ? 'on' : ''}`}>
            {step > 2 ? <Icon name="check" size={18} /> : '2'}
          </span>
          <span className={`ln ${step >= 3 ? 'on' : ''}`} />
          <span className={`sn ${step >= 3 ? 'on' : ''}`}>3</span>
        </div>

        {/* Step 1: Real OAuth First, Manual Option Foldable */}
        {step === 1 && (
          <div className="two items-start">
            <div className="card rise p-6 sm:p-7 space-y-6" style={{ '--i': 4 } as React.CSSProperties}>
              <div>
                <div className="disp text-2xl font-bold tracking-tight">Login Otomatis dengan Google</div>
                <p className="sub text-sm mt-1">
                  Klik tombol di bawah untuk membuka popup Google. Pilih akun yang Anda gunakan untuk Antigravity. Radar akan otomatis mengambil sisa kuota asli.
                </p>
              </div>

              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-[color-mix(in_srgb,#FF7A7A_12%,transparent)] border border-radar-red text-radar-red text-sm flex items-center gap-2">
                  <Icon name="bolt" size={16} />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Status Menunggu Konfirmasi OAuth */}
              {waitingForAuth ? (
                <div className="p-5 rounded-2xl border border-radar-green/30 bg-radar-green/5 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-radar-green animate-ping" />
                    <span className="font-semibold text-radar-green text-sm">
                      Menunggu pilihan akun di tab Google...
                    </span>
                  </div>
                  <p className="text-xs text-text-sub leading-relaxed">
                    Jendela Google Login telah dibuka. Silakan login atau pilih akun Google Anda di jendela tersebut dan klik &quot;Allow&quot;. Radar akan otomatis mendeteksi ketika Anda selesai.
                  </p>
                  {oauthAuthUrl && (
                    <div className="text-xs text-text-sub">
                      Jika jendela tidak otomatis terbuka,{' '}
                      <a
                        href={oauthAuthUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-radar-green underline font-medium"
                      >
                        klik di sini untuk membuka link login Google secara manual
                      </a>.
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleCancelGoogleLogin}
                      className="btn text-xs py-1.5 px-3"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              ) : (
                /* Primary Google Login Button */
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={handleStartGoogleLogin}
                    disabled={isConnectingGoogle}
                    className="w-full py-4 px-5 rounded-2xl bg-white hover:bg-neutral-100 text-neutral-900 font-semibold flex items-center justify-center gap-3.5 shadow-lg hover:shadow-xl transition-all cursor-pointer disabled:opacity-50"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                    <span>
                      {isConnectingGoogle ? 'Membuka Google OAuth...' : 'Lanjut dengan Akun Google'}
                    </span>
                  </button>

                  <div className="flex items-center gap-3 text-xs text-text-sub">
                    <span className="flex-1 h-[1px] bg-border" />
                    <span>atau masukkan manual jika offline</span>
                    <span className="flex-1 h-[1px] bg-border" />
                  </div>

                  {/* Toggle Manual Form */}
                  <button
                    type="button"
                    onClick={() => setShowManualForm(!showManualForm)}
                    className="w-full py-2.5 px-4 rounded-xl border border-border hover:border-border-hover text-xs text-text-sub hover:text-text-main font-medium flex items-center justify-center gap-2 transition-colors"
                  >
                    <span>{showManualForm ? 'Sembunyikan Form Manual' : 'Input Email Manual (Lanjutan)'}</span>
                    <Icon name={showManualForm ? 'pause' : 'plus'} size={14} />
                  </button>
                </div>
              )}

              {/* Manual Form Accordion */}
              {showManualForm && !waitingForAuth && (
                <div className="mt-5 pt-5 border-t border-border space-y-4">
                  <div>
                    <label className="lbl" htmlFor="email-input">
                      Email Google <span className="text-radar-red">*</span>
                    </label>
                    <input
                      className="in font-mono text-sm"
                      id="email-input"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="misal: nama.akun@gmail.com"
                    />
                  </div>

                  <div>
                    <label className="lbl" htmlFor="nm">
                      Nama Panggilan di Dashboard (opsional)
                    </label>
                    <input
                      className="in text-sm"
                      id="nm"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder="misal: Akun Utama"
                    />
                  </div>

                  <div>
                    <label className="lbl">Paket Google Antigravity (Tier)</label>
                    <div className="grid grid-cols-3 gap-2 mt-1.5">
                      {(['pro', 'ultra', 'free'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTier(t)}
                          className={`py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
                            tier === t
                              ? 'border-radar-green bg-[color-mix(in_srgb,#4ADE9A_12%,transparent)] text-radar-green'
                              : 'border-border bg-bg-card hover:border-border-hover text-text-sub'
                          }`}
                        >
                          {t.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 flex gap-3">
                    <button className="btn pri text-sm" onClick={handleNextStep1Manual}>
                      <span>Lanjut ke Konfirmasi</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Side Explanatory Cards */}
            <div className="space-y-4">
              <div
                className="card rise p-5 sm:p-6 flex gap-4 items-center"
                style={{ '--i': 5, '--c': '#4ADE9A' } as React.CSSProperties}
              >
                <Blip mood="senang" size={64} />
                <div>
                  <div className="t text-radar-green font-medium">Autentikasi Resmi & Otomatis</div>
                  <div className="sub text-xs mt-0.5">
                    Menghubungkan akun lewat Google Login akan langsung menarik kuota Claude dan Gemini asli dari server Google tanpa perlu perkiraan manual.
                  </div>
                </div>
              </div>

              <div className="card rise p-5 sm:p-6 space-y-3" style={{ '--i': 6 } as React.CSSProperties}>
                <div className="t font-medium">Keuntungan Login Google</div>
                <div className="row2 text-xs">
                  <Icon name="check" size={16} className="text-radar-green" />
                  <span>Sisa kuota Claude Opus & Gemini Pro akurat 100%</span>
                </div>
                <div className="row2 text-xs">
                  <Icon name="radar" size={16} className="text-radar-green" />
                  <span>Waktu reset limit otomatis terdeteksi</span>
                </div>
                <div className="row2 text-xs">
                  <Icon name="loop" size={16} className="text-radar-green" />
                  <span>Dukungan pergantian akun otomatis di CCS Proxy</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Konfirmasi & Preferences */}
        {step === 2 && (
          <div className="two items-start">
            <div className="card rise p-6 sm:p-7" style={{ '--i': 4 } as React.CSSProperties}>
              <div className="flex items-center gap-3.5 pb-5 border-b border-border">
                <span className="w-13 h-13 rounded-full flex items-center justify-center font-mono font-bold text-radar-green bg-[color-mix(in_srgb,#4ADE9A_14%,transparent)] border-2 border-radar-green">
                  {(nickname || email).slice(0, 2).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="mono text-base font-medium truncate">{email}</div>
                  <div className="sub text-xs">Tier: {tier.toUpperCase()} · Panggilan: {nickname || email.split('@')[0]}</div>
                </div>
                <StatusChip status="aktif" label="Siap didaftarkan" />
              </div>

              <div className="mt-5 space-y-1">
                <div className="opt">
                  <div>
                    <div className="t text-sm">Pantau kuota Gemini (mingguan)</div>
                    <div className="sub text-xs">
                      Hitung ambang & reset Gemini ({geminiPct !== null && geminiPct !== undefined ? `${geminiPct}%` : 'Tidak diketahui'})
                    </div>
                  </div>
                  <Switch
                    checked={trackGemini}
                    onChange={setTrackGemini}
                    ariaLabel="Pantau Gemini"
                  />
                </div>

                <div className="opt">
                  <div>
                    <div className="t text-sm">Pantau kuota Claude dan GPT (mingguan)</div>
                    <div className="sub text-xs">
                      Hitung ambang & reset Claude/GPT ({claudePct !== null && claudePct !== undefined ? `${claudePct}%` : 'Tidak diketahui'})
                    </div>
                  </div>
                  <Switch
                    checked={trackClaude}
                    onChange={setTrackClaude}
                    ariaLabel="Pantau Claude"
                  />
                </div>

                <div className="opt">
                  <div>
                    <div className="t text-sm">Ikut rotasi otomatis & rekomendasi</div>
                    <div className="sub text-xs">Direkomendasikan saat kuota akun lain habis</div>
                  </div>
                  <Switch
                    checked={inRotation}
                    onChange={setInRotation}
                    ariaLabel="Ikut rotasi otomatis"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-7 flex-wrap">
                <button
                  className="btn pri"
                  onClick={handleNextStep2}
                  disabled={addAccountMutation.isPending}
                >
                  <Icon name="bolt" size={18} />
                  <span>
                    {addAccountMutation.isPending ? 'Mendaftarkan ke Supabase...' : 'Simpan & Aktifkan Akun'}
                  </span>
                </button>
                <button className="btn" onClick={() => setStep(1)}>
                  Kembali
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="card rise p-5 sm:p-6 flex gap-4 items-center" style={{ '--i': 5 } as React.CSSProperties}>
                <Blip mood="senang" size={64} />
                <div>
                  <div className="t font-medium">Data Siap Disimpan</div>
                  <div className="sub text-xs mt-0.5">Satu klik lagi untuk memasukkan akun ini ke dashboard radar Anda.</div>
                </div>
              </div>

              <div className="card rise p-5 sm:p-6 space-y-2.5" style={{ '--i': 6 } as React.CSSProperties}>
                <div className="t font-medium">Ringkasan Pendaftaran</div>
                <div className="flex justify-between text-sm">
                  <span className="sub">Email</span>
                  <span className="mono text-xs">{email}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="sub">Nama</span>
                  <span className="mono">{nickname || email.split('@')[0]}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="sub">Tier</span>
                  <span className="mono capitalize">{tier}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="sub">Dipantau</span>
                  <span className="mono">
                    {[trackClaude && 'Claude', trackGemini && 'Gemini']
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="sub">Status Rotasi</span>
                  <span className="mono text-radar-green">
                    {inRotation ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Kuota Pertama & Selesai */}
        {step === 3 && (() => {
          const finiteVals = [geminiPct, claudePct].filter(
            (v): v is number => typeof v === 'number' && Number.isFinite(v)
          );
          const lowestPct = finiteVals.length > 0 ? Math.min(...finiteVals) : null;
          let statusBadge: 'aktif' | 'hampir_limit' | 'limit' | 'tidak_diketahui' = 'aktif';
          let statusBadgeLabel = 'Terhubung Real';

          if (lowestPct === null) {
            statusBadge = 'tidak_diketahui';
            statusBadgeLabel = 'Tidak Diketahui';
          } else if (lowestPct <= 15) {
            statusBadge = 'limit';
            if (geminiPct !== null && geminiPct <= 15) statusBadgeLabel = 'Gemini Limit';
            else if (claudePct !== null && claudePct <= 15) statusBadgeLabel = 'Claude Limit';
            else statusBadgeLabel = 'Limit Tercapai';
          } else if (lowestPct <= 25) {
            statusBadge = 'hampir_limit';
            statusBadgeLabel = 'Hampir Limit';
          }

          return (
            <div className="two items-start">
              <div className="card rise p-6 sm:p-7" style={{ '--i': 4 } as React.CSSProperties}>
                <div className="flex justify-between items-center">
                  <div className="t font-mono text-base">{email}</div>
                  <StatusChip status={statusBadge} label={statusBadgeLabel} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 text-center">
                  <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-surface/50">
                    <Ring value={geminiPct} size={90} strokeWidth={7} />
                    <div className="t font-medium mt-1 text-sm">Gemini (mingguan)</div>
                    <div className="sub text-xs">
                      {geminiPct !== null ? `${geminiPct}% sisa real` : 'Tidak diketahui'}
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-surface/50">
                    <Ring value={claudePct} size={90} strokeWidth={7} />
                    <div className="t font-medium mt-1 text-sm">Claude dan GPT (mingguan)</div>
                    <div className="sub text-xs">
                      {claudePct !== null ? `${claudePct}% sisa real` : 'Tidak diketahui'}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 mt-7 flex-wrap">
                  <Link href="/" className="btn pri">
                    <Icon name="radar" size={18} />
                    <span>Buka Dashboard</span>
                  </Link>
                  <button
                    className="btn"
                    onClick={() => {
                      setEmail('');
                      setNickname('');
                      setClaudePct(null);
                      setGeminiPct(null);
                      setMingguanPct(null);
                      setStep(1);
                    }}
                  >
                    <Icon name="plus" size={18} />
                    <span>Tambah akun Google lain</span>
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div
                  className="card rise p-6 text-center flex flex-col items-center gap-2.5"
                  style={{ '--i': 5 } as React.CSSProperties}
                >
                  <Blip mood={statusBadge === 'limit' ? 'tidur' : 'senang'} size={96} />
                  <div className={`disp text-2xl font-bold tracking-tight ${statusBadge === 'limit' ? 'text-radar-red' : 'text-radar-green'}`}>
                    {statusBadge === 'limit' ? 'Akun Terhubung (Limit Terdeteksi)' : 'Akun Berhasil Terhubung!'}
                  </div>
                  <div className="sub text-xs leading-relaxed">
                    Data limit kuota {email} berhasil diverifikasi langsung dari server Google Cloud Code API. Radar akan memperbarui snapshot secara otomatis tiap 60 detik.
                  </div>
                </div>

                <div className="card rise p-5 sm:p-6 space-y-3" style={{ '--i': 6 } as React.CSSProperties}>
                  <div className="t font-medium">Fitur Aktif</div>
                  <div className="row2 text-xs">
                    <Icon name="check" size={16} className="text-radar-green" />
                    <span>Data tersimpan permanen di database Supabase Anda</span>
                  </div>
                  <div className="row2 text-xs">
                    <Icon name="radar" size={16} className="text-radar-green" />
                    <span>Monitoring live 3 dimensi: Claude, Gemini, & Mingguan</span>
                  </div>
                  <div className="row2 text-xs">
                    <Icon name="loop" size={16} className="text-radar-green" />
                    <span>Dukungan rotasi otomatis saat kuota menipis</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
