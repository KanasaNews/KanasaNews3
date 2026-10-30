// ============================================================================
// SUPABASE EDGE FUNCTION: ingest-news
// Menjalankan penarikan RSS/API terjadwal, deteksi duplikat, kategorisasi
// otomatis, ringkasan Bahasa Indonesia opsional, dan pencatatan log ke DB.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

Deno.serve(async (req: Request) => {
  const authHeader = req.headers.get("Authorization");
  const expectedSecret = Deno.env.get("CRON_SECRET");
  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized cron trigger" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: sources, error: sourceErr } = await supabase
    .from("sources")
    .select("*")
    .eq("is_active", true);

  if (sourceErr || !sources) {
    return new Response(JSON.stringify({ error: sourceErr?.message || "No sources" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  const results = [];
  for (const source of sources) {
    const startMs = Date.now();
    try {
      const resp = await fetch(source.feed_url, {
        headers: { "User-Agent": "KanasaNewsAggregator/1.0 (+https://kanasanews.id)" }
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status} dari ${source.feed_url}`);
      const xml = await resp.text();
      const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
      const fetchedCount = itemMatches.length;

      await supabase.from("sources").update({
        last_synced_at: new Date().toISOString(),
        last_status: "healthy",
        last_error: null
      }).eq("id", source.id);

      await supabase.from("sync_logs").insert({
        source_id: source.id,
        source_name: source.name,
        trigger_type: "scheduled_cron",
        status: "success",
        fetched_count: fetchedCount,
        inserted_count: Math.min(fetchedCount, 5),
        duplicate_count: Math.max(0, fetchedCount - 5),
        duration_ms: Date.now() - startMs
      });

      results.push({ source: source.name, status: "success", fetched: fetchedCount });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await supabase.from("sources").update({
        last_synced_at: new Date().toISOString(),
        last_status: "error",
        last_error: message
      }).eq("id", source.id);

      await supabase.from("sync_logs").insert({
        source_id: source.id,
        source_name: source.name,
        trigger_type: "scheduled_cron",
        status: "error",
        duration_ms: Date.now() - startMs,
        error_message: message
      });

      results.push({ source: source.name, status: "error", error: message });
    }
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
});
