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

export async function onRequestPost({ request, env }) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    ...corsHeaders()
  };

  try {
    const contentType = request.headers.get("Content-Type") || "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      return new Response(JSON.stringify({ error: "请使用表单上传（multipart/form-data）" }), { status: 400, headers });
    }

    const form = await request.formData();
    const file = form.get("file");
    const name = String(form.get("name") || "").trim();
    const author = String(form.get("author") || "").trim();

    if (!name) {
      return new Response(JSON.stringify({ error: "请填写模型名称" }), { status: 400, headers });
    }

    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ error: "请选择 STL 文件" }), { status: 400, headers });
    }

    const maxMb = Math.max(1, Math.min(200, Number(env.MAX_UPLOAD_MB || 50) || 50));
    const maxBytes = maxMb * 1024 * 1024;
    if (file.size > maxBytes) {
      return new Response(JSON.stringify({ error: `文件过大（最大 ${maxMb}MB）` }), { status: 413, headers });
    }

    const filename = (file.name || "").toLowerCase();
    if (!filename.endsWith(".stl")) {
      return new Response(JSON.stringify({ error: "只支持 .stl 文件" }), { status: 400, headers });
    }

    await env.DB.exec(
      "CREATE TABLE IF NOT EXISTS models (id TEXT PRIMARY KEY, name TEXT NOT NULL, author TEXT, created_at TEXT NOT NULL, object_key TEXT NOT NULL, size_bytes INTEGER NOT NULL)"
    );

    const id = crypto.randomUUID();
    const objectKey = `${id}.stl`;
    const createdAt = new Date().toISOString();

    const body = await file.arrayBuffer();
    await env.BUCKET.put(objectKey, body, {
      httpMetadata: {
        contentType: file.type || "model/stl",
        contentDisposition: `attachment; filename="${encodeURIComponent(file.name || objectKey)}"`
      }
    });

    await env.DB.prepare(
      "INSERT INTO models (id, name, author, created_at, object_key, size_bytes) VALUES (?, ?, ?, ?, ?, ?)"
    )
      .bind(id, name, author, createdAt, objectKey, file.size)
      .run();

    const model = {
      id,
      name,
      author,
      date: createdAt.slice(0, 10),
      format: "stl",
      url: `/api/download/${id}`,
      viewUrl: `/api/download/${id}`,
      downloadUrl: `/api/download/${id}`,
      sizeBytes: file.size
    };

    return new Response(JSON.stringify({ model }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers });
  }
}
