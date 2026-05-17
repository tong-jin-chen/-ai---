function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function onRequestGet({ params, env }) {
  const id = String(params?.id || "").trim();
  if (!id) {
    return new Response("Not Found", { status: 404, headers: corsHeaders() });
  }

  try {
    await env.DB.exec(
      "CREATE TABLE IF NOT EXISTS models (id TEXT PRIMARY KEY, name TEXT NOT NULL, author TEXT, created_at TEXT NOT NULL, object_key TEXT NOT NULL, size_bytes INTEGER NOT NULL)"
    );
    const row = await env.DB.prepare("SELECT id, name, object_key FROM models WHERE id = ?").bind(id).first();
    if (!row) {
      return new Response("Not Found", { status: 404, headers: corsHeaders() });
    }

    const obj = await env.BUCKET.get(row.object_key);
    if (!obj) {
      return new Response("Not Found", { status: 404, headers: corsHeaders() });
    }

    const headers = new Headers(corsHeaders());
    headers.set("Content-Type", obj.httpMetadata?.contentType || "model/stl");
    const safeName = String(row.name || id).replace(/["\\\r\n]/g, "_");
    headers.set("Content-Disposition", `attachment; filename="${encodeURIComponent(safeName)}.stl"`);
    obj.writeHttpMetadata(headers);
    headers.set("Cache-Control", "public, max-age=31536000, immutable");

    return new Response(obj.body, { status: 200, headers });
  } catch (e) {
    return new Response(String(e?.message || e), { status: 500, headers: corsHeaders() });
  }
}

