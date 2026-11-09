# Prompt Quota Radar: web lokal + Supabase

Untuk Antigravity atau agent coding lain. Tempel semua teks di bawah garis PROMPT ke agent, lalu lampirkan screenshot dari galeri `index.html` (urutannya sama dengan daftar di sidebar).

Sebelum mulai: siapkan project Supabase (gratis) dan catat Project URL, anon key, dan service role key.

---

## PROMPT

Kamu adalah senior full-stack engineer sekaligus product designer. Bangun **Quota Radar**: web app dashboard yang memantau sisa kuota banyak akun Google yang dipakai di Google Antigravity, menunjukkan akun mana yang masih aman, hampir limit, atau kena limit, dan membantu berpindah akun. Web ini **berjalan di komputer lokal** dengan sekali klik file `.bat`, dan datanya disimpan di **Supabase**.

Tulis semua teks antarmuka dalam bahasa Indonesia. Kerjakan bertahap sesuai bagian "Tahapan kerja" di bawah, dan jangan berhenti untuk bertanya kalau masih bisa mengambil keputusan yang masuk akal. Tulis asumsimu di README.

## 1. Prinsip yang tidak boleh dilanggar

- **Satu klik jalan.** Pengguna cukup dobel-klik `Mulai Quota Radar.bat`. Tidak ada langkah manual selain mengisi kunci Supabase sekali di wizard.
- **Secret tidak pernah ke browser.** Service role key, token OAuth, dan kunci enkripsi hanya dipakai di server lokal.
- **Jujur soal sumber data.** Google tidak menyediakan API resmi untuk membaca kuota Antigravity per akun. Jangan mengarang endpoint. Lihat bagian 6.
- **UI harus terasa mahal**: gelap, tajam, animasi mulus, tanpa tampilan template bawaan. Ikuti bagian 9 sampai ke detailnya.
- **Tidak ada fitur setengah jadi.** Kalau sebuah bagian belum bisa nyata, sediakan provider tiruan (mock) yang jelas diberi label "Data contoh", jangan data palsu yang menyamar sebagai nyata.

## 2. Tech stack

- Next.js (App Router) + TypeScript strict + React.
- Tailwind CSS dengan design token dari bagian 9, ditambah komponen buatan sendiri (jangan pakai tampilan default library apa pun).
- Motion for React (Framer Motion) untuk animasi layout dan transisi, ditambah CSS murni untuk animasi ringan.
- `@supabase/supabase-js` dan Supabase Realtime untuk update langsung.
- TanStack Query untuk data fetching, Zod untuk validasi, `pg` hanya untuk menjalankan migrasi di wizard.
- Worker polling berupa proses Node terpisah di folder yang sama, dijalankan bersama server lewat `concurrently`.
- Font: Bricolage Grotesque (judul), Inter (teks), JetBrains Mono (angka dan email). Muat lewat `next/font`.
- Node 20 atau lebih baru.

## 3. Cara jalan lokal (wajib)

Buat file berikut di root project:

- `Mulai Quota Radar.bat`: jalankan `chcp 65001`, pindah ke folder file itu (`cd /d %~dp0`), lalu:
  1. Cek `node -v`. Kalau tidak ada atau di bawah 20, tampilkan pesan jelas dan buka halaman unduh Node.js.
  2. Kalau `node_modules` belum ada, jalankan `npm ci`.
  3. Kalau `.env.local` belum ada, jalankan wizard `npm run setup`.
  4. Kalau folder `.next` belum ada atau source berubah, jalankan `npm run build`.
  5. Jalankan `npm run start:all` (server Next.js dan worker) di jendela kecil, tunggu port siap, lalu buka `http://localhost:3000` di browser. Kalau port 3000 terpakai, pilih port kosong berikutnya dan tampilkan di layar.
- `Hentikan Quota Radar.bat`: hentikan server dan worker dengan rapi.
- `Buat Shortcut Desktop.bat`: buat shortcut dengan ikon Quota Radar.
- `mulai.sh` untuk macOS dan Linux dengan perilaku yang sama.
- `npm run setup`: wizard terminal berbahasa Indonesia yang meminta Supabase URL, anon key, dan service role key, lalu:
  - membuat `ENCRYPTION_KEY` acak 32 byte,
  - menguji koneksi ke Supabase,
  - meminta connection string Postgres (opsional) untuk menjalankan migrasi otomatis. Kalau pengguna melewatinya, cetak isi `supabase/migrations/0001_init.sql` dan petunjuk menempelkannya di SQL Editor Supabase,
  - menulis `.env.local`, memastikan `.gitignore` memuatnya, dan membuat `.env.example`.
- README berbahasa Indonesia dengan langkah awal bergambar singkat dan bagian pemecahan masalah.

Tahap lanjutan (jangan dikerjakan sekarang, cukup catat di README): membungkus jadi aplikasi desktop `.exe` dengan Tauri atau Electron.

## 4. Database Supabase

Buat `supabase/migrations/0001_init.sql` dan `supabase/seed.sql` (data contoh). Aktifkan RLS di semua tabel dan **tolak semua akses anon**. Server lokal memakai service role key. Realtime hanya dinyalakan untuk `quota_snapshots`, `accounts`, dan `rotation_events`.

Tabel:

- `accounts`: `id`, `nickname`, `email`, `tier` (`ultra` | `pro` | `free`), `paused` (bool), `tracked_models` (array: `claude`, `gemini`), `in_rotation` (bool), `credentials_enc` (teks terenkripsi, boleh kosong), `created_at`.
- `quota_snapshots`: `id`, `account_id`, `model` (`claude` | `gemini`), `remaining_pct` (0 sampai 100), `resets_at`, `fetched_at`. Simpan riwayat, dan buat view `account_status` yang mengambil snapshot terbaru per akun dan model.
- `rotation_settings` (satu baris): `mode` (`auto` | `manual` | `hybrid`), `threshold_pct` (default 5), `tier_priority` (jsonb, default ultra, pro, free), `active_account_id`, `stop_when_all_exhausted` (bool), `rotation_target` (`proxy` | `ide`), `quota_semantics` (`remaining` | `used`).
- `rotation_events`: `id`, `from_account_id`, `to_account_id`, `reason` (`limit` | `below_threshold` | `manual`), `at`.
- `notification_settings` (satu baris): `webhook_enc`, `rules` (jsonb: `low_quota`, `limit_hit`, `recovered`, `daily_summary`), `low_quota_pct` (default 20), `daily_summary_time` (default 08:00), `cooldown_minutes` (default 30).
- `notification_log`: `id`, `kind`, `account_id`, `payload`, `sent_at`, `ok`.

Status akun dihitung dari kuota terendah di antara model yang dipantau:

- **Limit**: salah satu model yang dipantau bernilai 0%.
- **Hampir limit**: terendah lebih dari 0% dan 20% atau kurang.
- **Aktif (siap dipakai)**: di atas 20%.
- **Dijeda**: `paused = true`, tidak dicek dan tidak ikut rotasi.
- **Tidak diketahui**: pengecekan terakhir gagal. Tampilkan jelas, jangan pura-pura 0% atau 100%.

## 5. Keamanan

- Enkripsi semua kredensial dan URL webhook dengan AES-256-GCM memakai `ENCRYPTION_KEY`. Dekripsi hanya di server.
- Jangan pernah mengirim token atau kunci ke klien. Semua akses Supabase yang sensitif lewat Route Handler atau Server Action.
- Server lokal hanya mendengarkan `127.0.0.1` secara default.
- Validasi semua input dengan Zod, dan beri batas laju pada endpoint tulis.
- Tampilkan di UI dan README peringatan ini: memakai akun Google yang baru dibuat untuk ini berisiko diblokir, jadi pakai akun lama.

## 6. Sumber data kuota dan cara menyambung ke Antigravity

Google tidak menyediakan API resmi untuk membaca kuota Antigravity per akun. Dua proyek komunitas membacanya dari API internal Antigravity memakai token OAuth tiap akun. Informasi di bagian ini dibaca dari dokumentasi mereka dan belum dijalankan, jadi **verifikasi tiap perintah dan format keluaran sebelum mengandalkannya**.

**CCS** (`ccs agy`, dokumentasi di docs.ccs.kaitran.ca):

- Token tiap akun disimpan di `~/.ccs/cliproxy/auth/antigravity-*.json`, daftar akun (nickname, tier) di `~/.ccs/cliproxy/accounts.json`.
- Kuota diambil dengan `loadCodeAssist` (project ID dan tier) lalu `fetchAvailableModels` (persen dan waktu reset per model).
- `ccs agy --accounts` mencantumkan akun beserta kuota. `ccs cliproxy status agy`, `ccs cliproxy pause agy <email>`, `ccs cliproxy resume agy <email>`, dan `ccs agy --use <nickname>` mengatur akun.
- Kebijakan rotasi ada di `~/.ccs/cliproxy/config.yaml`, bagian `quota_management`: `mode` (auto, manual, hybrid), `exhaustion_threshold` (default 5), `tier_priority` (ultra, pro, free), dan `cooldown_minutes`.

**antigravity-cli** (`krmslmz/antigravity-cli`):

- `node index.js login` menambah akun lewat OAuth (ulangi untuk banyak akun), token di `keys.json`.
- `node index.js status` mencetak **teks** per akun: persen sisa Claude Opus dan Gemini Pro beserta jam reset. Bukan JSON, jadi perlu parser yang toleran.
- `node index.js serve` menjalankan proxy lokal yang kompatibel dengan OpenAI di port 6012. Proxy mengecek kuota sebelum tiap permintaan dan melewati akun yang tersisa di bawah 5%.

Buat adapter berikut, dengan urutan prioritas ini:

1. `CcsProvider` (utama). Baca daftar akun dan tier dari `accounts.json` (folder diatur lewat `CCS_HOME`, default `~/.ccs`). Ambil kuota dari keluaran `ccs agy --accounts` jika sudah memuat persen per model. Jika tidak cukup, panggil `fetchAvailableModels` dengan token dari file auth CCS **hanya untuk dibaca**, mengikuti implementasi di sumber CCS di GitHub (URL dan header yang benar harus dibaca dari kodenya, jangan ditebak).
2. `AntigravityCliProvider`. Jalankan `node index.js status` di folder yang diatur lewat `ANTIGRAVITY_CLI_DIR` dan parse teksnya. Sertakan uji parser dengan contoh keluaran dari README repo itu.
3. `MockProvider` (bawaan sampai salah satu di atas dikonfigurasi), diberi label "Data contoh".
4. `OAuthProvider`: kerangka kosong saja. Jangan membuat login OAuth Google sendiri di versi pertama.

Aturan wajib:

- **Normalisasi arti persen.** Sumber tidak konsisten: README antigravity-cli menulis persen *sisa*, contoh di dokumentasi CCS menulis persen *terpakai*. Semua adapter harus menormalkan ke `remaining_pct`. Buat langkah "Kalibrasi" saat pertama jalan: pengguna mengetik angka kuota satu akun dari Antigravity, lalu app memilih tafsir (sisa atau terpakai) yang cocok dan menyimpannya di pengaturan `quota_semantics`.
- **Jangan menyalin token ke Supabase.** Untuk provider CCS dan antigravity-cli, kolom `credentials_enc` dibiarkan kosong. Token hanya dibaca dari file milik tool itu, disimpan di memori sebentar, dan tidak pernah dikirim ke browser atau ditulis ke log.
- **Nama model berubah** (dokumentasi menyebut Claude Opus 4.6 dan Gemini 3 Pro). Ambil nama dari respons dan petakan ke `claude` atau `gemini` lewat awalan nama, jangan di-hardcode.
- **Galat yang dikenali dan pesannya di UI:** 403 (akun tidak punya akses kuota), akun belum diaktifkan (buka dulu di aplikasi Antigravity), token kedaluwarsa (login ulang lewat `ccs agy --auth`), project ID kosong (login ulang). Tampilkan alasan spesifik pada status "Tidak diketahui".
- **Aturan polling:** interval minimal 60 detik dengan jitter acak, cek akun satu per satu, backoff naik saat gagal, dan berhenti sementara saat kena rate limit.
- **Label tidak resmi.** Semua jalur nyata ditandai "tidak resmi" di UI, README, dan halaman pengaturan. Sertakan peringatan: jangan memakai satu akun Google yang sama untuk `ccs gemini` dan `ccs agy` (token bentrok), gunakan akun lama, dan antigravity-cli menyatakan dirinya untuk penggunaan pribadi dan edukasi.

## 7. Rotasi akun: siapa yang sebenarnya berpindah

Yang berpindah akun bukan IDE Antigravity, melainkan proxy (CCS atau `antigravity-cli serve`), dan hanya untuk tool yang diarahkan ke proxy itu (Claude Code, Cursor, Aider, dan sejenisnya). Web ini tidak boleh membuat mesin rotasi kedua yang bertabrakan dengan proxy. Dukung dua skenario dan tanyakan yang mana yang dipakai saat setup (simpan di pengaturan `rotation_target`):

- **Skenario A: tool lewat proxy CCS.** Web menjadi panel kendali. Mode, ambang, dan urutan tier ditulis ke bagian `quota_management` di `config.yaml` (buat cadangan dulu, tulis secara atomik, dan tampilkan perbedaannya sebelum menyimpan). Tombol "Pakai sekarang" menjalankan `ccs agy --use <nickname>`, "Jeda" menjalankan `ccs cliproxy pause agy <email>`, dan "Lanjutkan" menjalankan `resume`. Web menampilkan hasil rotasi dari proxy dan mencatatnya di `rotation_events`, bukan memutuskannya sendiri.
- **Skenario B: IDE Antigravity langsung.** Web tidak bisa memindah akun. Web hanya merekomendasikan akun terbaik dan mengirim notifikasi kapan harus ganti. Tombol "Pakai sekarang" berubah menjadi "Tandai sebagai akun aktif" (catatan di app saja), dan teks bantuan menjelaskan bahwa pindah akun dilakukan manual di IDE.

Pemetaan mode (sama dengan CCS): **Otomatis** = proxy memilih dan memindah sendiri. **Manual** = tidak ada perpindahan otomatis, hanya peringatan saat akun aktif turun di bawah ambang pengingat, dan akun yang kena limit tidak bisa dipilih. **Hybrid** = pindah otomatis tapi pilihan manual dihormati sampai akun itu menyentuh ambang. Ambang rotasi dipetakan ke `exhaustion_threshold` dan urutan prioritas ke `tier_priority`.

Akun terbaik (untuk rekomendasi di dashboard) = akun tidak dijeda, `in_rotation`, dengan kuota terendah di atas ambang. Urutkan menurut `tier_priority`, lalu kuota terbanyak, lalu reset paling cepat. Kalau semua akun habis: berhenti merekomendasikan dan kirim notifikasi dengan waktu reset tercepat.

Keamanan eksekusi perintah: hanya izinkan **daftar putih** perintah di atas (tanpa eksekusi string bebas dari input pengguna), tampilkan perintah yang akan dijalankan sebelum eksekusi, batasi lajunya, catat semuanya di `rotation_events`, dan jalankan hanya dari server lokal. Pengaturan `SWITCH_COMMAND` (templat dengan `{nickname}`) tetap tersedia sebagai jalur cadangan untuk rotator lain dan kosong secara default. Sediakan juga endpoint lokal `GET /api/active-account` dan `POST /api/rotation/next` untuk skrip pihak ketiga.

## 8. Notifikasi Discord

- Simpan URL webhook terenkripsi, tombol "Tes kirim", dan status "Terhubung".
- Aturan: kuota hampir habis, akun kena limit, akun pulih, ringkasan harian. Masing-masing bisa dimatikan.
- Kirim embed dengan judul, deskripsi singkat, kolom Claude dan Gemini, dan "Disarankan: akun-XX". Warna embed mengikuti status (hijau, kuning, merah).
- Dedupe dan cooldown supaya tidak spam. Catat semua di `notification_log`.

## 9. Design system (ikuti persis)

**Warna:** latar `#0C0E13`, permukaan `#14171F`, permukaan terangkat `#1B1F2A`, garis `#232834`, garis hover `#3A4254`, teks `#E8EAF0`, teks redup `#9AA1B2`, hijau (aman) `#4ADE9A`, kuning (hampir limit) `#F5B544`, merah (limit) `#FF7A7A`. Teks di atas hijau memakai `#07110C`. Jangan andalkan warna saja: selalu sertakan label teks dan titik status.

**Bentuk:** kartu radius 20px, tombol radius 12px, chip bentuk pil. Angka dan email memakai JetBrains Mono. Judul besar memakai Bricolage Grotesque, tebal 700, letter-spacing -0.03em.

**Gerak** (semua dihentikan saat `prefers-reduced-motion`):
- Easing utama `cubic-bezier(.2,.8,.2,1)`. Halaman masuk dengan efek kabur ke fokus sekitar 0,8 detik.
- Elemen muncul bertahap dari bawah (naik 20px, skala 0,98 ke 1) dengan jeda 70 ms per elemen.
- Ring kuota terisi sekitar 1,7 detik, bar kuota memanjang sekitar 1,5 detik dengan kilau tipis berulang.
- Titik status berdenyut. Logo radar berputar pelan. Kartu yang kena limit berpendar merah.
- Angka ringkasan menghitung naik dari 0 (sekitar 1,6 detik) dan bertransisi mulus saat nilainya berubah lewat Realtime.
- Kartu dimuat dengan kerangka abu-abu berkilau sekitar 1,4 detik.
- Tombol mode memakai pil hijau yang meluncur dengan sedikit pantulan. Saklar: bulatnya meluncur dan memanjang saat ditekan.
- Tombol aksi (Tes kirim, Simpan, Pakai, Ganti ke...) berganti ke centang dengan teks berhasil sekitar 2 detik, lalu kembali.
- Kartu terangkat 4 sampai 5px saat disentuh, tombol terangkat 2px dan mengecil sedikit saat ditekan.

**Maskot Blip** (SVG, tiga suasana; file jadinya ada di folder `assets/` paket ini): badan persegi membulat 64x58 radius 28 berwarna status, antena garis tebal 4 dengan bola kuning di ujung, dua mata bulat gelap dengan kilau putih, dan mulut. Hijau tersenyum untuk aman, kuning cemas (mulut turun, tetes keringat biru) untuk hampir limit, merah tertidur (mata menutup, tulisan "z") untuk limit. Blip melayang pelan naik turun 7px.

**Ikon custom** (file SVG-nya ada di `assets/icons/`; grid 24, garis 2px, ujung membulat, `currentColor`, jangan pakai library ikon lain): radar, stack, bell, loop, plus, bolt, chat, shield, clock, pause, link, check. Logo: dua lingkaran konsentris hijau (jari-jari 17 dan 8), satu garis sapuan dari tengah, titik di tengah, dan berputar pelan (`assets/logo.svg`).

## 10. Halaman dan komponen

Navigasi atas di desktop: Dashboard, Akun, Notifikasi, Rotasi, dengan ikon custom dan indikator halaman aktif. Di HP berupa tab bar bawah tinggi 84px. Semua area sentuh minimal 44px. Setiap halaman punya mockup HTML di folder `pages/` paket ini: buka dan baca CSS-nya untuk ukuran dan animasi yang tepat.

1. **Dashboard.** Judul "Semua akun, satu layar.", chip "Live · sinkron N dtk lalu", empat kartu ringkasan (total, siap dipakai, hampir limit, kena limit), filter (Semua, Aktif, Hampir limit, Limit), grid kartu akun (email, tier, chip status, ring kuota keseluruhan, bar Claude dan Gemini beserta waktu reset), dan panel samping berisi rekomendasi akun terbaik dengan tombol "Ganti ke akun ini", saklar rotasi otomatis, serta feed notifikasi.
2. **Akun.** Tabel semua akun (akun, tier, Claude, Gemini, status, tombol jeda) dan kartu tips Blip. Di HP: satu akun dibuka sebagai kartu besar (ring, bar, tombol "Pakai sekarang" dan "Jeda"), akun lain berupa baris ringkas dengan ring mini, dan tombol "Tambah akun" mengambang di atas tab bar. **Jangan ada bar geser bawaan browser**: sembunyikan scrollbar pada semua deret yang bisa digeser.
3. **Tambah akun**, tiga langkah dengan stepper dan garis progres yang terisi:
   - Langkah 1: nama panggilan dan tombol "Lanjut dengan Google", ditambah kartu peringatan Blip cemas ("Pakai akun yang sudah lama") dan daftar "Setelah terhubung".
   - Langkah 2, Konfirmasi: akun terhubung dan tier terdeteksi, nama panggilan, tiga saklar (pantau Claude, pantau Gemini, ikut rotasi otomatis), tombol "Cek kuota sekarang", ringkasan.
   - Langkah 3, Kuota pertama: dua ring besar (Claude dan Gemini), chip "Siap dipakai", tombol "Buka dashboard" dan "Tambah akun lagi", kartu Blip senang.
4. **Notifikasi.** Form webhook (status Terhubung, "Tes kirim", "Simpan"), empat saklar aturan, dan pratinjau pesan Discord langsung.
5. **Rotasi.** Tombol mode tiga pilihan dengan pil meluncur. Isi halaman berubah menurut mode:
   - Hybrid: slider ambang "Lewati akun di bawah" (angka besar kuning), kartu urutan prioritas tier dengan garis aliran bergerak, kartu "Kalau semua akun habis" dengan Blip tidur dan waktu reset tercepat.
   - Otomatis: alur tiga langkah beranimasi (cek kuota, pilih akun terbaik, pindah otomatis), slider ambang, kartu akun aktif, dan riwayat perpindahan.
   - Manual: kartu peringatan akun aktif hampir habis dengan tombol ganti, daftar akun untuk dipilih (akun limit redup dan tidak bisa dipilih), bagian otomatis tampil redup karena dimatikan, dan saklar pengingat Discord.
6. **Halaman Ikon dan stiker** (opsional, untuk pengembang): galeri ikon dan tiga suasana Blip.

Keadaan kosong, error, dan memuat harus dirancang dengan Blip dan teks yang ramah, bukan teks mentah.

## 11. Struktur folder yang disarankan

```
quota-radar/
  Mulai Quota Radar.bat   Hentikan Quota Radar.bat   Buat Shortcut Desktop.bat   mulai.sh
  scripts/setup.mjs
  supabase/migrations/0001_init.sql   supabase/seed.sql
  worker/  (polling, rotation engine, notifier)
  src/app/  (halaman dan route handler)
  src/components/  (Ring, QuotaBar, StatusChip, Segmented, Switch, Blip, Icon, ...)
  src/lib/  (supabase, crypto, status, providers/)
  README.md   .env.example
```

## 12. Tahapan kerja

0. Baca lampiran desain dan riset proyek di bagian 6. Tulis rencana singkat dan daftar risiko di README. Jangan minta konfirmasi.
1. Scaffold project, migrasi dan seed Supabase, wizard `setup`, dan semua file `.bat`. Uji sampai dobel-klik membuka halaman kosong yang sehat.
2. Design system dan komponen dasar, lalu semua halaman dengan `MockProvider`. Cocokkan dengan mockup, termasuk animasi.
3. Provider nyata (CCS lebih dulu), worker polling, kalibrasi arti persen, rotasi tiga mode untuk skenario A dan B, notifikasi Discord, Realtime.
4. Poles: responsif HP, keadaan kosong, aksesibilitas (kontras, fokus keyboard, label), uji unit untuk status akun dan pemilihan akun terbaik, dan jalankan sekali dari awal di folder bersih.

**Definisi selesai:** dobel-klik `.bat` di mesin tanpa `node_modules` akhirnya membuka dashboard yang berfungsi dengan data contoh, data tersimpan di Supabase, saklar dan tombol mode bereaksi dengan animasi, tidak ada secret di kode klien, dan README menjelaskan cara beralih ke provider nyata.

## 13. Jangan lakukan

- Jangan membuat akun Google atau mengotomatiskan login dengan cara yang melanggar ketentuan layanan.
- Jangan mengarang endpoint atau token. Kalau jalur nyata belum bisa diverifikasi, tetap pakai `MockProvider` dan jelaskan di README.
- Jangan menyimpan secret di repo, log, atau `localStorage`.
- Jangan memakai tampilan bawaan library komponen atau ikon library lain.
