const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const STORE = "factpulse-v16";
let state = {
  subject: "",
  fact: "",
  scene: "",
  details: "",
  length: 30,
  licenseMode: "broad",
  pixabayKey: "",
  pexelsKey: "",
  clips: [],
  timeline: []
};
let renderedBlob = null;

function clean(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function esc(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toast(message) {
  const box = $("#toast");
  if (!box) return;
  box.textContent = message;
  box.classList.add("show");
  setTimeout(() => box.classList.remove("show"), 2200);
}

function words(text) {
  const stop = new Set([
    "the", "and", "for", "with", "that", "this", "from", "into", "about", "after",
    "before", "when", "what", "why", "how", "was", "were", "are", "his", "her",
    "their", "who", "has", "had", "have", "did", "does", "junior", "jr", "mrs", "mr"
  ]);
  return clean(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !stop.has(word))
    .slice(0, 20);
}

function titleCase(text) {
  return clean(text)
    .split(" ")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : ""))
    .join(" ");
}

function makeTitle() {
  const base = state.subject || words(state.fact).slice(0, 4).join(" ") || "Fact";
  return `${titleCase(base)} Fact`.toUpperCase().slice(0, 80);
}

function sceneFromText(text) {
  const value = clean(text).toLowerCase();
  const rules = [
    ["court", "courtroom judge lawyer courthouse hearing legal documents"],
    ["trial", "courtroom judge lawyer courthouse hearing legal documents"],
    ["lawsuit", "courtroom lawyer legal documents courthouse"],
    ["speech", "speech podium microphone crowd audience"],
    ["civil rights", "civil rights march protest crowd speech podium"],
    ["inventor", "inventor laboratory electricity machine experiment"],
    ["science", "science lab microscope experiment researcher"],
    ["money", "money cash bank finance coins wallet"],
    ["space", "space rocket planet astronaut galaxy"],
    ["ocean", "ocean waves underwater sea marine"],
    ["animal", "wild animals wildlife nature close up"],
    ["history", "historic building crowd speech old city street"],
    ["war", "military soldiers battlefield memorial"],
    ["school", "students classroom books studying"],
    ["health", "hospital doctor patient medical"],
    ["food", "food cooking kitchen close up"],
    ["technology", "computer phone circuit technology"],
    ["weather", "storm rain lightning clouds"],
    ["sports", "stadium athlete sports training"],
    ["music", "microphone concert crowd stage"],
    ["car", "cars road traffic city driving"],
    ["ship", "ship ocean water waves"],
    ["titanic", "ship ocean water iceberg historical"],
    ["volcano", "volcano lava eruption smoke mountain"],
    ["earth", "nature forest mountains landscape"]
  ];
  for (const [key, scene] of rules) {
    if (value.includes(key)) return scene;
  }
  return words(text).slice(0, 7).join(" ");
}

function buildSearches() {
  const subject = clean(state.subject);
  const scene = clean(state.scene) || sceneFromText(`${state.subject} ${state.fact}`);
  const factKeys = words(state.fact).slice(0, 6).join(" ");
  const exact = subject ? [subject] : [];
  const related = [
    `${subject} ${scene}`,
    scene,
    factKeys,
    `${scene} b roll`,
    `${scene} stock video`
  ].map(clean).filter(Boolean);
  return {
    exact,
    related: Array.from(new Set(related)).slice(0, 5)
  };
}

function makeVoiceover() {
  const fact = clean(state.fact) || "This fact becomes easier to understand when the video shows the setting, movement, scale, and context.";
  const details = clean(state.details) || words(fact).slice(0, 5).join(", ");
  return `Did you know? ${fact} The key details are: ${details}.`;
}

function save() {
  localStorage.setItem(STORE, JSON.stringify(state));
}

function load() {
  try {
    state = { ...state, ...JSON.parse(localStorage.getItem(STORE) || "{}") };
  } catch (_) {}

  for (const key of ["factpulse-v15", "factpulse-v14", "factpulse-v13"]) {
    try {
      const old = JSON.parse(localStorage.getItem(key) || "{}");
      if (!state.subject) state.subject = old.subject || old.current?.subject || "";
      if (!state.fact) state.fact = old.fact || old.current?.fact || old.current?.rawFact || "";
      if (!state.scene) state.scene = old.scene || old.current?.scene || "";
      if (!state.details) state.details = old.details || old.current?.numbers || "";
      if (!state.pixabayKey) state.pixabayKey = old.pixabayKey || old.pixabay || old.key || "";
      if (!state.pexelsKey) state.pexelsKey = old.pexelsKey || old.pexels || "";
    } catch (_) {}
  }

  syncToFields(false);
}

function syncFromFields(write = true) {
  const map = {
    subject: "subject",
    fact: "fact",
    scene: "scene",
    details: "details",
    length: "length",
    licenseMode: "licenseMode",
    pixabayKey: "pixabayKey",
    pexelsKey: "pexelsKey"
  };
  for (const [id, key] of Object.entries(map)) {
    const el = $("#" + id);
    if (!el) continue;
    state[key] = el.value;
  }
  state.length = Math.min(45, Math.max(25, Number(state.length) || 30));
  if (write) save();
  renderAll();
}

function syncToFields(write = true) {
  const map = {
    subject: "subject",
    fact: "fact",
    scene: "scene",
    details: "details",
    length: "length",
    licenseMode: "licenseMode",
    pixabayKey: "pixabayKey",
    pexelsKey: "pexelsKey"
  };
  for (const [id, key] of Object.entries(map)) {
    const el = $("#" + id);
    if (!el) continue;
    el.value = state[key] || el.value || "";
  }
  if (write) save();
  renderAll();
}

function renderAll() {
  renderSearchPlan();
  renderClips();
  renderTimeline();
  renderPost();
}

function renderSearchPlan() {
  const box = $("#searchPlan");
  if (!box) return;
  const searches = buildSearches();
  box.textContent = [
    "Exact subject search:",
    ...(searches.exact.length ? searches.exact : ["none"]),
    "",
    "Related B-roll searches:",
    ...searches.related
  ].join("\n");
}

function renderPost() {
  const box = $("#postBox");
  if (!box) return;
  box.textContent = [
    `TITLE: ${makeTitle()}`,
    "",
    `VIDEO LENGTH: ${state.length} seconds`,
    "",
    "VOICEOVER:",
    makeVoiceover(),
    "",
    "DESCRIPTION:",
    `${makeTitle()}\n\n${state.fact}\n\nKey details: ${state.details}\n\n#shorts #facts #didyouknow`,
    "",
    "CREDITS:",
    state.timeline.map((clip) => `${clip.credit} via ${clip.source} | ${clip.license} | ${clip.pageUrl}`).join("\n")
  ].join("\n");
}

async function autoFill() {
  const subject = clean($("#subject")?.value || state.subject);
  if (!subject) {
    toast("Type a subject first.");
    return;
  }
  toast("Getting fact and scene...");
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(subject)}&format=json&origin=*`;
    const searchRes = await fetch(searchUrl);
    const searchJson = await searchRes.json();
    const hit = searchJson.query?.search?.[0];
    const pageTitle = hit?.title || subject;
    const summaryRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`);
    const summary = summaryRes.ok ? await summaryRes.json() : {};
    const extract = clean(summary.extract || subject);
    const sentences = extract.split(/(?<=[.!?])\s+/).filter(Boolean);
    state.subject = pageTitle;
    state.fact = sentences.slice(0, 2).join(" ") || `${subject} is a topic where the setting, timeline, and context help explain the story.`;
    state.scene = sceneFromText(`${subject} ${summary.description || ""} ${state.fact}`);
    state.details = words(`${subject} ${summary.description || ""} ${state.fact}`).slice(0, 6).join(", ");
    state.clips = [];
    syncToFields(true);
    toast("Auto filled fact and scene.");
  } catch (error) {
    state.fact = `${subject} is a topic where the setting, timeline, and context help explain the story.`;
    state.scene = sceneFromText(subject);
    state.details = words(subject).slice(0, 6).join(", ");
    state.clips = [];
    syncToFields(true);
    toast("Auto filled a basic version.");
  }
}

function isPublicLicense(license) {
  const value = clean(license).toLowerCase();
  return value.includes("public domain") || value.includes("cc0") || value.includes("pdm");
}

function isAllowedLicense(license) {
  const value = clean(license).toLowerCase();
  return isPublicLicense(value) || value.includes("cc by") || value.includes("pixabay") || value.includes("pexels") || value.includes("unknown");
}

function clipText(clip) {
  return `${clip.tags} ${clip.credit} ${clip.pageUrl} ${clip.source}`.toLowerCase();
}

function subjectMatch(clip) {
  const tokens = words(state.subject);
  if (!tokens.length) return false;
  const text = clipText(clip);
  const hits = tokens.filter((token) => text.includes(token)).length;
  return tokens.length === 1 ? hits === 1 : hits >= Math.min(2, tokens.length);
}

function sceneMatch(clip) {
  const tokens = words(state.scene);
  if (!tokens.length) return false;
  const text = clipText(clip);
  const hits = tokens.filter((token) => text.includes(token)).length;
  return hits >= Math.min(2, tokens.length);
}

function scoreClip(clip) {
  const text = clipText(clip);
  let score = 0;
  for (const token of words(state.subject)) if (text.includes(token)) score += 15;
  for (const token of words(state.scene)) if (text.includes(token)) score += 4;
  if (clip.match === "exact") score += 60;
  if (clip.source === "Pixabay" || clip.source === "Pexels") score += 8;
  if (clip.source === "Wikimedia Commons") score += 4;
  if (isPublicLicense(clip.license)) score += 3;
  return score;
}

function classifyAndSaveClips(newClips) {
  const combined = new Map(state.clips.map((clip) => [clip.id, clip]));
  for (const clip of newClips) combined.set(clip.id, clip);

  const kept = [];
  for (const clip of combined.values()) {
    if (subjectMatch(clip)) {
      clip.match = "exact";
      kept.push(clip);
    } else if (sceneMatch(clip)) {
      clip.match = "related";
      kept.push(clip);
    }
  }
  state.clips = kept.sort((a, b) => scoreClip(b) - scoreClip(a)).slice(0, 1500);
  save();
  renderClips();
  updateClipCount();
}

function setClipStatus(text) {
  const box = $("#clipCount");
  if (box) box.textContent = text;
}

function updateClipCount() {
  const exact = state.clips.filter((clip) => clip.match === "exact").length;
  const related = state.clips.filter((clip) => clip.match === "related").length;
  setClipStatus(`${exact} exact, ${related} related loaded`);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 9000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function searchCommons(query) {
  const clips = [];
  let offset = 0;
  while (clips.length < 60) {
    const url = "https://commons.wikimedia.org/w/api.php" +
      `?action=query&generator=search&gsrnamespace=6&gsrlimit=50&gsroffset=${offset}` +
      `&gsrsearch=${encodeURIComponent(query + " filetype:video")}` +
      "&prop=imageinfo&iiprop=url|mime|extmetadata&format=json&origin=*";
    const res = await fetchWithTimeout(url, {}, 8000);
    if (!res.ok) break;
    const json = await res.json();
    const pages = json.query?.pages ? Object.values(json.query.pages) : [];
    for (const page of pages) {
      const info = page.imageinfo?.[0];
      if (!info || !String(info.mime || "").startsWith("video/")) continue;
      const meta = info.extmetadata || {};
      const license = meta.LicenseShortName?.value || meta.UsageTerms?.value || "Unknown license";
      if (state.licenseMode === "public" && !isPublicLicense(license)) continue;
      if (state.licenseMode !== "public" && !isAllowedLicense(license)) continue;
      clips.push({
        id: `commons-${page.pageid}`,
        source: "Wikimedia Commons",
        credit: meta.Artist?.value ? meta.Artist.value.replace(/<[^>]+>/g, "") : "Wikimedia contributor",
        pageUrl: "https://commons.wikimedia.org/wiki/" + encodeURIComponent(page.title.replaceAll(" ", "_")),
        videoUrl: info.url,
        previewUrl: info.url,
        tags: `${page.title} ${query}`,
        license
      });
    }
    if (!json.continue?.gsroffset) break;
    offset = json.continue.gsroffset;
  }
  return clips;
}

async function searchPixabay(query, many) {
  if (!state.pixabayKey || state.licenseMode === "public") return [];
  const clips = [];
  const pages = many ? 5 : 1;
  for (let page = 1; page <= pages; page++) {
    const url = "https://pixabay.com/api/videos/" +
      `?key=${encodeURIComponent(state.pixabayKey)}` +
      `&q=${encodeURIComponent(query)}` +
      `&orientation=vertical&per_page=${many ? 200 : 40}&page=${page}` +
      "&safesearch=true&order=popular";
    const res = await fetchWithTimeout(url, {}, 8000);
    if (!res.ok) break;
    const json = await res.json();
    for (const hit of json.hits || []) {
      const file = hit.videos?.medium || hit.videos?.small || hit.videos?.large || hit.videos?.tiny;
      if (!file?.url) continue;
      clips.push({
        id: `pixabay-${hit.id}`,
        source: "Pixabay",
        credit: hit.user || "Pixabay creator",
        pageUrl: hit.pageURL,
        videoUrl: file.url,
        previewUrl: file.url,
        tags: hit.tags || query,
        license: "Pixabay Content License"
      });
    }
  }
  return clips;
}

async function searchPexels(query, many) {
  if (!state.pexelsKey || state.licenseMode === "public") return [];
  const clips = [];
  const pages = many ? 8 : 1;
  for (let page = 1; page <= pages; page++) {
    const url = "https://api.pexels.com/videos/search" +
      `?query=${encodeURIComponent(query)}&orientation=portrait&size=medium&per_page=${many ? 80 : 40}&page=${page}`;
    const res = await fetchWithTimeout(url, { headers: { Authorization: state.pexelsKey } }, 8000);
    if (!res.ok) break;
    const json = await res.json();
    for (const video of json.videos || []) {
      const file = (video.video_files || []).filter((item) => item.link && item.height >= item.width)[0] || (video.video_files || [])[0];
      if (!file?.link) continue;
      clips.push({
        id: `pexels-${video.id}`,
        source: "Pexels",
        credit: video.user?.name || "Pexels creator",
        pageUrl: video.url,
        videoUrl: file.link,
        previewUrl: file.link,
        tags: query,
        license: "Pexels License"
      });
    }
  }
  return clips;
}

async function searchClips(many) {
  syncFromFields(true);
  state.clips = [];
  renderClips();
  const plan = buildSearches();
  const runs = [
    ...plan.exact.map((query) => ({ query, type: "exact" })),
    ...plan.related.map((query) => ({ query, type: "related" }))
  ];
  setClipStatus("Starting strict search...");
  for (const run of runs) {
    const sources = [["Wikimedia", searchCommons]];
    if (state.licenseMode !== "public") {
      if (state.pixabayKey) sources.unshift(["Pixabay", searchPixabay]);
      if (state.pexelsKey) sources.unshift(["Pexels", searchPexels]);
    }
    for (const [name, fn] of sources) {
      try {
        setClipStatus(`Searching ${name}: ${run.query}`);
        const results = await fn(run.query, many);
        if (results.length) classifyAndSaveClips(results);
      } catch (_) {}
    }
  }
  updateClipCount();
  toast(state.clips.length ? "Strict search finished." : "No relevant clips found. Add better scene words or a stock key.");
}

function addClip(index) {
  const clip = state.clips[index];
  if (!clip) return;
  state.timeline.push(clip);
  save();
  renderTimeline();
  renderPost();
  toast("Clip added");
}

function ensureModal() {
  if ($("#clipModal")) return;
  const modal = document.createElement("div");
  modal.id = "clipModal";
  modal.innerHTML = `
    <div class="modal-card">
      <button class="modal-close" id="closeModal" type="button">×</button>
      <video id="modalVideo" controls playsinline></video>
      <div class="box" id="modalInfo"></div>
      <div class="two">
        <button class="btn primary" id="modalAdd" type="button">Add clip</button>
        <a class="btn secondary" id="modalSource" target="_blank">Source</a>
      </div>
    </div>`;
  document.body.appendChild(modal);
  $("#closeModal").onclick = closePreview;
  modal.onclick = (event) => {
    if (event.target.id === "clipModal") closePreview();
  };
}

function openPreview(index) {
  const clip = state.clips[index];
  if (!clip) return;
  ensureModal();
  const video = $("#modalVideo");
  video.src = clip.videoUrl;
  video.play().catch(() => {});
  $("#modalInfo").textContent = `${clip.match === "exact" ? "Exact subject match" : "Related B-roll"}\n${clip.source}\nLicense: ${clip.license}\nTopic: ${clip.tags}`;
  $("#modalSource").href = clip.pageUrl;
  $("#modalAdd").onclick = () => {
    addClip(index);
    closePreview();
  };
  $("#clipModal").classList.add("show");
}

function closePreview() {
  const video = $("#modalVideo");
  if (video) {
    video.pause();
    video.removeAttribute("src");
  }
  $("#clipModal")?.classList.remove("show");
}

function renderClips() {
  const grid = $("#clipGrid");
  if (!grid) return;
  if (!state.clips.length) {
    setClipStatus("0 clips loaded");
    grid.innerHTML = `<div class="box">No clips loaded. Exact clips must contain your subject. Related B-roll must match your scene words. Random archive footage is off.</div>`;
    return;
  }
  grid.innerHTML = "";
  const groups = [
    ["EXACT TOPIC", state.clips.filter((clip) => clip.match === "exact")],
    ["RELATED B-ROLL", state.clips.filter((clip) => clip.match === "related")]
  ];
  for (const [label, list] of groups) {
    if (!list.length) continue;
    const heading = document.createElement("div");
    heading.className = "box";
    heading.textContent = `${label} · ${list.length} clips`;
    grid.appendChild(heading);
    for (const clip of list) {
      const index = state.clips.indexOf(clip);
      const card = document.createElement("article");
      card.className = "clip";
      card.innerHTML = `
        <div class="thumb"><video muted playsinline preload="metadata" src="${clip.previewUrl}"></video></div>
        <strong>${label} · ${esc(clip.source)}</strong>
        <small>License: ${esc(clip.license)}</small>
        <small>Topic: ${esc((clip.tags || "").slice(0, 100))}</small>
        <div class="row">
          <button type="button" data-preview="${index}">Preview</button>
          <button type="button" data-add="${index}">Add</button>
        </div>
        <a href="${clip.pageUrl}" target="_blank">Source</a>`;
      grid.appendChild(card);
    }
  }
  $$('[data-preview]').forEach((button) => button.onclick = () => openPreview(Number(button.dataset.preview)));
  $$('[data-add]').forEach((button) => button.onclick = () => addClip(Number(button.dataset.add)));
  $$(".clip").forEach((card) => {
    card.onclick = (event) => {
      if (event.target.closest("button,a")) return;
      const button = card.querySelector("[data-preview]");
      if (button) openPreview(Number(button.dataset.preview));
    };
  });
}

function renderTimeline() {
  const box = $("#timeline");
  if (!box) return;
  const count = $("#timelineCount");
  if (count) count.textContent = `${state.timeline.length} clips selected. Final length: ${state.length} seconds.`;
  box.innerHTML = state.timeline.length ? "" : `<div class="box">No clips added yet.</div>`;
  state.timeline.forEach((clip, index) => {
    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <div>
        <strong>Clip ${index + 1} · ${esc(clip.source)}</strong>
        <small>${esc(clip.license)}</small>
        <small>${esc(clip.pageUrl)}</small>
      </div>
      <button type="button" data-remove="${index}">×</button>`;
    box.appendChild(item);
  });
  $$('[data-remove]').forEach((button) => button.onclick = () => {
    state.timeline.splice(Number(button.dataset.remove), 1);
    save();
    renderTimeline();
    renderPost();
  });
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const tokens = text.split(" ");
  let line = "";
  const lines = [];
  for (const token of tokens) {
    const test = line + token + " ";
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line.trim());
      line = token + " ";
    } else {
      line = test;
    }
  }
  lines.push(line.trim());
  lines.slice(0, maxLines).forEach((value, index) => ctx.fillText(value, x, y + index * lineHeight));
}

function drawCover(ctx, video, x, y, width, height) {
  const vw = video.videoWidth || 720;
  const vh = video.videoHeight || 1280;
  const scale = Math.max(width / vw, height / vh);
  const sw = width / scale;
  const sh = height / scale;
  ctx.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, x, y, width, height);
}

function loadVideo(src) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.src = src;
    video.onloadeddata = () => resolve(video);
    video.onerror = reject;
  });
}

async function renderVideo() {
  syncFromFields(true);
  const canvas = $("#canvas");
  if (!canvas || !canvas.captureStream || !window.MediaRecorder) {
    toast("This browser cannot render video.");
    return;
  }
  const ctx = canvas.getContext("2d");
  const duration = state.length;
  const videos = [];
  try {
    for (const clip of state.timeline) videos.push(await loadVideo(clip.videoUrl));
  } catch (_) {}

  const recorder = new MediaRecorder(canvas.captureStream(24), {
    mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm"
  });
  const chunks = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };
  const done = new Promise((resolve) => recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" })));
  recorder.start();
  const start = performance.now();

  function frame(now) {
    const t = Math.min((now - start) / 1000, duration);
    const top = 430;
    const bottom = 110;
    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 0, 720, 1280);

    if (videos.length) {
      const index = Math.min(videos.length - 1, Math.floor(t / (duration / videos.length)));
      const video = videos[index];
      try {
        video.currentTime = t % Math.max(video.duration || 4, 1);
        drawCover(ctx, video, 0, top, 720, 1280 - top - bottom);
      } catch (_) {}
    } else {
      ctx.fillStyle = "#1f6fb6";
      ctx.fillRect(0, top, 720, 1280 - top - bottom);
    }

    ctx.fillStyle = "#030303";
    ctx.fillRect(0, 0, 720, top);
    ctx.fillStyle = "#18f038";
    ctx.font = "900 56px -apple-system,Segoe UI,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("DID YOU KNOW?", 360, 82);
    ctx.fillStyle = "white";
    ctx.font = "900 35px -apple-system,Segoe UI,sans-serif";
    wrapText(ctx, clean(state.fact), 360, 137, 660, 39, 7);
    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 1170, 720, 110);
    ctx.fillStyle = "white";
    ctx.font = "bold 29px -apple-system,Segoe UI,sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("@FactPulse", 28, 1215);
    ctx.font = "bold 25px -apple-system,Segoe UI,sans-serif";
    ctx.fillText(makeTitle().slice(0, 38), 28, 1256);
    const progress = $("#progress");
    if (progress) progress.style.width = `${(t / duration) * 100}%`;
    if (t < duration) requestAnimationFrame(frame);
    else recorder.stop();
  }

  requestAnimationFrame(frame);
  renderedBlob = await done;
  const url = URL.createObjectURL(renderedBlob);
  const out = $("#videoOut");
  if (out) {
    out.innerHTML = `<video controls playsinline src="${url}"></video><a class="btn primary" href="${url}" download="factpulse-short.webm" style="margin-top:10px">Download styled video</a>`;
  }
  toast("Styled video rendered");
}

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function pack() {
  syncFromFields(true);
  return {
    title: makeTitle(),
    voiceover: makeVoiceover(),
    description: state.fact,
    clips: state.timeline
  };
}

function injectStyles() {
  if ($("#modalStyle")) return;
  const style = document.createElement("style");
  style.id = "modalStyle";
  style.textContent = `
    #clipModal{position:fixed;inset:0;z-index:200;background:rgba(0,0,0,.86);display:none;align-items:center;justify-content:center;padding:14px}
    #clipModal.show{display:flex}
    .modal-card{width:min(96vw,430px);max-height:92vh;overflow:auto;background:#111318;border:1px solid #2a2e38;border-radius:24px;padding:12px}
    .modal-card video{width:100%;max-height:58vh;background:#000;border-radius:18px}
    .modal-close{float:right;border:0;border-radius:999px;background:#18f038;color:#051007;font-weight:1000;width:40px;height:40px}
    .clip{cursor:pointer}
    .clip>a{display:block;margin-top:0}
  `;
  document.head.appendChild(style);
}

function bind() {
  injectStyles();
  $$('[data-nav]').forEach((link) => link.classList.toggle("active", link.dataset.nav === (document.body.dataset.page || "create")));
  const form = $("#factForm");
  if (form) form.onsubmit = (event) => {
    event.preventDefault();
    syncFromFields(true);
    state.clips = [];
    save();
    location.href = "clips-v16.html";
  };
  if ($("#autoFill")) $("#autoFill").onclick = autoFill;
  if ($("#searchClips")) $("#searchClips").onclick = () => searchClips(false);
  if ($("#searchMany")) $("#searchMany").onclick = () => searchClips(true);
  if ($("#renderBtn")) $("#renderBtn").onclick = renderVideo;
  if ($("#copyPost")) $("#copyPost").onclick = async () => {
    syncFromFields(true);
    await navigator.clipboard.writeText($("#postBox").textContent);
    toast("Copied");
  };
  if ($("#downloadPack")) $("#downloadPack").onclick = () => downloadFile("factpulse-edit-pack.json", JSON.stringify(pack(), null, 2), "application/json");

  for (const id of ["subject", "fact", "scene", "details", "length", "licenseMode", "pixabayKey", "pexelsKey"]) {
    const el = $("#" + id);
    if (!el) continue;
    el.addEventListener("input", () => {
      state.clips = [];
      syncFromFields(true);
    });
    if (id === "licenseMode") el.addEventListener("change", () => {
      state.clips = [];
      syncFromFields(true);
    });
  }
}

load();
bind();
renderAll();