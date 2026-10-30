import { NextRequest, NextResponse } from "next/server";
import { classifyCategory, computeFingerprint, generateOptionalAiSummary, sanitizeExcerpt } from "@/lib/aggregator";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: "Akses ditolak: Token otorisasi CRON_SECRET atau sesi Admin diperlukan." },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const sampleTitle = body.title || "Ekonomi Digital Indonesia Diproyeksikan Tembus US$130 Miliar pada 2026";
  const sampleUrl = body.url || "https://megapolitan.antaranews.com/berita/558603/ekonomi-digital-indonesia-diproyeksikan-tembus-130-miliar-dolar-as-pada-2026";
  const sampleExcerpt = sanitizeExcerpt(body.excerpt || sampleTitle);
  const category = classifyCategory(sampleTitle, sampleExcerpt, "Ekonomi");
  const fingerprint = computeFingerprint(sampleUrl, sampleTitle);
  const aiResult = await generateOptionalAiSummary(
    sampleTitle,
    sampleExcerpt,
    body.source || "ANTARA News",
    process.env.AI_SUMMARY_ENABLED === "true"
  );

  return NextResponse.json({
    ok: true,
    synced_at: new Date().toISOString(),
    sample_processed: {
      title: sampleTitle,
      category,
      fingerprint,
      ...aiResult
    }
  });
}
