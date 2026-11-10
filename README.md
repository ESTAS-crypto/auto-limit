# Quota Radar

Dashboard pemantau sisa kuota banyak akun Google yang dipakai di Google Antigravity. Web berjalan di komputer lokal dengan sekali klik file `.bat`, dan datanya disimpan di Supabase dengan pembaruan Realtime.

---

## 0. Rencana Singkat & Daftar Risiko

### Rencana Arsitektur
1. **Frontend & Server Lokal**: Next.js App Router (TypeScript strict) + Tailwind CSS + Framer Motion. Mengadopsi design system gelap eksklusif (kartu 20px, animasi cubic-bezier, font Bricolage Grotesque, Inter, JetBrains Mono, maskot Blip, dan ikon SVG kustom).
2. **Kerahasian Kredensial**: Semua token OAuth dan URL webhook dienkripsi menggunakan AES-256-GCM (`ENCRYPTION_KEY`). Secret tidak pernah dikirim ke browser atau ditulis di log. Server mendengarkan `127.0.0.1`.
3. **Database & Realtime**: Supabase PostgreSQL dengan RLS aktif di seluruh tabel (akses anon ditolak penuh; server lokal menggunakan Service Role Key). Realtime aktif pada `quota_snapshots`, `accounts`, dan `rotation_events`. Sedia mode penyimpanan lokal/mock jika Supabase belum dikonfigurasi saat pertama kali dibuka.
4. **Adapter Kuota (Multi-Provider)**:
   - `CcsProvider` (Utama): membaca konfigurasi CCS (`accounts.json`, `config.yaml`, dan file auth `antigravity-*.json`).
   - `AntigravityCliProvider`: menjalankan `node index.js status` di folder `antigravity-cli` dengan parser teks toleran.
   - `MockProvider` (Bawaan): menyediakan data simulasi realistis dengan label jelas "Data contoh".
   - `OAuthProvider`: kerangka aman untuk ekstensi masa depan.
5. **Rotasi Akun (2 Skenario)**:
   - *Skenario A (Proxy CCS)*: Web mengatur `config.yaml` dan menjalankan perintah daftar putih (`ccs agy --use`, `pause`, `resume`).
   - *Skenario B (IDE Antigravity Langsung)*: Web memberi rekomendasi akun terbaik dan notifikasi pengingat pergantian manual.
6. **Worker Polling & Discord Notifier**: Proses background Node.js yang memantau kuota secara berkala dengan jitter dan exponential backoff, serta mengirim embed Discord berwarna status dengan sistem deduplikasi/cooldown.

### Daftar Risiko & Mitigasi
| Risiko | Dampak | Strategi Mitigasi |
| :--- | :--- | :--- |
| **Akun Google Terkena Pembatasan / Blokir** | Akun tidak dapat digunakan di Antigravity | Gunakan akun Google lama yang sudah terverifikasi. Jangan membuat akun bot baru massal. Beri peringatan tegas di antarmuka dan dokumentasi. |
| **Bentrokan Token Antara `ccs gemini` & `ccs agy`** | Token OAuth tertimpa atau sesi terputus | Hindari memakai satu akun Google yang sama untuk kedua target tersebut secara bersamaan. |
| **Format Teks `antigravity-cli status` Berubah** | Parser gagal membaca sisa persen atau jam reset | Parser dibuat dengan regex toleran multi-pola, fallback gracefully tanpa crash, dan unit test lengkap. |
| **Inkonsistensi Tafsir Persen (Sisa vs Terpakai)** | Angka kuota terbalik (misal 95% dianggap 5%) | Tersedia fitur **Kalibrasi Kuota** saat setup/pengaturan (`quota_semantics`: `remaining` vs `used`). |
| **Rate Limiting Saat Polling Kuota** | IP lokal atau token dibatasi sementara oleh server | Interval polling minimal 60 detik dengan jitter acak, pengecekan akun serial satu per satu, dan exponential backoff otomatis. |
| **Kegagalan Eksekusi Shell Bebas** | Rentan eksploitasi injeksi perintah | Hanya izinkan perintah whitelist tetap (`ccs agy --use <nickname>`, `ccs cliproxy pause/resume`). Parameter divalidasi ketat dengan Zod. |

---

## 1. Panduan Cepat: Sekali Klik Jalan

### Menjalankan di Windows:
1. Dobel-klik **`Mulai Quota Radar.bat`**.
2. Skrip akan otomatis:
   - Memeriksa instalasi Node.js (v20+).
   - Menginstal dependensi (`npm install`) jika belum ada.
   - Menjalankan wizard setup interaktif berbahasa Indonesia (`npm run setup`) jika file `.env.local` belum ada.
   - Melakukan kompilasi build produksi.
   - Menjalankan server web dan background worker, lalu membuka `http://localhost:3000` di peramban secara otomatis.

### Menghentikan Aplikasi:
- Dobel-klik **`Hentikan Quota Radar.bat`** untuk menutup server dan background worker dengan bersih.

### Membuat Shortcut Desktop:
- Dobel-klik **`Buat Shortcut Desktop.bat`** untuk membuat jalan pintas di Desktop Windows Anda.

### Menjalankan di Linux / macOS:
```bash
chmod +x mulai.sh
./mulai.sh
```

---

## 2. Setup Database Supabase

Jika Anda menghubungkan ke Supabase:
1. Buat project baru di [Supabase](https://supabase.com) (tersedia paket gratis).
2. Salin **Project URL**, **Anon Key**, dan **Service Role Key** dari menu *Project Settings > API*.
3. Masukkan kunci tersebut saat wizard `npm run setup` berjalan.
4. Jalankan skrip SQL di Supabase SQL Editor dari file:
   - `supabase/migrations/0001_init.sql` (struktur tabel, view, RLS, dan fungsi)
   - `supabase/seed.sql` (opsional: data contoh untuk pengujian awal)

> **Catatan Keamanan:** Row Level Security (RLS) diaktifkan secara ketat pada semua tabel dan menolak semua permintaan anonim. Hanya server backend lokal dengan *Service Role Key* yang memiliki izin baca/tulis.

---

## 3. Cara Beralih ke Provider Nyata

Aplikasi secara default menggunakan `MockProvider` ("Data contoh"). Untuk beralih ke provider nyata:

### A. Menggunakan CCS (Rekomendasi Utama)
1. Pastikan CCS terpasang dan Anda sudah login akun Antigravity:
   ```bash
   ccs agy --accounts
   ```
2. Buka berkas `.env.local` dan atur:
   ```env
   QUOTA_PROVIDER=ccs
   CCS_HOME=C:\Users\<Username>\.ccs   # atau ~/.ccs di Linux/Mac
   ```
3. Restart Quota Radar. Data akun dan kuota akan otomatis dibaca dari konfigurasi CCS.

### B. Menggunakan antigravity-cli
1. Clone dan setup repo `antigravity-cli`:
   ```bash
   node index.js login
   ```
2. Buka berkas `.env.local` dan atur:
   ```env
   QUOTA_PROVIDER=antigravity-cli
   ANTIGRAVITY_CLI_DIR=C:\path\to\antigravity-cli
   ```
3. Restart Quota Radar.

---

## 4. Endpoint API untuk Integrasi Pihak Ketiga

Quota Radar menyediakan endpoint lokal untuk skrip atau ekstensi IDE:
- `GET /api/active-account`: Mengembalikan data akun yang sedang aktif dan sisa kuotanya.
- `POST /api/rotation/next`: Memicu pergantian ke akun terbaik berikutnya sesuai mode dan prioritas.
- `POST /api/poll`: Memicu pembaruan pengecekan kuota manual segera.
- `POST /api/calibration`: Mengubah semantik persen kuota (`remaining` atau `used`).

---

## 5. Rencana Tahap Lanjutan
Di masa mendatang, aplikasi ini dapat dibungkus menjadi file installer executable desktop (`.exe`) tunggal menggunakan Tauri atau Electron yang menyertakan tray icon di taskbar Windows.

---

## 6. Laporan Penyelidikan: Limit Mingguan & Language Server IDE

### A. Dimensi Kuota: Claude/GPT vs Gemini
1. **Claude dan GPT (mingguan)**:
   - Sumber: Endpoint resmi `cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary`.
   - Grup: `Claude and GPT models` (bucket `3p-weekly`).
   - Status: Akurat dan otomatis diperbarui langsung dari server Google untuk semua akun.

2. **Gemini Models (mingguan)**:
   - Temuan Empiris: Endpoint server REST (`retrieveUserQuotaSummary`, `fetchAvailableModels`, `retrieveUserQuota`, `loadCodeAssist`) **tidak mengembalikan** kuota mingguan Gemini untuk akun tingkat Starter/Free.
   - Di UI dan database: Ditampilkan secara transparan sebagai **"tidak tersedia dari server"** (`status: tidak_diketahui`, ikon `?`), bukan nilai default palsu 100% atau 0%.
   - **Status Akun**: Jika Gemini kosong/tidak tersedia, status kesehatan akun (aktif/hampir limit/limit) dihitung **hanya dari Claude**.
   - **Fitur Isian Manual "Gemini mingguan (dari IDE)"**:
     - Pengguna dapat mengisi persentase Gemini dan waktu reset (sesuai yang tertera di menu *Models & Usage* pada Antigravity IDE) melalui tombol **Sesuaikan** di halaman Akun.
     - Nilai manual diberi label `(manual)` dan akan **otomatis kedaluwarsa** setelah waktu reset tercapai (kembali menjadi tidak tersedia).

### B. Hasil Penyelidikan Language Server Lokal IDE Antigravity
Sesuai pengujian terhadap proses lokal Antigravity IDE yang sedang berjalan:
1. Port lokal yang terbuka:
   - `Port 50131`: Server internal pratinjau browser HTML IDE (`<!DOCTYPE html>...<link rel="stylesheet" href="browser.css">`), bukan endpoint API.
   - `Port 59641`: Server internal web UI Antigravity Hub (`agy.exe --hub`).
2. Proses IDE (`Antigravity IDE.exe`):
   - Berjalan sebagai arsitektur Electron multi-proses yang berkomunikasi menggunakan IPC internal Node.js (`--node-ipc`) dan Unix domain socket/named pipe privat tanpa antarmuka REST atau gRPC eksternal yang dapat diakses publik.
3. Di dalam IDE, nilai `0%` atau limit Gemini muncul saat terjadi error penolakan kuota (`ARGON_LIMIT_REACHED` / `QUOTA_EXHAUSTED`) dengan metadata `quotaResetUTCTimestamp` yang disimpan dalam state memori internal renderer Electron IDE.
4. **Kesimpulan**: Language server proses lokal IDE tidak mengekspos API publik untuk pembacaan kuota eksternal. Oleh karena itu, pendekatan yang digunakan adalah integrasi resmi REST API untuk Claude/GPT dan fitur isian manual terpandu (dengan auto-expiry) untuk Gemini.


