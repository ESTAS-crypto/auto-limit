/**
 * src/lib/rotation.ts
 * Server-side rotation execution and re-exports.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { RotationSettings } from './types';
import { switchIdeAccount } from './ide-switch';

export * from './rotation-eval';

/**
 * Eksekusi perintah aman (hanya whitelist)
 */
export async function executeWhitelistedAction(
  action: 'use' | 'pause' | 'resume',
  target: { nickname?: string; email?: string }
): Promise<{ ok: boolean; message: string }> {
  const customSwitchCommand = process.env.SWITCH_COMMAND;

  // Jika action = 'use' dan ada custom switch command
  if (action === 'use' && customSwitchCommand && target.nickname) {
    const sanitizedNickname = target.nickname.replace(/[^a-zA-Z0-9_-]/g, '');
    const cmd = customSwitchCommand.replace('{nickname}', sanitizedNickname);
    console.log(`[Rotasi] Menjalankan perintah kustom: ${cmd}`);
    return runCommand(cmd);
  }

  // Whitelist CCS
  let command = '';
  let args: string[] = [];

  if (action === 'use') {
    if (!target.nickname && !target.email) throw new Error('Nickname atau email akun diperlukan untuk berganti akun.');
    const sanitizedNickname = (target.nickname || target.email?.split('@')[0] || '').replace(/[^a-zA-Z0-9_-]/g, '');
    command = 'ccs';
    args = ['agy', '--use', sanitizedNickname];

    // Sinkronkan juga konfigurasi akun di Antigravity IDE secara langsung
    if (target.email) {
      try {
        const ideRes = switchIdeAccount(target.email);
        console.log('[Rotasi] Sinkronisasi Antigravity IDE:', ideRes.message);
      } catch (e: any) {
        console.warn('[Rotasi] Gagal menyinkronkan ke Antigravity IDE:', e.message);
      }
    }
  } else if (action === 'pause') {
    if (!target.email) throw new Error('Email akun diperlukan untuk jeda akun.');
    const sanitizedEmail = target.email.replace(/[^a-zA-Z0-9@._-]/g, '');
    command = 'ccs';
    args = ['cliproxy', 'pause', 'agy', sanitizedEmail];
  } else if (action === 'resume') {
    if (!target.email) throw new Error('Email akun diperlukan untuk melanjutkan akun.');
    const sanitizedEmail = target.email.replace(/[^a-zA-Z0-9@._-]/g, '');
    command = 'ccs';
    args = ['cliproxy', 'resume', 'agy', sanitizedEmail];
  }

  console.log(`[Rotasi] Eksekusi whitelist: ${command} ${args.join(' ')}`);
  return runArgs(command, args);
}

function runArgs(cmd: string, args: string[]): Promise<{ ok: boolean; message: string }> {
  return new Promise((resolve) => {
    const isWin = process.platform === 'win32';
    const exe = isWin ? `${cmd}.cmd` : cmd;

    const child = spawn(exe, args, { shell: true });
    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (d) => { stdout += d.toString(); });
    child.stderr?.on('data', (d) => { stderr += d.toString(); });

    child.on('error', (err) => {
      resolve({ ok: false, message: `Gagal menjalankan ${cmd}: ${err.message}` });
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ ok: true, message: stdout.trim() || 'Perintah berhasil dieksekusi.' });
      } else {
        resolve({ ok: false, message: stderr.trim() || stdout.trim() || `Kode keluar: ${code}` });
      }
    });
  });
}

function runCommand(fullCmd: string): Promise<{ ok: boolean; message: string }> {
  return new Promise((resolve) => {
    const child = spawn(fullCmd, { shell: true });
    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (d) => { stdout += d.toString(); });
    child.stderr?.on('data', (d) => { stderr += d.toString(); });

    child.on('error', (err) => {
      resolve({ ok: false, message: `Gagal: ${err.message}` });
    });

    child.on('close', (code) => {
      resolve({
        ok: code === 0,
        message: stdout.trim() || stderr.trim() || `Kode: ${code}`,
      });
    });
  });
}

/**
 * Tulis konfigurasi atomik ke ~/.ccs/cliproxy/config.yaml
 */
export async function updateCcsConfig(
  settings: Pick<RotationSettings, 'mode' | 'threshold_pct' | 'tier_priority'>
): Promise<{ ok: boolean; diff?: string }> {
  const ccsHome = process.env.CCS_HOME || path.join(os.homedir(), '.ccs');
  const configPath = path.join(ccsHome, 'cliproxy', 'config.yaml');

  if (!fs.existsSync(configPath)) {
    return { ok: false, diff: 'Berkas config.yaml CCS tidak ditemukan di ' + configPath };
  }

  try {
    const originalContent = fs.readFileSync(configPath, 'utf-8');
    const backupPath = `${configPath}.bak-${Date.now()}`;
    fs.writeFileSync(backupPath, originalContent, 'utf-8');

    // Modifikasi quota_management secara aman
    const newSection = [
      `quota_management:`,
      `  mode: ${settings.mode}`,
      `  exhaustion_threshold: ${settings.threshold_pct}`,
      `  tier_priority: [${settings.tier_priority.map((t) => `"${t}"`).join(', ')}]`,
    ].join('\n');

    let updatedContent = originalContent;
    if (updatedContent.includes('quota_management:')) {
      updatedContent = updatedContent.replace(/quota_management:[\s\S]*?(?=\n\S|\n$|$)/, newSection);
    } else {
      updatedContent += `\n${newSection}\n`;
    }

    // Tulis atomik
    const tempPath = `${configPath}.tmp-${Date.now()}`;
    fs.writeFileSync(tempPath, updatedContent, 'utf-8');
    fs.renameSync(tempPath, configPath);

    return {
      ok: true,
      diff: `Mode: ${settings.mode}, Ambang: ${settings.threshold_pct}%, Prioritas: ${settings.tier_priority.join(' > ')}`,
    };
  } catch (err: any) {
    return { ok: false, diff: err.message };
  }
}
