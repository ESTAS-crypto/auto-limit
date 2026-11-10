import { describe, it, expect } from 'vitest';
import { calculateAccountStatus } from '../src/lib/status';
import { selectBestAccount } from '../src/lib/rotation';
import { parseAntigravityCliOutput } from '../src/lib/providers/antigravity-cli';
import { parseQuotaResponses } from '../src/lib/ccs-quota';
import { encrypt, decrypt } from '../src/lib/crypto';
import { AccountWithStatus } from '../src/lib/types';

describe('Unit Tests: Status Akun (calculateAccountStatus)', () => {
  it('harus mengembalikan status "dijeda" jika paused = true', () => {
    const result = calculateAccountStatus({
      paused: true,
      tracked_models: ['claude', 'gemini'],
      claude_pct: 100,
      gemini_pct: 100,
    });
    expect(result.status).toBe('dijeda');
    expect(result.statusLabel).toBe('Dijeda');
  });

  it('harus mengembalikan "tidak_diketahui" jika ada flag error atau kuota kosong', () => {
    const resError = calculateAccountStatus({
      paused: false,
      tracked_models: ['claude'],
      has_error: true,
    });
    expect(resError.status).toBe('tidak_diketahui');

    const resEmpty = calculateAccountStatus({
      paused: false,
      tracked_models: ['claude'],
      claude_pct: null,
    });
    expect(resEmpty.status).toBe('tidak_diketahui');
  });

  it('harus mengembalikan "limit" jika salah satu model bernilai 0%', () => {
    const result = calculateAccountStatus({
      paused: false,
      tracked_models: ['claude', 'gemini'],
      claude_pct: 0,
      gemini_pct: 85,
    });
    expect(result.status).toBe('limit');
    expect(result.lowest_pct).toBe(0);
    expect(result.colorHex).toBe('#FF7A7A');
  });

  it('harus mengembalikan "hampir_limit" jika kuota terendah > 0% dan <= 20%', () => {
    const result = calculateAccountStatus({
      paused: false,
      tracked_models: ['claude', 'gemini'],
      claude_pct: 15,
      gemini_pct: 60,
    });
    expect(result.status).toBe('hampir_limit');
    expect(result.lowest_pct).toBe(15);
    expect(result.colorHex).toBe('#F5B544');
  });

  it('harus mengembalikan "aktif" jika kuota terendah di atas 20%', () => {
    const result = calculateAccountStatus({
      paused: false,
      tracked_models: ['claude', 'gemini'],
      claude_pct: 80,
      gemini_pct: 95,
    });
    expect(result.status).toBe('aktif');
    expect(result.lowest_pct).toBe(80);
    expect(result.colorHex).toBe('#4ADE9A');
  });

  it('harus menghormati tracked_models (mengabaikan model yang tidak dipantau)', () => {
    // Gemini 0% tapi hanya Claude yang dipantau (100%)
    const result = calculateAccountStatus({
      paused: false,
      tracked_models: ['claude'],
      claude_pct: 100,
      gemini_pct: 0,
    });
    expect(result.status).toBe('aktif');
    expect(result.lowest_pct).toBe(100);
  });
});

describe('Unit Tests: Algoritma Pemilihan Akun Terbaik (selectBestAccount)', () => {
  const mockAccounts: AccountWithStatus[] = [
    {
      id: 'acc-1',
      nickname: 'akun-free',
      email: 'free@gmail.com',
      tier: 'free',
      paused: false,
      tracked_models: ['claude', 'gemini'],
      in_rotation: true,
      lowest_tracked_pct: 90,
      status: 'aktif',
    },
    {
      id: 'acc-2',
      nickname: 'akun-pro-rendah',
      email: 'pro-rendah@gmail.com',
      tier: 'pro',
      paused: false,
      tracked_models: ['claude', 'gemini'],
      in_rotation: true,
      lowest_tracked_pct: 40,
      status: 'aktif',
    },
    {
      id: 'acc-3',
      nickname: 'akun-pro-tinggi',
      email: 'pro-tinggi@gmail.com',
      tier: 'pro',
      paused: false,
      tracked_models: ['claude', 'gemini'],
      in_rotation: true,
      lowest_tracked_pct: 85,
      status: 'aktif',
    },
    {
      id: 'acc-4',
      nickname: 'akun-ultra',
      email: 'ultra@gmail.com',
      tier: 'ultra',
      paused: false,
      tracked_models: ['claude', 'gemini'],
      in_rotation: true,
      lowest_tracked_pct: 60,
      status: 'aktif',
    },
    {
      id: 'acc-5',
      nickname: 'akun-dijeda',
      email: 'paused@gmail.com',
      tier: 'ultra',
      paused: true,
      tracked_models: ['claude', 'gemini'],
      in_rotation: true,
      lowest_tracked_pct: 100,
      status: 'dijeda',
    },
  ];

  it('harus memilih Ultra lebih dulu dibanding Pro dan Free sesuai tier_priority', () => {
    const result = selectBestAccount(mockAccounts, {
      threshold_pct: 5,
      tier_priority: ['ultra', 'pro', 'free'],
    });
    expect(result.bestAccount?.nickname).toBe('akun-ultra');
  });

  it('harus memilih Pro kuota tertinggi jika tidak ada Ultra', () => {
    const withoutUltra = mockAccounts.filter((a) => a.tier !== 'ultra' || a.paused);
    const result = selectBestAccount(withoutUltra, {
      threshold_pct: 5,
      tier_priority: ['ultra', 'pro', 'free'],
    });
    expect(result.bestAccount?.nickname).toBe('akun-pro-tinggi');
  });

  it('harus mendeteksi allExhausted = true jika semua akun berada di bawah ambang batas', () => {
    const exhaustedAccounts: AccountWithStatus[] = [
      {
        id: 'acc-ex-1',
        nickname: 'akun-ex-1',
        email: 'ex1@gmail.com',
        tier: 'pro',
        paused: false,
        tracked_models: ['claude'],
        in_rotation: true,
        lowest_tracked_pct: 2,
        status: 'limit',
        claude_resets_at: new Date(Date.now() + 3600000).toISOString(),
      },
      {
        id: 'acc-ex-2',
        nickname: 'akun-ex-2',
        email: 'ex2@gmail.com',
        tier: 'pro',
        paused: false,
        tracked_models: ['claude'],
        in_rotation: true,
        lowest_tracked_pct: 0,
        status: 'limit',
        claude_resets_at: new Date(Date.now() + 1800000).toISOString(),
      },
    ];

    const result = selectBestAccount(exhaustedAccounts, {
      threshold_pct: 5,
      tier_priority: ['ultra', 'pro', 'free'],
    });

    expect(result.allExhausted).toBe(true);
    expect(result.bestAccount).toBeNull();
    expect(result.fastestResetAccount?.nickname).toBe('akun-ex-2');
  });
});

describe('Unit Tests: Parser Antigravity CLI', () => {
  it('harus mem-parsing format teks keluaran status', () => {
    const mockOutput = `
Account: dev1@example.com (Pro)
  Claude 3.5 Sonnet / Opus: 75% remaining, resets at 03:15
  Gemini 1.5 Pro: 90% remaining, resets at 02:45

Account: dev2@example.com (Ultra)
  Claude Opus: 0% remaining, resets at 01:20
  Gemini Pro: 50% remaining, resets at 01:20
    `;

    const parsed = parseAntigravityCliOutput(mockOutput, 'remaining');
    expect(parsed.length).toBe(2);

    expect(parsed[0].email).toBe('dev1@example.com');
    expect(parsed[0].tier).toBe('pro');
    expect(parsed[0].claude_pct).toBe(75);
    expect(parsed[0].claude_resets_at).toBe('03:15');
    expect(parsed[0].gemini_pct).toBe(90);

    expect(parsed[1].email).toBe('dev2@example.com');
    expect(parsed[1].tier).toBe('ultra');
    expect(parsed[1].claude_pct).toBe(0);
    expect(parsed[1].gemini_pct).toBe(50);
  });
});

describe('Unit Tests: Kriptografi AES-256-GCM (encrypt & decrypt)', () => {
  it('harus berhasil mengenkripsi dan mendekripsi string dengan sempurna', () => {
    const testSecret = 'https://discord.com/api/webhooks/123456789/abcdefghij-secret-token';
    const encrypted = encrypt(testSecret);
    expect(encrypted).not.toBe(testSecret);
    expect(encrypted.split(':').length).toBe(3);

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(testSecret);
  });
});

describe('Unit Tests: Parser Balasan Asli Google Quota API (parseQuotaResponses)', () => {
  // Payload asli dari server Google Cloud Code API untuk akun yang kena limit
  const realLimitedQuotaPayload = {
    buckets: [
      { modelId: 'claude-opus-4-6-thinking', remainingFraction: 1, resetTime: '2026-11-16T05:59:37Z' },
      { modelId: 'claude-sonnet-4-6', remainingFraction: 1, resetTime: '2026-11-16T05:59:37Z' },
      { modelId: 'gemini-2.5-flash', remainingFraction: 0.0138672, resetTime: '2026-11-12T05:32:44Z' },
      { modelId: 'gemini-2.5-pro', remainingFraction: 0.0138672, resetTime: '2026-11-12T05:32:44Z' },
      { modelId: 'gemini-3-flash', remainingFraction: 0.0138672, resetTime: '2026-11-12T05:32:44Z' },
      { modelId: 'gpt-oss-120b-medium', remainingFraction: 1, resetTime: '2026-11-16T05:59:37Z' },
    ],
  };

  const realWeeklySummaryPayload = {
    groups: [
      {
        displayName: 'Claude and GPT models',
        buckets: [
          {
            bucketId: '3p-weekly',
            displayName: 'Weekly Limit Remaining',
            window: 'weekly',
            remainingFraction: 1,
            resetTime: '2026-11-16T05:59:36Z',
          },
        ],
      },
    ],
  };

  it('akun dengan fraksi Gemini habis (0.0138672) harus menghasilkan 0% dan status limit', () => {
    const parsed = parseQuotaResponses(realWeeklySummaryPayload, realLimitedQuotaPayload);

    expect(parsed.gemini_pct).toBe(0); // fraksi < 0.02 dinormalisasi ke 0% (habis)
    expect(parsed.claude_pct).toBe(100);
    expect(parsed.mingguan_pct).toBe(100);
    expect(parsed.gemini_resets_at).toBe('2026-11-12T05:32:44Z');

    const status = calculateAccountStatus({
      paused: false,
      tracked_models: ['claude', 'gemini', 'mingguan'],
      claude_pct: parsed.claude_pct,
      gemini_pct: parsed.gemini_pct,
      mingguan_pct: parsed.mingguan_pct,
    });

    expect(status.status).toBe('limit');
    expect(status.lowest_pct).toBe(0);
    expect(status.colorHex).toBe('#FF7A7A');
  });

  it('akun sehat dengan remainingFraction 1 harus menghasilkan 100% dan status aktif', () => {
    const healthyQuotaPayload = {
      buckets: [
        { modelId: 'claude-opus-4-6-thinking', remainingFraction: 1, resetTime: '2026-11-16T06:00:00Z' },
        { modelId: 'gemini-2.5-pro', remainingFraction: 1, resetTime: '2026-11-16T06:00:00Z' },
      ],
    };
    const healthySummaryPayload = {
      groups: [
        {
          displayName: 'Claude and GPT models',
          buckets: [{ remainingFraction: 1, resetTime: '2026-11-16T06:00:00Z' }],
        },
      ],
    };

    const parsed = parseQuotaResponses(healthySummaryPayload, healthyQuotaPayload);
    expect(parsed.claude_pct).toBe(100);
    expect(parsed.gemini_pct).toBe(100);
    expect(parsed.mingguan_pct).toBe(100);

    const status = calculateAccountStatus({
      paused: false,
      tracked_models: ['claude', 'gemini', 'mingguan'],
      claude_pct: parsed.claude_pct,
      gemini_pct: parsed.gemini_pct,
      mingguan_pct: parsed.mingguan_pct,
    });

    expect(status.status).toBe('aktif');
    expect(status.lowest_pct).toBe(100);
    expect(status.colorHex).toBe('#4ADE9A');
  });

  it('akun yang limit pada dimensi mingguan (3p-weekly 0%) harus menghasilkan status limit', () => {
    const weeklyExhaustedSummary = {
      groups: [
        {
          displayName: 'Weekly Limit',
          buckets: [{ remainingFraction: 0, resetTime: '2026-11-16T06:00:00Z' }],
        },
      ],
    };
    const healthyQuotaPayload = {
      buckets: [
        { modelId: 'claude-opus-4-6-thinking', remainingFraction: 1 },
        { modelId: 'gemini-2.5-pro', remainingFraction: 1 },
      ],
    };

    const parsed = parseQuotaResponses(weeklyExhaustedSummary, healthyQuotaPayload);
    expect(parsed.mingguan_pct).toBe(0);
    expect(parsed.claude_pct).toBe(100);
    expect(parsed.gemini_pct).toBe(100);

    const status = calculateAccountStatus({
      paused: false,
      tracked_models: ['claude', 'gemini', 'mingguan'],
      claude_pct: parsed.claude_pct,
      gemini_pct: parsed.gemini_pct,
      mingguan_pct: parsed.mingguan_pct,
    });

    expect(status.status).toBe('limit');
    expect(status.lowest_pct).toBe(0);
  });

  it('multi-model: harus mengambil nilai terendah per grup, bukan nilai terakhir', () => {
    const multiModelPayload = {
      buckets: [
        { modelId: 'gemini-2.5-flash', remainingFraction: 0.1 }, // 10%
        { modelId: 'gemini-2.5-pro', remainingFraction: 0.9 },   // 90%
        { modelId: 'claude-sonnet-4-6', remainingFraction: 0.8 }, // 80%
        { modelId: 'claude-opus-4-6-thinking', remainingFraction: 0.3 }, // 30%
      ],
    };

    const parsed = parseQuotaResponses(null, multiModelPayload);
    expect(parsed.gemini_pct).toBe(10); // terendah antara 10% dan 90%
    expect(parsed.claude_pct).toBe(30); // terendah antara 80% dan 30%
  });

  it('larang nilai bawaan 100: data tidak ada/rusak harus bernilai null dan status tidak_diketahui', () => {
    const parsed = parseQuotaResponses(null, null);
    expect(parsed.claude_pct).toBeNull();
    expect(parsed.gemini_pct).toBeNull();
    expect(parsed.mingguan_pct).toBeNull();

    const status = calculateAccountStatus({
      paused: false,
      tracked_models: ['claude', 'gemini', 'mingguan'],
      claude_pct: parsed.claude_pct,
      gemini_pct: parsed.gemini_pct,
      mingguan_pct: parsed.mingguan_pct,
    });

    expect(status.status).toBe('tidak_diketahui');
    expect(status.lowest_pct).toBeNull();
  });
});

