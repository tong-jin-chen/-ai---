import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js";
import { STLLoader } from "https://unpkg.com/three@0.160.0/examples/jsm/loaders/STLLoader.js";

const $ = (id) => document.getElementById(id);

const listEl = $("list");
const qEl = $("q");
const fileEl = $("file");
const nameEl = $("modelName");
const metaEl = $("modelMeta");
const downloadEl = $("download");
const repoLinkEl = $("repoLink");
const submitLinkEl = $("submitLink");

const state = {
  models: [],
  activeId: null
};

const renderer = new THREE.WebGLRenderer({ canvas: $("c"), antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0b0f14, 8, 35);

const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 200);
camera.position.set(6, 4, 8);

const controls = new OrbitControls(camera, renderer.domElement);
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

let currentMesh = null;

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
  if (!currentMesh) return;
  scene.remove(currentMesh);
  currentMesh.geometry.dispose();
  if (currentMesh.material && currentMesh.material.dispose) currentMesh.material.dispose();
  currentMesh = null;
}

function frameObject(obj) {
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
    empty.innerHTML = `<div class="item-name">暂无模型</div><div class="item-meta">可本地上传 STL 预览；要发布到社区请通过提交模型入口</div>`;
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

  if (data.repoUrl) repoLinkEl.href = data.repoUrl;
  if (data.submitUrl) submitLinkEl.href = data.submitUrl;

  state.models = Array.isArray(data.models) ? data.models.map((m, idx) => ({
    id: m.id || `m_${idx}`,
    name: m.name,
    author: m.author,
    date: m.date,
    url: m.url,
    format: (m.format || "stl").toLowerCase()
  })).filter((m) => m.url && m.format === "stl") : [];

  setSelectedMeta(null);
  renderList();
}

function resize() {
  const rect = renderer.domElement.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width));
  const h = Math.max(1, Math.floor(rect.height));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function tick() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

qEl.addEventListener("input", renderList);
fileEl.addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  state.activeId = null;
  renderList();
  setSelectedMeta({
    name: file.name,
    author: "本地文件",
    date: "",
    url,
    format: "stl"
  });
  try {
    await loadStlFromUrl(url);
    setDownload(url, true);
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
tick();
