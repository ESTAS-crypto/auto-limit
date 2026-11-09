/**
 * scripts/create-shortcut.mjs
 * Membuat shortcut Quota Radar di Desktop pengguna Windows.
 */

import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function main() {
  if (process.platform !== 'win32') {
    console.log('[Info] Pembuatan shortcut desktop otomatis hanya untuk sistem operasi Windows.');
    return;
  }

  const psScript = `
$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path -Path $DesktopPath -ChildPath 'Quota Radar.lnk'
$TargetPath = "${path.join(rootDir, 'Mulai Quota Radar.bat').replace(/\\/g, '\\\\')}"
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $TargetPath
$Shortcut.WorkingDirectory = "${rootDir.replace(/\\/g, '\\\\')}"
$Shortcut.Description = 'Pemantau Kuota Antigravity & Rotasi Akun'
$IconPath = "${path.join(rootDir, 'public', 'assets', 'logo.ico').replace(/\\/g, '\\\\')}"
if (Test-Path $IconPath) { $Shortcut.IconLocation = $IconPath }
$Shortcut.Save()
Write-Host "✔ Shortcut berhasil dibuat di Desktop Anda!" -ForegroundColor Green
`;

  const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psScript], {
    stdio: 'inherit',
  });

  await new Promise((resolve) => child.on('close', resolve));
}

main().catch((err) => {
  console.error('Gagal membuat shortcut:', err.message);
});

