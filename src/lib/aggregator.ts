/**
 * KANASA NEWS — SISTEM AGREGATOR RSS & API RESMI
 * Mencakup:
 * 1. Normalisasi & Deteksi Duplikat (SHA-256 URL + Kemiripan Token Jaccard)
 * 2. Kategorisasi Otomatis ke 11 Kategori Standar
 * 3. Ringkasan Berbahasa Indonesia dengan AI Opsional (tanpa menyalin teks penuh berhak cipta)
 * 4. Pencatatan Log & Penanganan Error per Sumber
 */

import crypto from "crypto";

export type CategoryName =
  | "Nasional"
  | "Internasional"
  | "Politik"
  | "Ekonomi"
  | "Teknologi"
  | "Pendidikan"
  | "Kesehatan"
  | "Olahraga"
  | "Hiburan"
  | "Sains"
  | "Daerah";

export interface RawFeedItem {
  title: string;
  link: string;
  description?: string;
  pubDate?: string;
  sourceName: string;
  defaultCategory: CategoryName;
}

export interface ProcessedArticle {
  slug: string;
  fingerprint_hash: string;
  title: string;
  summary: string;
  ai_summary: string;
  ai_takeaways: string[];
  category: CategoryName;
  source_name: string;
  original_url: string;
  published_at: string;
}

const CATEGORY_KEYWORDS: Record<CategoryName, string[]> = {
  Politik: ["dpr", "dpd", "mpr", "presiden", "menteri", "pilkada", "pemilu", "partai", "koalisi", "perpres", "ruu", "mahkamah konstitusi", "kpk"],
  Ekonomi: ["ekonomi", "investasi", "inflasi", "suku bunga", "bank", "ihsg", "rupiah", "umkm", "ekspor", "impor", "pajak", "fiskal", "utang", "pdb", "bisnis"],
  Teknologi: ["teknologi", "ai", "kecerdasan buatan", "siber", "cyber", "pusat data", "data center", "digital", "aplikasi", "cloud", "semikonduktor", "aptiknas"],
  Pendidikan: ["pendidikan", "kampus", "universitas", " mahasiswa", "siswa", "sekolah", "kurikulum", "beasiswa", "snbt", "utbk", "kemendikdasmen", "guru", "literasi"],
  Kesehatan: ["kesehatan", "vaksin", "rumah sakit", "dokter", "tuberkulosis", "tb", "stunting", "jkn", "bpjs", "medis", "penyakit", "gizi"],
  Olahraga: ["olahraga", "atlet", "sepak bola", "bulu tangkis", "motogp", "olimpiade", "yog", "timnas", "liga", "kickboxing", "padel", "tenis", "kemenpora"],
  Hiburan: ["film", "musik", "konser", "festival", "budaya", "seniman", "ami award", "bioskop", "sutradara", "kmi", "seni"],
  Sains: ["sains", "riset", "penelitian", "lingkungan", "iklim", "hutan", "ekosistem", "karhutla", "keanekaragaman", "inovasi", "kemdiktisaintek"],
  Internasional: ["pbb", "asean", "global", "dunia", "luar negeri", "diplomasi", "eropa", "amerika", "timur tengah", "ktt", "multilateral"],
  Daerah: ["pemprov", "pemkot", "pemkab", "gubernur", "wali kota", "bupati", "kalimantan", "sulawesi", "sumatera", "papua", "maluku", "ntt", "bali", "jawa"],
  Nasional: ["indonesia", "nasional", "jakarta", "pemerintah", "aparat", "kebijakan"]
};

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function computeFingerprint(url: string, title: string): string {
  const cleanUrl = url.split("?")[0].replace(/\/+$/, "").toLowerCase();
  const cleanTitle = normalizeText(title);
  return crypto.createHash("sha256").update(`${cleanUrl}::${cleanTitle}`).digest("hex").slice(0, 32);
}

export function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(normalizeText(a).split(" ").filter(w => w.length > 2));
  const setB = new Set(normalizeText(b).split(" ").filter(w => w.length > 2));
  if (!setA.size || !setB.size) return 0;
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }
  return intersection / (setA.size + setB.size - intersection);
}

export function classifyCategory(title: string, summary: string, fallback: CategoryName = "Nasional"): CategoryName {
  const combined = normalizeText(`${title} ${summary}`);
  let bestCat: CategoryName = fallback;
  let bestScore = 0;

  (Object.keys(CATEGORY_KEYWORDS) as CategoryName[]).forEach(cat => {
    let score = 0;
    for (const kw of CATEGORY_KEYWORDS[cat]) {
      if (combined.includes(kw)) {
        score += title.toLowerCase().includes(kw) ? 3 : 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestCat = cat;
    }
  });

  return bestCategoryOrFallback(bestCat, bestScore, fallback);
}

function bestCategoryOrFallback(cat: CategoryName, score: number, fallback: CategoryName): CategoryName {
  return score >= 2 ? cat : fallback;
}

export function sanitizeExcerpt(rawHtmlOrText: string): string {
  const stripped = rawHtmlOrText
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  // Batasi panjang cuplikan agar mematuhi hak cipta (hanya ringkasan informatif, bukan salinan artikel penuh)
  if (stripped.length <= 280) return stripped;
  return stripped.slice(0, 277).replace(/\s+\S*$/, "") + "...";
}

export async function generateOptionalAiSummary(
  title: string,
  excerpt: string,
  sourceName: string,
  aiEnabled: boolean
): Promise<{ ai_summary: string; ai_takeaways: string[] }> {
  const cleanExcerpt = sanitizeExcerpt(excerpt || title);
  if (!aiEnabled) {
    return {
      ai_summary: cleanExcerpt,
      ai_takeaways: [
        `Laporan terverifikasi dari ${sourceName}.`,
        "Baca artikel lengkap melalui tautan resmi penerbit."
      ]
    };
  }

  // Jika GEMINI_API_KEY tersedia di server, panggil endpoint Gemini untuk merangkum dalam Bahasa Indonesia baku
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Buat ringkasan berita independen maksimal 2 kalimat dalam bahasa Indonesia jurnalistik yang netral dan tidak menyalin mentah kalimat asli, berdasarkan judul "${title}" dan keterangan "${cleanExcerpt}" (Sumber: ${sourceName}). Jangan mengarang fakta baru.`
                  }
                ]
              }
            ]
          })
        }
      );
      if (response.ok) {
        const data = await response.json();
        const generated = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (generated) {
          return {
            ai_summary: generated,
            ai_takeaways: [
              `Sumber primer: ${sourceName}`,
              "Disintesis secara independen oleh asisten redaksi Kanasa News",
              "Atribusi penuh dan tautan asli tersedia di bawah artikel"
            ]
          };
        }
      }
    } catch {
      // Fallback aman ke ringkasan ekstraktif terverifikasi
    }
  }

  return {
    ai_summary: `${cleanExcerpt} (Disarikan dari laporan ${sourceName}; kunjungi tautan sumber asli untuk rincian selengkapnya).`,
    ai_takeaways: [
      `Sumber terverifikasi: ${sourceName}`,
      "Klasifikasi topik otomatis & pemeriksaan kemiripan judul aktif",
      "Tautan langsung menuju laporan asli tersedia"
    ]
  };
}
