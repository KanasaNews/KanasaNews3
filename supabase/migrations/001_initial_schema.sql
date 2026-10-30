-- ============================================================================
-- KANASA NEWS — SUPABASE POSTGRESQL SCHEMA & ROW LEVEL SECURITY (RLS)
-- Jalankan migrasi ini di SQL Editor Supabase atau melalui `supabase db push`
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Tabel Kategori (11 Kategori Standar Kanasa News)
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 10,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.categories (slug, name, description, display_order) VALUES
  ('nasional', 'Nasional', 'Kebijakan pemerintah pusat, hukum, pertahanan, dan peristiwa lintas provinsi di Indonesia.', 1),
  ('internasional', 'Internasional', 'Diplomasi global, geopolitik, kawasan ASEAN, PBB, dan perkembangan dunia.', 2),
  ('politik', 'Politik', 'Parlemen DPR/DPD, kebijakan publik, partai politik, pemilu, dan tata negara.', 3),
  ('ekonomi', 'Ekonomi', 'Makroekonomi, fiskal, investasi, industri, pasar keuangan, dan ekonomi kreatif.', 4),
  ('teknologi', 'Teknologi', 'Transformasi digital, kecerdasan buatan (AI), keamanan siber, dan infrastruktur pusat data.', 5),
  ('pendidikan', 'Pendidikan', 'Pendidikan dasar hingga perguruan tinggi, kurikulum, beasiswa, dan literasi.', 6),
  ('kesehatan', 'Kesehatan', 'Layanan kesehatan publik, JKN, pencegahan penyakit, nutrisi, dan kebijakan medis.', 7),
  ('olahraga', 'Olahraga', 'Kompetisi nasional dan internasional, pembinaan atlet, bulu tangkis, sepak bola, dan olimpiade.', 8),
  ('hiburan', 'Hiburan', 'Sinema Indonesia, festival film, musik, seni pertunjukan, dan ekosistem budaya.', 9),
  ('sains', 'Sains', 'Riset ilmiah, lingkungan hidup, iklim, keanekaragaman hayati, dan inovasi kampus.', 10),
  ('daerah', 'Daerah', 'Pembangunan wilayah, ekonomi daerah, layanan publik pemda, dan inovasi nusantara.', 11)
ON CONFLICT (slug) DO NOTHING;

-- 2. Tabel Sumber Berita (RSS Feed & API Resmi)
CREATE TABLE IF NOT EXISTS public.sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  feed_url TEXT UNIQUE NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('rss', 'atom', 'api')),
  default_category TEXT NOT NULL REFERENCES public.categories(name) ON UPDATE CASCADE,
  country TEXT NOT NULL DEFAULT 'ID',
  language TEXT NOT NULL DEFAULT 'id',
  license_note TEXT NOT NULL DEFAULT 'Ringkasan editorial independen & tautan ke artikel asli',
  is_active BOOLEAN NOT NULL DEFAULT true,
  fetch_interval_minutes INT NOT NULL DEFAULT 15,
  last_synced_at TIMESTAMPTZ,
  last_status TEXT NOT NULL DEFAULT 'idle' CHECK (last_status IN ('idle', 'healthy', 'error')),
  last_error TEXT,
  error_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Tabel Artikel Berita (Dengan Fingerprint Deduplikasi & Pencarian Teks Penuh)
CREATE TABLE IF NOT EXISTS public.articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  fingerprint_hash TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  ai_summary TEXT,
  ai_takeaways JSONB DEFAULT '[]'::jsonb,
  ai_reviewed BOOLEAN NOT NULL DEFAULT true,
  category TEXT NOT NULL REFERENCES public.categories(name) ON UPDATE CASCADE,
  source_id UUID REFERENCES public.sources(id) ON DELETE SET NULL,
  source_name TEXT NOT NULL,
  original_url TEXT UNIQUE NOT NULL,
  image_url TEXT,
  image_caption TEXT,
  image_license TEXT NOT NULL DEFAULT 'Ilustrasi Editorial Berlisensi / Aset Resmi Kanasa News',
  author_desk TEXT NOT NULL DEFAULT 'Meja Redaksi Kanasa',
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_headline BOOLEAN NOT NULL DEFAULT false,
  is_editors_pick BOOLEAN NOT NULL DEFAULT false,
  is_breaking BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft', 'archived')),
  views_count INT NOT NULL DEFAULT 0,
  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('indonesian', coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(category, '') || ' ' || coalesce(source_name, ''))
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_articles_category_pub ON public.articles (category, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_search ON public.articles USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_articles_flags ON public.articles (is_headline, is_editors_pick, is_breaking);

-- 4. Tabel Log Sinkronisasi & Pencatatan Error
CREATE TABLE IF NOT EXISTS public.sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES public.sources(id) ON DELETE SET NULL,
  source_name TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('scheduled_cron', 'manual_admin', 'webhook')),
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'error')),
  fetched_count INT NOT NULL DEFAULT 0,
  inserted_count INT NOT NULL DEFAULT 0,
  duplicate_count INT NOT NULL DEFAULT 0,
  duration_ms INT NOT NULL DEFAULT 0,
  error_message TEXT,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Tabel Pengaturan Website, SEO & Aset Visual Canva
CREATE TABLE IF NOT EXISTS public.site_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  site_name TEXT NOT NULL DEFAULT 'Kanasa News x Kelompok 5',
  tagline TEXT NOT NULL DEFAULT 'RUANG UNTUK MEMAHAMI',
  hero_heading TEXT NOT NULL DEFAULT 'Jurnalisme Kontekstual. Verifikasi Tanpa Kompromi.',
  breaking_enabled BOOLEAN NOT NULL DEFAULT true,
  breaking_label TEXT NOT NULL DEFAULT 'TERKINI',
  breaking_text TEXT NOT NULL DEFAULT 'Presiden Prabowo Resmikan Perluasan Kampus SMA Taruna Nusantara Cimahi · Ekonomi Digital RI Diproyeksikan Tembus US$130 Miliar pada 2026',
  cron_enabled BOOLEAN NOT NULL DEFAULT true,
  cron_interval_minutes INT NOT NULL DEFAULT 15,
  ai_summary_enabled BOOLEAN NOT NULL DEFAULT true,
  dedup_similarity_threshold NUMERIC(3,2) NOT NULL DEFAULT 0.78,
  seo_meta_title TEXT NOT NULL DEFAULT 'Kanasa News — Ruang untuk Memahami | Portal Berita & Analisis Indonesia',
  seo_meta_description TEXT NOT NULL DEFAULT 'Portal berita editorial modern dan agregator terverifikasi yang menyajikan liputan Nasional, Internasional, Politik, Ekonomi, Teknologi, Sains, dan Daerah.',
  canva_logo_url TEXT,
  canva_banner_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.site_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 6. Tabel Penyimpanan Aset Visual (Canva Export / Supabase Storage Metadata)
CREATE TABLE IF NOT EXISTS public.visual_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slot_type TEXT NOT NULL CHECK (slot_type IN ('logo', 'hero_banner', 'category_cover', 'social_card')),
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  canva_design_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Tabel Laporan Koreksi Publik
CREATE TABLE IF NOT EXISTS public.correction_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES public.articles(id) ON DELETE CASCADE,
  article_title TEXT NOT NULL,
  issue_type TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visual_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.correction_reports ENABLE ROW LEVEL SECURITY;

-- Peran Admin: Memeriksa klaim app_metadata.role = 'admin' pada JWT Supabase Auth
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN AS $$
BEGIN
  RETURN coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Kebijakan Baca Publik (Hanya data aktif/terbit)
CREATE POLICY "Publik dapat membaca kategori aktif" ON public.categories FOR SELECT USING (is_active = true OR public.is_admin());
CREATE POLICY "Publik dapat membaca artikel terbit" ON public.articles FOR SELECT USING (status = 'published' OR public.is_admin());
CREATE POLICY "Publik dapat membaca pengaturan situs" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "Publik dapat membaca sumber berita" ON public.sources FOR SELECT USING (true);
CREATE POLICY "Publik dapat membaca log sinkronisasi transparan" ON public.sync_logs FOR SELECT USING (true);
CREATE POLICY "Publik dapat membaca aset visual" ON public.visual_assets FOR SELECT USING (true);
CREATE POLICY "Publik dapat mengirim laporan koreksi" ON public.correction_reports FOR INSERT WITH CHECK (length(description) >= 10);

-- Kebijakan Tulis Khusus Admin Terautentikasi
CREATE POLICY "Admin mengelola kategori" ON public.categories FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin mengelola sumber" ON public.sources FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin mengelola artikel" ON public.articles FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin mengelola log" ON public.sync_logs FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin mengelola pengaturan" ON public.site_settings FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin mengelola aset" ON public.visual_assets FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin mengelola koreksi" ON public.correction_reports FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
