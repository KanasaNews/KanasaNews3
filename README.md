# Kanasa News x Kelompok 5 — Ruang untuk Memahami

Portal berita editorial modern berbahasa Indonesia dan sistem agregator berita terverifikasi dengan desain jurnalisme cetak kontemporer, panel admin redaksi waktu nyata (*real-time*), serta arsitektur **Next.js 14 + TypeScript + Tailwind CSS + Supabase + GitHub Actions**.

## 1. Arsitektur & Fitur Utama
- **11 Kategori Standar**: Nasional, Internasional, Politik, Ekonomi, Teknologi, Pendidikan, Kesehatan, Olahraga, Hiburan, Sains, dan Daerah.
- **Sistem Agregator Berita Otomatis (`src/lib/aggregator.ts` & `supabase/functions/ingest-news`)**:
  - Mendukung RSS/Atom feed dan API berita resmi.
  - **Deteksi Duplikat Ganda**: Kanonikalisasi URL + hash `SHA-256` serta pencocokan kemiripan judul (*Jaccard Token Similarity* dengan ambang batas yang dapat diatur).
  - **Kategorisasi Otomatis**: Klasifikasi berbasis pembobotan kata kunci ke 11 desk berita.
  - **Ringkasan Bahasa Indonesia dengan AI Opsional**: Menyusun intisari independen tanpa menyalin seluruh isi artikel berhak cipta, lengkap dengan atribusi sumber primer dan tautan wajib ke artikel asli.
  - **Pencatatan Error & Audit Log**: Mencatat durasi respons (ms), jumlah berita baru, duplikat yang dicegah, dan pesan error HTTP/XML di tabel `sync_logs`.
- **Dashboard Admin Redaksi**:
  - Mengelola artikel, menetapkan *Headline Utama*, *Pilihan Redaksi*, dan *Breaking News*, menambah/menguji sumber RSS, mengatur jadwal cron, mengubah metadata SEO, dan mengelola aset visual Canva.
- **Keamanan & Supabase Row Level Security (RLS)**:
  - Skema PostgreSQL lengkap di `supabase/migrations/001_initial_schema.sql` dengan kebijakan RLS ketat (`public.is_admin()`).

## 2. Panduan Konfigurasi & Deployment
1. **Supabase**:
   - Buat proyek baru di Supabase, buka **SQL Editor**, lalu jalankan isi file `supabase/migrations/001_initial_schema.sql`.
   - Buat bucket Storage bernama `editorial-assets` (Public) untuk menyimpan logo, banner, dan sampul hasil ekspor Canva.
   - Tambahkan role admin pada akun redaksi di `auth.users` melalui `raw_app_meta_data: {"role": "admin"}`.
2. **Environment Variables**:
   - Salin `.env.example` menjadi `.env.local` dan isi `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, dan `CRON_SECRET`.
3. **GitHub & Hosting (Vercel / Cloudflare Pages)**:
   - Unggah repositori ini ke GitHub. Workflow `.github/workflows/ci-deploy.yml` otomatis menjalankan *typecheck*, *lint*, dan *build*.
   - Workflow `.github/workflows/cron-ingest.yml` memicu sinkronisasi berita setiap 15 menit secara otomatis.
4. **Alur Aset Visual Canva**:
   - Gunakan integrasi Canva Connect atau ekspor aset dari Canva dalam format SVG/WebP, lalu unggah melalui tab **Aset & Canva** di Admin Panel.
