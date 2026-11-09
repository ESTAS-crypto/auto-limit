/**
 * scripts/generate-ico.mjs
 * Menghasilkan file logo.ico sederhana untuk icon shortcut Desktop Windows.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 32x32 BMP inside ICO
const width = 32;
const height = 32;
const bpp = 32;
const imageSize = width * height * 4;
const headerSize = 40; // BITMAPINFOHEADER

const icoHeader = Buffer.alloc(6);
icoHeader.writeUInt16LE(0, 0); // Reserved
icoHeader.writeUInt16LE(1, 2); // Icon type
icoHeader.writeUInt16LE(1, 4); // 1 image

const dirEntry = Buffer.alloc(16);
dirEntry.writeUInt8(width, 0);
dirEntry.writeUInt8(height, 1);
dirEntry.writeUInt8(0, 2); // Color palette
dirEntry.writeUInt8(0, 3); // Reserved
dirEntry.writeUInt16LE(1, 4); // Planes
dirEntry.writeUInt16LE(bpp, 6); // Bits per pixel
dirEntry.writeUInt32LE(headerSize + imageSize, 8); // Size of image data
dirEntry.writeUInt32LE(22, 12); // Offset (6 + 16 = 22)

const bih = Buffer.alloc(40);
bih.writeUInt32LE(40, 0); // Header size
bih.writeInt32LE(width, 4);
bih.writeInt32LE(height * 2, 8); // Height is doubled for mask in ICO
bih.writeUInt16LE(1, 12); // Planes
bih.writeUInt16LE(bpp, 14); // Bit count
bih.writeUInt32LE(0, 16); // Compression (BI_RGB)
bih.writeUInt32LE(imageSize, 20); // Image size
bih.writeInt32LE(0, 24); // X pixels per meter
bih.writeInt32LE(0, 28); // Y pixels per meter
bih.writeUInt32LE(0, 32); // Colors used
bih.writeUInt32LE(0, 36); // Important colors

const pixels = Buffer.alloc(imageSize);
const cx = width / 2;
const cy = height / 2;
const rOuter = 13;
const rInner = 6;

// Render concentric radar circles in green (#4ADE9A -> B: 0x9A, G: 0xDE, R: 0x4A)
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const idx = (y * width + x) * 4;
    const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);

    let isLine = Math.abs(dist - rOuter) < 1.3 || Math.abs(dist - rInner) < 1.3 || dist < 2.2;
    // Sweep line
    if (dist <= rOuter && Math.abs(x - y) < 1.2 && x >= cx && y >= cy) {
      isLine = true;
    }

    if (isLine) {
      pixels[idx + 0] = 0x9a; // Blue
      pixels[idx + 1] = 0xde; // Green
      pixels[idx + 2] = 0x4a; // Red
      pixels[idx + 3] = 0xff; // Alpha
    } else {
      pixels[idx + 0] = 0;
      pixels[idx + 1] = 0;
      pixels[idx + 2] = 0;
      pixels[idx + 3] = 0;
    }
  }
}

const icoBuffer = Buffer.concat([icoHeader, dirEntry, bih, pixels]);
fs.writeFileSync(path.join(rootDir, 'public', 'assets', 'logo.ico'), icoBuffer);
console.log('✔ File public/assets/logo.ico berhasil dibuat.');

