/**
 * src/lib/crypto.ts
 * Enkripsi & Dekripsi AES-256-GCM untuk kredensial sensitif & webhook URL.
 * Kunci diambil dari variabel lingkungan ENCRYPTION_KEY (32-byte).
 */

import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 12 bytes standard for GCM

function getEncryptionKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;
  if (!envKey) {
    // Kunci fallback untuk mode dev lokal jika belum diset
    return crypto.scryptSync('quota-radar-local-fallback-salt', 'salt', 32);
  }

  // Jika berupa hex string (64 karakter)
  if (envKey.length === 64 && /^[0-9a-fA-F]+$/.test(envKey)) {
    return Buffer.from(envKey, 'hex');
  }

  // Jika berupa base64 string
  try {
    const buf = Buffer.from(envKey, 'base64');
    if (buf.length === 32) return buf;
  } catch {}

  // Hash atau scrypt jika teks bebas
  return crypto.scryptSync(envKey, 'quota-radar-salt', 32);
}

export function encrypt(plainText: string): string {
  if (!plainText) return '';
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Format: iv:tag:encrypted (hex)
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(cipherText: string): string {
  if (!cipherText) return '';
  const parts = cipherText.split(':');
  if (parts.length !== 3) {
    throw new Error('Format ciphertext tidak valid.');
  }

  const [ivHex, tagHex, dataHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const encrypted = Buffer.from(dataHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

