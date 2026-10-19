# OrgTaskFlow — Aplikasi Monitoring Tugas Organisasi

> **Aplikasi web pemantauan tugas organisasi profesional, responsif, mudah digunakan pemula, dan menargetkan biaya operasional Rp0 menggunakan GitHub Pages dan Supabase Free Tier.**

---

## 1. Ikhtisar & Arsitektur Sistem

OrgTaskFlow dirancang khusus untuk memfasilitasi kebutuhan koordinasi kepanitiaan, himpunan mahasiswa, unit kegiatan mahasiswa, komunitas, dan organisasi non-profit tanpa membebani kas organisasi dengan biaya langganan bulanan maupun domain berbayar.

```
+----------------------------------------------------------------------------+
|                     Frontend Statis (GitHub Pages - Rp0)                   |
|  React 19 + TypeScript + Vite + Tailwind CSS + Recharts + Lucide Icons     |
+----------------------------------------------------------------------------+
                                     |
              +----------------------+----------------------+
              |                                             |
              v                                             v
+-------------------------------+             +------------------------------+
|     Mode Lokal / Offline      |             |    Supabase Free Tier (Rp0)  |
|  - IndexedDB / LocalStorage   |             |  - PostgreSQL Database       |
|  - Backup/Restore JSON        |             |  - Supabase Realtime Sync    |
|  - Data Demo bawaan           |             |  - Public Anon Access (RLS)  |
+-------------------------------+             +------------------------------+
```

### Transparansi Keamanan Model Tanpa Login
Aplikasi ini sengaja dibangun **tanpa sistem login/registrasi pengguna (zero user auth)** guna memastikan akses instan tanpa hambatan bagi seluruh staf dan panitia.
- **Konsekuensi & Batasan Keamanan:** Kredensial yang digunakan ke backend adalah `anon key` publik Supabase (Row Level Security mengizinkan operasi publik untuk peran `anon`).
- **Kode & Peran Organisasi:** Kode organisasi dan identitas staf/PIC diperlakukan murni sebagai **pembeda antarmuka (UI discriminator)**, bukan dinding keamanan kriptografis.
- **Kerahasiaan Backend:** Aplikasi **tidak pernah** mengekspos `service_role` key, kata sandi basis data, atau rahasia backend lainnya.
- **Perhatian Penggunaan:** Jangan gunakan sistem ini untuk menyimpan data rahasia perbankan, PIN, atau informasi sangat sensitif.

---

## 2. Fitur Utama

### A. Pengelolaan Multi-Organisasi & Kegiatan
- **Multi-Organisasi:** Mendukung banyak organisasi dengan data terpisah.
- **Aturan Kegiatan Tunggal Aktif:** Setiap organisasi dapat memiliki banyak kegiatan (misal: *TechFest 2026*, *Dies Natalis*, *Lomba Web Design*), tetapi **hanya satu kegiatan yang berstatus aktif pada satu waktu**. Mengaktifkan kegiatan baru otomatis menonaktifkan kegiatan lainnya.
- **Arsip Tanpa Data Loss:** Kegiatan lama dapat diarsipkan dan dibuka kembali sewaktu-waktu tanpa kehilangan satu pun riwayat tugas.
- **Manajemen Anggota & PIC:** Kelola staf aktif, peran/jabatan, dan kontak. Sistem mencegah penghapusan anggota yang masih terdaftar sebagai PIC pada tugas aktif.

### B. Manajemen Siklus Hidup Tugas
Setiap tugas mencakup:
- **Judul & Deskripsi:** Lengkap dengan instruksi pengerjaan.
- **Kategori:** *Desain*, *Publikasi*, *Dokumentasi*, *Administrasi*, *Lainnya*.
- **Fase:** *Pra-acara*, *Hari-H*, *Pasca-acara*.
- **Prioritas:** *Rendah*, *Sedang*, *Tinggi*, *Mendesak*.
- **PIC Tunggal:** Dipilih secara valid dari anggota aktif organisasi.
- **Tanggal Mulai & Deadline:** Kalender tanggal terintegrasi.
- **Status Tugas:** *Belum dikerjakan*, *Dikerjakan*, *Revisi*, *Selesai*.
- **Progres 0–100%:** Dilengkapi slider interaktif.
  - *Aturan Status Selesai:* Wajib progres 100% dan tanggal selesai otomatis tercatat.
  - *Aturan Status Revisi:* Wajib mencantumkan catatan revisi yang jelas untuk penanggung jawab.
- **Status Review:** *Belum diajukan*, *Menunggu review*, *Disetujui*, *Perlu revisi*.
- **Tautan Referensi & Hasil:** Tautan brief panduan dan tautan hasil pekerjaan (Google Drive, Figma, dll.) yang dapat diklik langsung.
- **Audit Trail:** Riwayat perubahan status dan progres dicatat pada log aktivitas tanpa penghapusan otomatis.

### C. Dashboard Visual & Pusat Peringatan Deadline
- **Metrik Utama:** Total tugas, selesai, berjalan, menunggu review, revisi, dan terlambat.
- **Persentase Penyelesaian:** Perhitungan dinamis `(Selesai / Total) * 100%`.
- **Grafik Interaktif Recharts:**
  - Grafik Donat/Pie distribusi status tugas.
  - Grafik Batang ringkasan beban tugas per staf (selesai vs aktif).
- **Peringatan Kalender Zona Waktu Asia/Jakarta (WIB):**
  - Peringatan deadline **H-7**, **H-3**, dan **H-1**.
  - Peringatan deadline **Hari Ini** dan **Terlambat (Overdue)**.
  - **Aturan Tegas:** Tugas berstatus *Selesai* tidak akan pernah memunculkan alarm deadline.
  - Pusat notifikasi in-app langsung menyorot tugas yang butuh penanganan cepat.

### D. Pencadangan & Pemulihan Mandiri (Rp0 Disaster Recovery)
- **Ekspor Cadangan (JSON):** Unduh seluruh snapshot data organisasi, kegiatan, anggota, tugas, dan log aktivitas dalam 1 klik.
- **Pulihkan Data (JSON):** Unggah file JSON cadangan untuk memulihkan seluruh data secara instan.
- **Data Demo Terisolasi:** Dilengkapi dataset demo bertanda `[DEMO]` yang dapat dimuat ulang atau dihapus bersih kapan saja.

---

## 3. Panduan Konfigurasi Supabase Free

Skema SQL lengkap dengan tabel relasional, foreign keys, constraints, triggers, indexes, RLS, dan Realtime publication tersedia di:
[`supabase/migrations/20261019000000_initial_schema.sql`](file:///C:/Users/Cloud/.gemini/antigravity/scratch/org-task-monitor/supabase/migrations/20261019000000_initial_schema.sql)

### Langkah Pemasangan:
1. Buat akun gratis di [supabase.com](https://supabase.com) dan buat proyek baru (*Free Tier*).
2. Masuk ke menu **SQL Editor** pada dashboard Supabase Anda.
3. Buka file `supabase/migrations/20261019000000_initial_schema.sql`, salin seluruh isinya, tempelkan ke SQL Editor, lalu klik **Run**.
4. Masuk ke **Project Settings** > **API**.
5. Salin:
   - **Project URL** (contoh: `https://xyzprojectid.supabase.co`)
   - **anon public API Key** (contoh: `eyJhbGciOiJIUzI1NiIsIn...`)
6. Buka aplikasi OrgTaskFlow, klik ikon **Pengaturan (roda gigi)** di pojok kanan atas, masukkan URL dan Anon Key tersebut, lalu klik **Uji Koneksi** dan **Simpan & Sinkronkan**.

> [!WARNING]
> **Kebijakan Jeda Supabase Free (Inactivity Pause):**
> Proyek gratis Supabase akan dijeda secara otomatis jika tidak menerima kueri selama **7 hari berturut-turut**.
> **Solusi:** Lakukan ekspor file JSON cadangan secara berkala melalui menu Pengaturan aplikasi agar data kepanitiaan Anda tetap aman dan dapat dipulihkan sewaktu-waktu.

---

## 4. Panduan Deployment ke GitHub Pages

Aplikasi telah dikonfigurasi dengan `base: '/org-task-monitor/'` pada Vite serta skrip pengalihan SPA [`public/404.html`](file:///C:/Users/Cloud/.gemini/antigravity/scratch/org-task-monitor/public/404.html) agar kompatibel dengan sub-direktori repositori GitHub Pages.

Alur CI/CD otomatis telah disiapkan pada:
[`.github/workflows/deploy.yml`](file:///C:/Users/Cloud/.gemini/antigravity/scratch/org-task-monitor/.github/workflows/deploy.yml)

### Langkah Deployment Otomatis:
1. Dorong (*push*) repositori ini ke akun GitHub Anda:
   ```bash
   git add .
   git commit -m "feat: inisialisasi aplikasi monitoring tugas organisasi"
   git branch -M main
   git remote add origin https://github.com/<username>/<repo-name>.git
   git push -u origin main
   ```
2. Pada repositori GitHub, buka menu **Settings** > **Pages**.
3. Pada bagian **Build and deployment** > **Source**, pilih **GitHub Actions**.
4. (Opsional) Jika ingin menyematkan kredensial Supabase pada proses build, buka **Settings** > **Secrets and variables** > **Actions**, tambahkan:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. GitHub Actions akan otomatis menjalankan typecheck, unit test, membangun bundle produksi, dan menerbitkan web ke `https://<username>.github.io/<repo-name>/`.

---

## 5. Menjalankan Aplikasi Secara Lokal & Pengujian

### Kebutuhan:
- Node.js versi 20 atau lebih baru
- npm versi 10 atau lebih baru

### 1. Menjalankan Server Pengembangan (Dev Server):
```bash
npm install
npm run dev
```
Buka browser pada alamat `http://localhost:5173`.

### 2. Menjalankan Type-Check TypeScript:
```bash
npm run typecheck
```

### 3. Menjalankan Unit Test (Vitest):
```bash
npm test
```
*Menguji validasi form, kalkulasi deadline Asia/Jakarta (H-7/3/1, overdue, aturan status Selesai), aturan kegiatan tunggal aktif, audit log, dan render komponen UI.*

### 4. Menjalankan End-to-End Test (Playwright):
```bash
npm run test:e2e
```
*Menguji skenario pengguna nyata: pemuatan dashboard, filter pencarian tugas, pembukaan modal detail, pusat peringatan notifikasi, dan pengaturan pencadangan.*

### 5. Membangun Bundle Produksi:
```bash
npm run build
```
Hasil build siap saji akan berada di dalam direktori `dist/`.

---

## 6. Ringkasan Batasan Layanan Gratis (Rp0)

| Komponen | Penyedia Layanan | Kuota Gratis | Mitigasi / Penanganan |
| :--- | :--- | :--- | :--- |
| **Hosting Frontend** | GitHub Pages | 100 GB transfer data / bulan, 1 GB ukuran repositori | Sangat mencukupi untuk ribuan kunjungan panitia; aset terkompresi dengan gzip |
| **Database & Realtime** | Supabase Free | 500 MB database, 50.000 pengguna aktif bulanan | Skema PostgreSQL terindeks efisien; data demo dapat dibersihkan |
| **Inactivity Pause** | Supabase Free | Proyek dijeda jika tidak aktif selama 7 hari | Fitur ekspor/impor JSON mandiri menjamin data selalu dapat dipulihkan tanpa biaya |
| **Domain & SSL** | GitHub Pages | Subdomain `*.github.io` gratis dengan sertifikat SSL otomatis | Tidak memerlukan pembelian domain atau sertifikat SSL tahunan |

---

## 7. Lisensi

Proyek ini dirancang sebagai perangkat lunak sumber terbuka di bawah lisensi MIT untuk memajukan efisiensi kerja organisasi kemahasiswaan dan nirlaba.
