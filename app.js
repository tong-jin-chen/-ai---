const CDN_CANDIDATES = [
  {
    name: "jsdelivr",
    three: "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
    orbit: "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js",
    stl: "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/STLLoader.js"
  },
  {
    name: "unpkg",
    three: "https://unpkg.com/three@0.160.0/build/three.module.js",
    orbit: "https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js",
    stl: "https://unpkg.com/three@0.160.0/examples/jsm/loaders/STLLoader.js"
  }
];

const $ = (id) => document.getElementById(id);

const listEl = $("list");
const qEl = $("q");
const fileEl = $("file");
const nameEl = $("modelName");
const metaEl = $("modelMeta");
const downloadEl = $("download");
const repoLinkEl = $("repoLink");
const submitLinkEl = $("submitLink");
const hintEl = $("hint");

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

async function loadThreeTooling() {
  let lastError = null;
  for (const c of CDN_CANDIDATES) {
    try {
      const threeMod = await import(c.three);
      const orbitMod = await import(c.orbit);
      const stlMod = await import(c.stl);
      return {
        cdnName: c.name,
        THREE: threeMod,
        OrbitControls: orbitMod.OrbitControls,
        STLLoader: stlMod.STLLoader
      };
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError || new Error("无法加载 three.js 依赖");
}

setHint("正在加载 3D 预览引擎…");

let THREE = null;
let OrbitControls = null;
let STLLoader = null;
let renderer = null;
let scene = null;
let camera = null;
let controls = null;
let threeReady = false;

try {
  const tooling = await loadThreeTooling();
  THREE = tooling.THREE;
  OrbitControls = tooling.OrbitControls;
  STLLoader = tooling.STLLoader;

  renderer = new THREE.WebGLRenderer({ canvas: $("c"), antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0b0f14, 8, 35);

  camera = new THREE.PerspectiveCamera(45, 1, 0.01, 200);
  camera.position.set(6, 4, 8);

  controls = new OrbitControls(camera, renderer.domElement);
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
  setFatalHint(`3D 预览依赖加载失败：${String(e?.message || e)}。请换网络或使用能访问 jsdelivr/unpkg 的网络环境。`);
}

let currentMesh = null;

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
    repoUrl.includes("-ai---") ||
    submitUrl.includes("-ai---") ||
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
    nameEl.textContent = "选择一个模型或上传 STL 文件";
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
  const loader = new STLLoader();
  clearMesh();

  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (geometry) => {
        geometry.computeVertexNormals();
        const material = new THREE.MeshStandardMaterial({
          color: 0xd9f3f3,
          metalness: 0.05,
          roughness: 0.65
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;
        currentMesh = mesh;
        scene.add(mesh);
        frameObject(mesh);
        resolve();
      },
      undefined,
      (err) => reject(err)
    );
  });
}

async function loadStlFromFile(file) {
  if (!threeReady || !scene) throw new Error("3D 预览引擎未就绪");
  const loader = new STLLoader();
  clearMesh();

  const buffer = await readFileAsArrayBuffer(file);
  let geometry;
  try {
    geometry = loader.parse(buffer);
  } catch (e) {
    const text = new TextDecoder("utf-8").decode(new Uint8Array(buffer));
    geometry = loader.parse(text);
  }
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({
    color: 0xd9f3f3,
    metalness: 0.05,
    roughness: 0.65
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  currentMesh = mesh;
  scene.add(mesh);
  frameObject(mesh);
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
        if (!threeReady) throw new Error("3D 预览引擎未就绪（依赖加载失败）");
        await loadStlFromUrl(m.url);
      } catch (e) {
        clearMesh();
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
        .filter((m) => m.url && m.format === "stl")
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
  setSelectedMeta({
    name: file.name,
    author: "本地文件",
    date: "",
    url: "",
    format: "stl"
  });
  try {
    if (!threeReady) throw new Error("3D 预览引擎未就绪（依赖加载失败）");
    nameEl.textContent = "正在加载本地模型…";
    metaEl.textContent = `大小：${Math.round((file.size / 1024 / 1024) * 10) / 10}MB`;
    setDownload("", false);
    await loadStlFromFile(file);
    nameEl.textContent = file.name;
    metaEl.textContent = "来源：本地文件";
    setDownload("", false);
  } catch (err) {
    clearMesh();
    nameEl.textContent = "加载失败";
    metaEl.textContent = String(err?.message || err);
    setDownload("", false);
  }
});

window.addEventListener("resize", resize);

await bootstrap();
resize();
if (threeReady) tick();
