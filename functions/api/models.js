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

export async function onRequestGet({ env }) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    ...corsHeaders()
  };

  try {
    await env.DB.exec(
      "CREATE TABLE IF NOT EXISTS models (id TEXT PRIMARY KEY, name TEXT NOT NULL, author TEXT, created_at TEXT NOT NULL, object_key TEXT NOT NULL, size_bytes INTEGER NOT NULL)"
    );
    const { results } = await env.DB.prepare(
      "SELECT id, name, author, created_at, size_bytes FROM models ORDER BY created_at DESC LIMIT 200"
    ).all();

    const models = (results || []).map((r) => ({
      id: r.id,
      name: r.name,
      author: r.author || "",
      date: (r.created_at || "").slice(0, 10),
      format: "stl",
      url: `/api/download/${r.id}`,
      viewUrl: `/api/download/${r.id}`,
      downloadUrl: `/api/download/${r.id}`,
      sizeBytes: r.size_bytes
    }));

    return new Response(JSON.stringify({ models }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers });
  }
}

