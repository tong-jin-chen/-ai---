;(async function () {
const $ = (id) => document.getElementById(id);

const THREE_CDN_SETS = [
  {
    name: "jsdelivr",
    three: "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"
  },
  {
    name: "unpkg",
    three: "https://unpkg.com/three@0.160.0/build/three.min.js"
  },
  {
    name: "cdnjs",
    three: "https://cdnjs.cloudflare.com/ajax/libs/three.js/r160/three.min.js"
  }
];

const MODEL_VIEWER_CDN_SETS = [
  {
    name: "jsdelivr",
    module: "https://cdn.jsdelivr.net/npm/@google/model-viewer@3.5.0/dist/model-viewer.min.js"
  },
  {
    name: "unpkg",
    module: "https://unpkg.com/@google/model-viewer@3.5.0/dist/model-viewer.min.js"
  }
];

function loadScript(url) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = url;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`脚本加载失败：${url}`));
    document.head.appendChild(s);
  });
}

function loadModuleScript(url) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.type = "module";
    s.src = url;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`模块脚本加载失败：${url}`));
    document.head.appendChild(s);
  });
}

async function ensureThree() {
  if (globalThis.THREE) return;
  const errors = [];
  for (const set of THREE_CDN_SETS) {
    try {
      await loadScript(set.three);
      if (globalThis.THREE) return;
    } catch (e) {
      errors.push(`[${set.name}] ${String(e?.message || e)}`);
    }
  }
  throw new Error(`three.js 未加载。\n${errors.join("\n")}`);
}

async function ensureModelViewer() {
  const mv = $("mv");
  if (!mv) throw new Error("页面缺少 <model-viewer> 容器");
  if (customElements.get("model-viewer")) return;

  const errors = [];
  for (const set of MODEL_VIEWER_CDN_SETS) {
    try {
      await loadModuleScript(set.module);
      if (customElements.get("model-viewer")) return;
    } catch (e) {
      errors.push(`[${set.name}] ${String(e?.message || e)}`);
    }
  }
  throw new Error(`model-viewer 未加载。\n${errors.join("\n")}`);
}



const listEl = $("list");
const qEl = $("q");
const fileEl = $("file");
const nameEl = $("modelName");
const nameEl = $("modelName");
const metaEl = $("modelMeta");
const downloadEl = $("download");
const repoLinkEl = $("repoLink");
const submitLinkEl = $("submitLink");
const hintEl = $("hint");
const modelViewerEl = $("mv");
const canvasEl = $("c");

const state = {
  models: [],
  activeId: null
};

function setHint(text) {
  if (!hintEl) return;
  hintEl.textContent = text || "";
}

function setFatalHint(text) {
  setHint(text);
  if (hintEl) {
    hintEl.style.borderColor = "rgba(255, 138, 138, 0.55)";
    hintEl.style.background = "rgba(255, 138, 138, 0.12)";
    hintEl.style.color = "rgba(255, 220, 220, 0.95)";
  }
}

function createSimpleOrbitControls(THREE, camera, domElement) {
  const target = new THREE.Vector3(0, 0, 0);

  let enabled = true;
  let enableDamping = true;
  let dampingFactor = 0.08;
  let rotateSpeed = 1.0;
  let zoomSpeed = 1.0;
  let panSpeed = 1.0;

  const spherical = new THREE.Spherical();
  const sphericalDelta = new THREE.Spherical(0, 0, 0);
  const panOffset = new THREE.Vector3();

  const pointerStart = new THREE.Vector2();
  const pointerNow = new THREE.Vector2();
  let isRotating = false;
  let isPanning = false;

  function updateSphericalFromCamera() {
    const offset = camera.position.clone().sub(target);
    spherical.setFromVector3(offset);
  }

  function rotateLeft(angle) {
    sphericalDelta.theta -= angle;
  }

  function rotateUp(angle) {
    sphericalDelta.phi -= angle;
  }

  function pan(deltaX, deltaY) {
    const element = domElement;
    if (!element) return;

    const offset = camera.position.clone().sub(target);
    const targetDistance = offset.length() * Math.tan((camera.fov / 2) * Math.PI / 180);

    const panX = (2 * deltaX * targetDistance / element.clientHeight) * panSpeed;
    const panY = (2 * deltaY * targetDistance / element.clientHeight) * panSpeed;

    const te = camera.matrix.elements;
    const xAxis = new THREE.Vector3(te[0], te[1], te[2]);
    const yAxis = new THREE.Vector3(te[4], te[5], te[6]);

    panOffset.addScaledVector(xAxis, -panX);
    panOffset.addScaledVector(yAxis, panY);
  }

  function dolly(scale) {
    spherical.radius = Math.max(0.01, spherical.radius * scale);
  }

  function onPointerDown(e) {
    if (!enabled) return;
    if (!domElement) return;

    domElement.setPointerCapture(e.pointerId);
    pointerStart.set(e.clientX, e.clientY);
    isRotating = e.button === 0;
    isPanning = e.button === 2;
  }

  function onPointerMove(e) {
    if (!enabled) return;
    if (!isRotating && !isPanning) return;

    pointerNow.set(e.clientX, e.clientY);
    const dx = pointerNow.x - pointerStart.x;
    const dy = pointerNow.y - pointerStart.y;
    pointerStart.copy(pointerNow);

    if (isRotating) {
      const element = domElement;
      const rotX = (2 * Math.PI * dx / Math.max(1, element.clientWidth)) * rotateSpeed;
      const rotY = (2 * Math.PI * dy / Math.max(1, element.clientHeight)) * rotateSpeed;
      rotateLeft(rotX);
      rotateUp(rotY);
    } else if (isPanning) {
      pan(dx, dy);
    }
  }

  function onPointerUp(e) {
    if (!enabled) return;
    isRotating = false;
    isPanning = false;
    try {
      domElement.releasePointerCapture(e.pointerId);
    } catch {}
  }

  function onWheel(e) {
    if (!enabled) return;
    e.preventDefault();
    const delta = e.deltaY;
    const scale = delta > 0 ? (1 + 0.1 * zoomSpeed) : (1 / (1 + 0.1 * zoomSpeed));
    dolly(scale);
  }

  domElement.addEventListener("contextmenu", (e) => e.preventDefault());
  domElement.addEventListener("pointerdown", onPointerDown);
  domElement.addEventListener("pointermove", onPointerMove);
  domElement.addEventListener("pointerup", onPointerUp);
  domElement.addEventListener("pointercancel", onPointerUp);
  domElement.addEventListener("wheel", onWheel, { passive: false });

  updateSphericalFromCamera();

  function update() {
    updateSphericalFromCamera();

    spherical.theta += sphericalDelta.theta;
    spherical.phi += sphericalDelta.phi;
    spherical.phi = Math.max(0.01, Math.min(Math.PI - 0.01, spherical.phi));

    target.add(panOffset);

    const offset = new THREE.Vector3().setFromSpherical(spherical);
    camera.position.copy(target).add(offset);
    camera.lookAt(target);
    camera.updateMatrix();
    camera.updateMatrixWorld();

    if (enableDamping) {
      sphericalDelta.theta *= (1 - dampingFactor);
      sphericalDelta.phi *= (1 - dampingFactor);
      panOffset.multiplyScalar(1 - dampingFactor);
    } else {
      sphericalDelta.theta = 0;
      sphericalDelta.phi = 0;
      panOffset.set(0, 0, 0);
    }
  }

  return {
    get enabled() { return enabled; },
    set enabled(v) { enabled = Boolean(v); },
    get target() { return target; },
    set target(v) { target.copy(v); },
    get enableDamping() { return enableDamping; },
    set enableDamping(v) { enableDamping = Boolean(v); },
    get dampingFactor() { return dampingFactor; },
    set dampingFactor(v) { dampingFactor = Number(v) || 0; },
    update,
    dispose() {
      domElement.removeEventListener("pointerdown", onPointerDown);
      domElement.removeEventListener("pointermove", onPointerMove);
      domElement.removeEventListener("pointerup", onPointerUp);
      domElement.removeEventListener("pointercancel", onPointerUp);
      domElement.removeEventListener("wheel", onWheel);
    }
  };
}
let renderer = null;
let scene = null;
let camera = null;
let controls = null;
let threeReady = false;
let currentObjectUrl = null;

try {
  setHint("正在加载 3D 预览引擎…");
  await ensureThree();
  const THREE = globalThis.THREE;

  renderer = new THREE.WebGLRenderer({ canvas: $("c"), antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0b0f14, 8, 35);

  camera = new THREE.PerspectiveCamera(45, 1, 0.01, 200);
  camera.position.set(6, 4, 8);

  controls = createSimpleOrbitControls(THREE, camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.65));
  const dir = new THREE.DirectionalLight(0xffffff, 1.1);
  dir.position.set(6, 10, 6);
  scene.add(dir);

  const grid = new THREE.GridHelper(12, 12, 0x2a3542, 0x1f2832);
  grid.material.opacity = 0.25;
  grid.material.transparent = true;
  scene.add(grid);

  threeReady = true;
  setHint("拖动旋转，滚轮缩放，右键平移");
} catch (e) {
  setFatalHint(`3D 预览初始化失败：${String(e?.message || e)}。`);
}

let currentMesh = null;

function showCanvasViewer() {
  if (modelViewerEl) modelViewerEl.style.display = "none";
  if (canvasEl) canvasEl.style.display = "block";
}

function showModelViewer() {
  if (canvasEl) canvasEl.style.display = "none";
  if (modelViewerEl) modelViewerEl.style.display = "block";
}

function clearModelViewer() {
  if (!modelViewerEl) return;
  if (currentObjectUrl) {
    try { URL.revokeObjectURL(currentObjectUrl); } catch {}
    currentObjectUrl = null;
  }
  modelViewerEl.removeAttribute("src");
  modelViewerEl.removeAttribute("poster");
}

function inferGithubRepoUrls() {
  const host = String(window.location.hostname || "");
  if (!host.endsWith("github.io")) return null;
  const user = host.split(".")[0];
  const parts = String(window.location.pathname || "").split("/").filter(Boolean);
  if (parts.length === 0) return null;
  const repo = parts[0];
  return {
    repoUrl: `https://github.com/${encodeURIComponent(user)}/${encodeURIComponent(repo)}`,
    submitUrl: `https://github.com/${encodeURIComponent(user)}/${encodeURIComponent(repo)}/issues/new?title=%E6%A8%A1%E5%9E%8B%E6%8F%90%E4%BA%A4%EF%BC%9A%3C%E8%AF%B7%E5%A1%AB%E6%A8%A1%E5%9E%8B%E5%90%8D%E7%A7%B0%3E&body=%E8%AF%B7%E6%8C%89%E4%B8%8B%E9%9D%A2%E6%A8%A1%E6%9D%BF%E5%A1%AB%E5%86%99%EF%BC%8C%E5%B9%B6%E6%8A%8A%20STL%20%E6%96%87%E4%BB%B6%E6%8B%96%E6%8B%BD%E5%88%B0%E8%AF%A5%20Issue%20%E4%B8%AD%E4%B8%8A%E4%BC%A0%E3%80%82%0A%0A-%20%E6%A8%A1%E5%9E%8B%E5%90%8D%E7%A7%B0%EF%BC%9A%0A-%20%E4%BD%9C%E8%80%85%E6%98%B5%E7%A7%B0%EF%BC%9A%0A-%20%E6%A8%A1%E5%9E%8B%E6%8F%8F%E8%BF%B0%EF%BC%9A%0A`
  };
}

function setHeaderLinks(data) {
  let repoUrl = data?.repoUrl;
  let submitUrl = data?.submitUrl;

  const isPlaceholder =
    !repoUrl ||
    !submitUrl ||
    repoUrl.includes("yourname/yourrepo") ||
    submitUrl.includes("yourname/yourrepo") ||
    repoUrl === "#" ||
    submitUrl === "#";

  if (isPlaceholder) {
    const inferred = inferGithubRepoUrls();
    if (inferred) {
      repoUrl = inferred.repoUrl;
      submitUrl = inferred.submitUrl;
    }
  }

  if (repoUrl && repoUrl !== "#") {
    repoLinkEl.href = repoUrl;
    repoLinkEl.removeAttribute("aria-disabled");
  } else {
    repoLinkEl.href = "#";
    repoLinkEl.setAttribute("aria-disabled", "true");
  }

  if (submitUrl && submitUrl !== "#") {
    submitLinkEl.href = submitUrl;
    submitLinkEl.removeAttribute("aria-disabled");
  } else {
    submitLinkEl.href = "#";
    submitLinkEl.setAttribute("aria-disabled", "true");
  }
}

function setDownload(url, enabled) {
  if (!enabled) {
    downloadEl.href = "#";
    downloadEl.setAttribute("aria-disabled", "true");
    return;
  }
  downloadEl.href = url;
  downloadEl.removeAttribute("aria-disabled");
}

function setSelectedMeta(model) {
  if (!model) {
    nameEl.textContent = "选择一个模型或上传模型文件";
    metaEl.textContent = "";
    setDownload("", false);
    return;
  }
  nameEl.textContent = model.name || "未命名模型";
  const parts = [];
  if (model.author) parts.push(`作者：${model.author}`);
  if (model.date) parts.push(`日期：${model.date}`);
  if (model.format) parts.push(`格式：${String(model.format).toUpperCase()}`);
  metaEl.textContent = parts.join(" · ");
  setDownload(model.url, true);
}

function clearMesh() {
  if (!threeReady || !scene) return;
  if (!currentMesh) return;
  scene.remove(currentMesh);
  currentMesh.geometry.dispose();
  if (currentMesh.material && currentMesh.material.dispose) currentMesh.material.dispose();
  currentMesh = null;
}

function clearAllViewers() {
  clearModelViewer();
  if (threeReady) clearMesh();
}

function frameObject(obj) {
  if (!threeReady || !controls || !camera) return;
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  obj.position.x += (obj.position.x - center.x);
  obj.position.y += (obj.position.y - center.y);
  obj.position.z += (obj.position.z - center.z);

  const maxDim = Math.max(size.x, size.y, size.z);
  const dist = maxDim * 1.4;

  camera.position.set(dist, dist * 0.7, dist);
  controls.target.set(0, 0, 0);
  controls.update();
}

async function loadStlFromUrl(url) {
  if (!threeReady || !scene) throw new Error("3D 预览引擎未就绪");
  clearAllViewers();
  showCanvasViewer();

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`下载模型失败：${res.status} ${res.statusText}`);
  }
  const buffer = await res.arrayBuffer();
  const geometry = parseStlToGeometry(globalThis.THREE, buffer);
  const mesh = createMeshFromGeometry(globalThis.THREE, geometry);
  currentMesh = mesh;
  scene.add(mesh);
  frameObject(mesh);
}

async function loadStlFromFile(file) {
  if (!threeReady || !scene) throw new Error("3D 预览引擎未就绪");
  clearAllViewers();
  showCanvasViewer();

  const buffer = await readFileAsArrayBuffer(file);
  const geometry = parseStlToGeometry(globalThis.THREE, buffer);
  const mesh = createMeshFromGeometry(globalThis.THREE, geometry);
  currentMesh = mesh;
  scene.add(mesh);
  frameObject(mesh);
}

async function loadGlbFromUrl(url) {
  clearAllViewers();
  await ensureModelViewer();
  showModelViewer();
  modelViewerEl.src = url;
  modelViewerEl.setAttribute("camera-controls", "");
  modelViewerEl.setAttribute("interaction-prompt", "none");
  setHint("拖动旋转，滚轮缩放，双指缩放");
}

async function loadGlbFromFile(file) {
  clearAllViewers();
  await ensureModelViewer();
  showModelViewer();
  currentObjectUrl = URL.createObjectURL(file);
  modelViewerEl.src = currentObjectUrl;
  modelViewerEl.setAttribute("camera-controls", "");
  modelViewerEl.setAttribute("interaction-prompt", "none");
  setHint("拖动旋转，滚轮缩放，双指缩放");
}

function readFileAsArrayBuffer(file) {
  if (typeof file.arrayBuffer === "function") {
    return file.arrayBuffer();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("读取文件失败"));
    reader.onload = () => resolve(reader.result);
    reader.readAsArrayBuffer(file);
  });
}

function createMeshFromGeometry(THREE, geometry) {
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({
    color: 0xd9f3f3,
    metalness: 0.05,
    roughness: 0.65
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

function parseStlToGeometry(THREE, buffer) {
  const byteLength = buffer.byteLength || 0;
  if (byteLength < 84) {
    const text = new TextDecoder("utf-8").decode(new Uint8Array(buffer));
    return parseAsciiStlToGeometry(THREE, text);
  }

  const dv = new DataView(buffer);
  const triCount = dv.getUint32(80, true);
  const expected = 84 + triCount * 50;
  const isBinary = expected === byteLength;

  if (isBinary) return parseBinaryStlToGeometry(THREE, dv, triCount);

  const text = new TextDecoder("utf-8").decode(new Uint8Array(buffer));
  return parseAsciiStlToGeometry(THREE, text);
}

function parseBinaryStlToGeometry(THREE, dv, triCount) {
  const positions = new Float32Array(triCount * 9);
  let offset = 84;
  let pi = 0;

  for (let i = 0; i < triCount; i++) {
    offset += 12;
    for (let v = 0; v < 3; v++) {
      const x = dv.getFloat32(offset, true); offset += 4;
      const y = dv.getFloat32(offset, true); offset += 4;
      const z = dv.getFloat32(offset, true); offset += 4;
      positions[pi++] = x;
      positions[pi++] = y;
      positions[pi++] = z;
    }
    offset += 2;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return geometry;
}

function parseAsciiStlToGeometry(THREE, text) {
  const vertexRe = /vertex\s+([+\-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+\-]?\d+)?)\s+([+\-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+\-]?\d+)?)\s+([+\-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+\-]?\d+)?)/g;
  const verts = [];
  let m;
  while ((m = vertexRe.exec(text)) !== null) {
    verts.push(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]));
  }
  if (verts.length < 9) {
    throw new Error("STL 解析失败：未找到有效顶点数据");
  }
  const positions = new Float32Array(verts);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return geometry;
}

function inferFormat(model) {
  const fmt = String(model?.format || "").toLowerCase().trim();
  if (fmt) return fmt;
  const url = String(model?.url || "");
  const m = url.toLowerCase().match(/\.([a-z0-9]+)(?:\?|#|$)/);
  return m ? m[1] : "";
}

function renderList() {
  const q = (qEl.value || "").trim().toLowerCase();
  const filtered = state.models.filter((m) => {
    const hay = `${m.name || ""} ${m.author || ""}`.toLowerCase();
    return q ? hay.includes(q) : true;
  });

  listEl.innerHTML = "";

  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "item";
    empty.style.cursor = "default";
    empty.innerHTML = `<div class="item-name">暂无模型</div><div class="item-meta">你可以本地上传 STL 预览；要发布到社区请点右上角“提交模型”</div>`;
    listEl.appendChild(empty);
    return;
  }

  for (const m of filtered) {
    const id = m.id || m.url || m.name;
    const item = document.createElement("div");
    item.className = "item" + (state.activeId === id ? " active" : "");
    const meta = [];
    if (m.author) meta.push(`作者：${m.author}`);
    if (m.date) meta.push(`日期：${m.date}`);
    meta.push(`格式：${String(m.format || "stl").toUpperCase()}`);
    item.innerHTML = `<div class="item-name"></div><div class="item-meta"></div>`;
    item.querySelector(".item-name").textContent = m.name || "未命名模型";
    item.querySelector(".item-meta").textContent = meta.join(" · ");
    item.addEventListener("click", async () => {
      state.activeId = id;
      renderList();
      setSelectedMeta(m);
      try {
        const fmt = inferFormat(m);
        if (fmt === "glb" || fmt === "gltf") {
          await loadGlbFromUrl(m.url);
        } else {
          if (!threeReady) throw new Error("3D 预览引擎未就绪（依赖加载失败）");
          await loadStlFromUrl(m.url);
        }
      } catch (e) {
        clearAllViewers();
        nameEl.textContent = "加载失败";
        metaEl.textContent = String(e?.message || e);
        setDownload("", false);
      }
    });
    listEl.appendChild(item);
  }
}

async function bootstrap() {
  const res = await fetch("./models.json", { cache: "no-store" });
  const data = await res.json();

  setHeaderLinks(data);

  state.models = Array.isArray(data.models)
    ? data.models
        .map((m, idx) => ({
          id: m.id || `m_${idx}`,
          name: m.name,
          author: m.author,
          date: m.date,
          url: m.url,
          format: (m.format || "stl").toLowerCase()
        }))
        .filter((m) => m.url && ["stl", "glb", "gltf"].includes(m.format))
    : [];

  setSelectedMeta(null);
  renderList();
}

function resize() {
  if (!threeReady || !renderer || !camera) return;
  const rect = renderer.domElement.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width));
  const h = Math.max(1, Math.floor(rect.height));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function tick() {
  if (!threeReady || !renderer || !camera || !controls) return;
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

qEl.addEventListener("input", renderList);
fileEl.addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  e.target.value = "";
  state.activeId = null;
  renderList();
  const lower = String(file.name || "").toLowerCase();
  const ext = (lower.match(/\.([a-z0-9]+)$/) || [])[1] || "";
  setSelectedMeta({
    name: file.name,
    author: "本地文件",
    date: "",
    url: "",
    format: ext || "file"
  });
  try {
    nameEl.textContent = "正在加载本地模型…";
    metaEl.textContent = `大小：${Math.round((file.size / 1024 / 1024) * 10) / 10}MB`;
    setDownload("", false);
    if (ext === "glb" || ext === "gltf") {
      await loadGlbFromFile(file);
      nameEl.textContent = file.name;
      metaEl.textContent = "来源：本地文件";
      setDownload("", false);
      return;
    }
    if (!threeReady) throw new Error("3D 预览引擎未就绪（依赖加载失败）");
    await loadStlFromFile(file);
    nameEl.textContent = file.name;
    metaEl.textContent = "来源：本地文件";
    setDownload("", false);
  } catch (err) {
    clearAllViewers();
    nameEl.textContent = "加载失败";
    metaEl.textContent = String(err?.message || err);
    setDownload("", false);
  }
});

window.addEventListener("resize", resize);

await bootstrap();
resize();
if (threeReady) tick();
})();
