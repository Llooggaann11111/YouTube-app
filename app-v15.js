const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const STORE = "factpulse-v15";
const LEGACY_STORES = ["factpulse-v15", "factpulse-v14", "factpulse-v13"];
const API_BASE = location.port === "8001" ? "" : "http://127.0.0.1:8001";

let state = {
  subject: "",
  fact: "",
  scene: "",
  details: "",
  length: 30,
  mode: "broad",
  pixabay: "",
  pexels: "",
  clips: [],
  timeline: [],
};

let lastRenderedBlob = null;
let integrationStatusCache = null;

function clean(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function toast(message) {
  const node = $("#toast");
  if (!node) {
    return;
  }
  node.textContent = message;
  node.classList.add("show");
  setTimeout(() => node.classList.remove("show"), 2200);
}

function keywordList(text) {
  return clean(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(
      (word) =>
        word.length > 2 &&
        ![
          "the",
          "and",
          "for",
          "with",
          "that",
          "this",
          "from",
          "into",
          "about",
          "after",
          "before",
          "when",
          "what",
          "why",
          "how",
          "was",
          "were",
          "are",
          "his",
          "her",
          "their",
          "who",
          "has",
          "had",
          "have",
          "did",
          "does",
          "junior",
        ].includes(word)
    )
    .slice(0, 18);
}

function titleCase(text) {
  return clean(text)
    .split(" ")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : ""))
    .join(" ");
}

function postTitle() {
  return (titleCase(state.subject || keywordList(state.fact).slice(0, 4).join(" ") || "Fact") + " Fact")
    .toUpperCase()
    .slice(0, 70);
}

function autoSceneText(text) {
  const lowered = clean(text).toLowerCase();
  const mappings = [
    ["court", "courtroom judge lawyer courthouse hearing documents"],
    ["speech", "speech podium microphone crowd"],
    ["inventor", "inventor lab electricity machine"],
    ["science", "science lab microscope experiment"],
    ["money", "money cash bank finance coins wallet"],
    ["space", "space rocket planet astronaut galaxy"],
    ["ocean", "ocean waves underwater sea"],
    ["animal", "wild animals wildlife nature close up"],
    ["history", "archive footage crowd speech old city street"],
    ["school", "students classroom books studying"],
    ["health", "hospital doctor patient medical"],
    ["food", "food cooking kitchen close up"],
    ["technology", "computer phone circuit technology"],
    ["weather", "storm rain lightning clouds"],
    ["sports", "stadium athlete sports training"],
    ["music", "microphone concert crowd stage"],
    ["car", "cars road traffic city driving"],
  ];

  for (const [trigger, replacement] of mappings) {
    if (lowered.includes(trigger)) {
      return replacement;
    }
  }
  return keywordList(text).slice(0, 7).join(" ");
}

function mergedKeywords(...values) {
  return Array.from(new Set(values.flatMap((value) => keywordList(value)).filter(Boolean)));
}

function subjectTokens() {
  return keywordList(state.subject);
}

function detailTokens() {
  return mergedKeywords(state.details, state.fact).slice(0, 12);
}

function sceneTokens() {
  return keywordList(clean(state.scene) || autoSceneText(`${state.subject} ${state.fact}`)).slice(0, 10);
}

function isPersonLikeSubject() {
  const fact = clean(`${state.subject} ${state.fact} ${state.details}`).toLowerCase();
  return (
    subjectTokens().length >= 2 ||
    /\b(inventor|scientist|engineer|physicist|chemist|mathematician|artist|writer|president|king|queen|actor|founder|born|died)\b/.test(
      fact
    )
  );
}

function forbiddenContextTerms() {
  const context = new Set(mergedKeywords(state.subject, state.fact, state.scene, state.details));
  const groups = [
    {
      allow: ["bomb", "war", "weapon", "military", "missile", "explosion", "nuclear", "gun"],
      block: [
        "bomb",
        "missile",
        "weapon",
        "military",
        "artillery",
        "grenade",
        "gun",
        "warhead",
        "mushroom",
        "rifle",
        "rocket",
        "tank",
        "soldier",
        "battle",
        "explosive",
        "detonation",
      ],
    },
    {
      allow: ["fire", "explosion", "disaster", "blast", "eruption", "volcano", "crash"],
      block: ["detonation", "blast", "explosion"],
    },
  ];

  const blocked = new Set();
  groups.forEach((group) => {
    const allowed = group.allow.some((term) => context.has(term));
    if (!allowed) {
      group.block.forEach((term) => blocked.add(term));
    }
  });
  return Array.from(blocked);
}

function urlWords(url) {
  try {
    const parsed = new URL(url);
    return decodeURIComponent(parsed.pathname.replace(/[-_/]+/g, " "));
  } catch (error) {
    return String(url || "").replace(/[-_/]+/g, " ");
  }
}

function searchQueries() {
  const subject = clean(state.subject);
  const scene = clean(state.scene) || autoSceneText(`${state.subject} ${state.fact}`);
  const scenePhrase = sceneTokens().slice(0, 5).join(" ");
  const detailPhrase = detailTokens().slice(0, 6).join(" ");
  const exact = Array.from(
    new Set(
      [
        subject,
        subject && detailPhrase ? `${subject} ${detailTokens().slice(0, 2).join(" ")}` : "",
        isPersonLikeSubject() && subject ? `${subject} portrait` : "",
      ]
        .map(clean)
        .filter(Boolean)
    )
  ).slice(0, 3);
  const relatedSeed = isPersonLikeSubject()
    ? [
        `${subject} ${scenePhrase}`,
        `${subject} ${detailTokens().slice(0, 3).join(" ")}`,
        `${detailTokens().slice(0, 4).join(" ")} ${scenePhrase}`,
        `${scenePhrase} scientist inventor laboratory`,
        `${scenePhrase} documentary b roll`,
      ]
    : [
        `${subject} ${scene}`,
        scene,
        keywordList(state.fact).slice(0, 6).join(" "),
        `${scene} b roll`,
      ];
  const related = Array.from(new Set(relatedSeed.map(clean).filter(Boolean))).slice(0, 5);
  return {
    exact,
    related,
  };
}

function voiceoverText() {
  const fact = clean(state.fact) || "This fact becomes easier to understand when the video shows context and movement.";
  const details = clean(state.details) || keywordList(fact).slice(0, 4).join(", ");
  return `Did you know? ${fact} The key details are: ${details}.`;
}

function saveState() {
  localStorage.setItem(STORE, JSON.stringify(state));
}

function mergeLegacyState() {
  for (const key of LEGACY_STORES) {
    try {
      const legacy = JSON.parse(localStorage.getItem(key) || "{}");
      if (!state.subject && legacy.subject) {
        state.subject = legacy.subject;
      }
      if (!state.fact && legacy.fact) {
        state.fact = legacy.fact;
      }
      if (!state.scene && legacy.scene) {
        state.scene = legacy.scene;
      }
      if (!state.details && legacy.details) {
        state.details = legacy.details;
      }
      if (!state.pixabay && (legacy.pixabayKey || legacy.key || legacy.pixabay)) {
        state.pixabay = legacy.pixabayKey || legacy.key || legacy.pixabay;
      }
      if (!state.pexels && (legacy.pexelsKey || legacy.pexels)) {
        state.pexels = legacy.pexelsKey || legacy.pexels;
      }
      if (legacy.current) {
        state.subject = state.subject || legacy.current.subject || "";
        state.fact = state.fact || legacy.current.rawFact || legacy.current.fact || "";
        state.scene = state.scene || legacy.current.scene || legacy.current.query || "";
        state.details = state.details || legacy.current.numbers || "";
      }
    } catch (error) {
      // Ignore unreadable legacy state and keep moving.
    }
  }
}

function applyStateToInputs() {
  const fieldMap = {
    subject: "subject",
    fact: "fact",
    scene: "scene",
    details: "details",
    length: "length",
    licenseMode: "mode",
    pixabayKey: "pixabay",
    pexelsKey: "pexels",
  };

  for (const [id, key] of Object.entries(fieldMap)) {
    const element = document.getElementById(id);
    if (!element) {
      continue;
    }
    element.value = state[key] ?? element.value ?? "";
  }
}

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORE) || "{}");
    state = { ...state, ...stored };
  } catch (error) {
    // Ignore invalid saved state.
  }
  mergeLegacyState();
  applyStateToInputs();
  syncFromInputs({ write: false });
}

function syncFromInputs(options = {}) {
  const { write = true, clearClips = false } = options;
  const fieldMap = {
    subject: "subject",
    fact: "fact",
    scene: "scene",
    details: "details",
    length: "length",
    licenseMode: "mode",
    pixabayKey: "pixabay",
    pexelsKey: "pexels",
  };

  for (const [id, key] of Object.entries(fieldMap)) {
    const element = document.getElementById(id);
    if (element) {
      state[key] = element.value;
    }
  }

  state.length = Math.min(45, Math.max(25, Number(state.length) || 30));
  if (clearClips) {
    state.clips = [];
  }
  if (write) {
    saveState();
  }

  renderPlan();
  renderClips();
  renderTimeline();
  renderPostPackage();
}

function renderPlan() {
  const node = $("#searchPlan");
  if (!node) {
    return;
  }
  const queries = searchQueries();
  node.textContent = [
    "Exact subject search:",
    ...(queries.exact.length ? queries.exact : ["none"]),
    "",
    "Related B-roll searches:",
    ...queries.related,
  ].join("\n");
}

function renderPostPackage() {
  const node = $("#postBox");
  if (!node) {
    return;
  }
  const creditLines = state.timeline.length
    ? state.timeline.map((clip) => `${clip.credit} via ${clip.source} | ${clip.license} | ${clip.pageUrl}`).join("\n")
    : "No credits yet.";

  node.textContent = [
    `TITLE: ${postTitle()}`,
    "",
    `VIDEO LENGTH: ${state.length} seconds`,
    "",
    "VOICEOVER:",
    voiceoverText(),
    "",
    "DESCRIPTION:",
    `${postTitle()}\n\n${clean(state.fact)}\n\nKey details: ${clean(state.details)}\n\n#shorts #facts #didyouknow`,
    "",
    "CREDITS:",
    creditLines,
  ].join("\n");
}

function currentYouTubeDescription() {
  const creditLines = state.timeline.length
    ? state.timeline
        .slice(0, 12)
        .map((clip) => `${clip.credit} via ${clip.source} | ${clip.license}`)
        .join("\n")
    : "No external clips credited.";

  return [
    clean(state.fact),
    "",
    `Voiceover: ${voiceoverText()}`,
    "",
    `Key details: ${clean(state.details)}`,
    "",
    "Credits:",
    creditLines,
    "",
    "#shorts #facts #didyouknow",
  ]
    .join("\n")
    .slice(0, 4900);
}

async function wikiFill() {
  const subjectField = $("#subject");
  const subject = clean(subjectField ? subjectField.value : state.subject);
  if (!subject) {
    toast("Type a subject first.");
    return;
  }

  toast("Getting fact and scene...");
  try {
    const searchResponse = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(subject)}&format=json&origin=*`
    );
    const searchJson = await searchResponse.json();
    const hit = searchJson.query && searchJson.query.search && searchJson.query.search[0];
    const pageTitle = hit ? hit.title : subject;
    const summaryResponse = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`
    );
    const summaryJson = summaryResponse.ok ? await summaryResponse.json() : {};
    const extract = clean(summaryJson.extract || subject);

    state.subject = pageTitle;
    state.fact =
      extract
        .split(/(?<=[.!?])\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .join(" ") || `${subject} is a topic with details, timeline, and context.`;
    state.scene = autoSceneText(`${subject} ${clean(summaryJson.description || "")} ${state.fact}`);
    state.details = keywordList(`${subject} ${clean(summaryJson.description || "")} ${state.fact}`).slice(0, 6).join(", ");
    state.clips = [];

    applyStateToInputs();
    saveState();
    syncFromInputs({ write: false });
    toast("Auto filled.");
  } catch (error) {
    toast("Auto fill failed. Type scene words manually.");
  }
}

function isPublicDomain(license) {
  const lowered = clean(license).toLowerCase();
  return lowered.includes("public domain") || lowered.includes("cc0") || lowered.includes("pdm");
}

function isAllowedLicense(license) {
  const lowered = clean(license).toLowerCase();
  return (
    isPublicDomain(license) ||
    lowered.includes("cc by") ||
    lowered.includes("pixabay") ||
    lowered.includes("pexels") ||
    lowered.includes("unknown")
  );
}

function clipText(clip) {
  return [clip.title, clip.tags, clip.credit, clip.metadata, urlWords(clip.pageUrl), clip.source]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function hasForbiddenTerms(clip) {
  const text = clipText(clip);
  return forbiddenContextTerms().some((term) => text.includes(term));
}

function subjectMatch(clip) {
  const tokens = subjectTokens();
  if (!tokens.length) {
    return false;
  }
  if (hasForbiddenTerms(clip)) {
    return false;
  }
  const text = clipText(clip);
  const hits = tokens.filter((token) => text.includes(token)).length;
  return tokens.length === 1 ? hits === 1 : hits >= Math.min(2, tokens.length);
}

function sceneMatch(clip) {
  const tokens = sceneTokens();
  if (!tokens.length) {
    return false;
  }
  if (hasForbiddenTerms(clip)) {
    return false;
  }
  const text = clipText(clip);
  const hits = tokens.filter((token) => text.includes(token)).length;
  const subjectHits = subjectTokens().filter((token) => text.includes(token)).length;
  const detailHits = detailTokens().filter((token) => text.includes(token)).length;
  if (isPersonLikeSubject()) {
    return hits >= Math.min(2, tokens.length) && (subjectHits >= 1 || detailHits >= 1);
  }
  return hits >= Math.min(2, tokens.length);
}

function clipScore(clip) {
  const text = clipText(clip);
  let score = 0;
  subjectTokens().forEach((token) => {
    if (text.includes(token)) {
      score += 15;
    }
  });
  sceneTokens().forEach((token) => {
    if (text.includes(token)) {
      score += 4;
    }
  });
  detailTokens().forEach((token) => {
    if (text.includes(token)) {
      score += 6;
    }
  });
  if (clip.match === "exact") {
    score += 60;
  }
  if (clip.source === "Pixabay" || clip.source === "Pexels") {
    score += 8;
  }
  if (clip.source === "Wikimedia Commons") {
    score += 4;
  }
  if (isPublicDomain(clip.license)) {
    score += 3;
  }
  return score;
}

async function fetchTimeout(url, options = {}, timeoutMs = 9000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function classifyClips(allClips) {
  const exact = [];
  const related = [];

  for (const clip of allClips) {
    if (subjectMatch(clip)) {
      clip.match = "exact";
      exact.push(clip);
    } else if (sceneMatch(clip)) {
      clip.match = "related";
      related.push(clip);
    }
  }

  const deduped = new Map();
  [...exact, ...related].forEach((clip) => {
    deduped.set(clip.id, clip);
  });

  state.clips = Array.from(deduped.values())
    .sort((left, right) => clipScore(right) - clipScore(left))
    .slice(0, 1500);
}

function setClipStatus(message) {
  const node = $("#clipCount");
  if (node) {
    node.textContent = message;
  }
}

function addResults(results) {
  classifyClips([...state.clips, ...results]);
  saveState();
  renderClips();
  const exactCount = state.clips.filter((clip) => clip.match === "exact").length;
  const relatedCount = state.clips.filter((clip) => clip.match === "related").length;
  setClipStatus(`${exactCount} exact, ${relatedCount} related loaded`);
}

async function searchCommons(query) {
  const results = [];
  let offset = 0;

  while (results.length < 50) {
    const response = await fetchTimeout(
      `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrlimit=50&gsroffset=${offset}&gsrsearch=${encodeURIComponent(
        `${query} filetype:video`
      )}&prop=imageinfo&iiprop=url|mime|extmetadata&format=json&origin=*`,
      {},
      8000
    );
    if (!response.ok) {
      break;
    }
    const json = await response.json();
    const pages = json.query && json.query.pages ? Object.values(json.query.pages) : [];
    pages.forEach((page) => {
      const imageInfo = page.imageinfo && page.imageinfo[0];
      if (!imageInfo || !String(imageInfo.mime || "").startsWith("video/")) {
        return;
      }
      const metadata = imageInfo.extmetadata || {};
      const license =
        (metadata.LicenseShortName && metadata.LicenseShortName.value) ||
        (metadata.UsageTerms && metadata.UsageTerms.value) ||
        "Unknown license";
      if (state.mode === "public" && !isPublicDomain(license)) {
        return;
      }
      if (state.mode !== "public" && !isAllowedLicense(license)) {
        return;
      }
      results.push({
        id: `commons-${page.pageid}`,
        source: "Wikimedia Commons",
        title: page.title,
        credit:
          metadata.Artist && metadata.Artist.value
            ? metadata.Artist.value.replace(/<[^>]+>/g, "")
            : "Wikimedia contributor",
        pageUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replaceAll(" ", "_"))}`,
        videoUrl: imageInfo.url,
        previewUrl: imageInfo.url,
        tags: page.title,
        metadata: `${metadata.ObjectName?.value || ""} ${metadata.ImageDescription?.value || ""}`.replace(/<[^>]+>/g, " "),
        searchTerm: query,
        license,
      });
    });

    if (!json.continue || !json.continue.gsroffset) {
      break;
    }
    offset = json.continue.gsroffset;
  }

  return results;
}

async function searchPixabay(query, many) {
  if (!state.pixabay || state.mode === "public") {
    return [];
  }
  const results = [];
  const pages = many ? 5 : 1;

  for (let page = 1; page <= pages; page += 1) {
    const response = await fetchTimeout(
      `https://pixabay.com/api/videos/?key=${encodeURIComponent(state.pixabay)}&q=${encodeURIComponent(
        query
      )}&orientation=vertical&per_page=${many ? 200 : 40}&page=${page}&safesearch=true&order=popular`,
      {},
      8000
    );
    if (!response.ok) {
      break;
    }
    const json = await response.json();
    (json.hits || []).forEach((video) => {
      const file =
        (video.videos && (video.videos.medium || video.videos.small || video.videos.large || video.videos.tiny)) ||
        null;
      if (!file || !file.url) {
        return;
      }
      results.push({
        id: `pixabay-${video.id}`,
        source: "Pixabay",
        title: urlWords(video.pageURL),
        credit: video.user || "Pixabay creator",
        pageUrl: video.pageURL,
        videoUrl: file.url,
        previewUrl: file.url,
        tags: video.tags || "",
        metadata: urlWords(video.pageURL),
        searchTerm: query,
        license: "Pixabay Content License",
      });
    });
  }

  return results;
}

async function searchPexels(query, many) {
  if (!state.pexels || state.mode === "public") {
    return [];
  }
  const results = [];
  const pages = many ? 8 : 1;

  for (let page = 1; page <= pages; page += 1) {
    const response = await fetchTimeout(
      `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=portrait&size=medium&per_page=${
        many ? 80 : 40
      }&page=${page}`,
      {
        headers: { Authorization: state.pexels },
      },
      8000
    );
    if (!response.ok) {
      break;
    }
    const json = await response.json();
    (json.videos || []).forEach((video) => {
      const portraitFile =
        (video.video_files || []).filter((file) => file.link && file.height >= file.width)[0] ||
        (video.video_files || [])[0];
      if (!portraitFile || !portraitFile.link) {
        return;
      }
      results.push({
        id: `pexels-${video.id}`,
        source: "Pexels",
        title: urlWords(video.url),
        credit: (video.user && video.user.name) || "Pexels creator",
        pageUrl: video.url,
        videoUrl: portraitFile.link,
        previewUrl: portraitFile.link,
        tags: urlWords(video.url),
        metadata: `${video.id} ${urlWords(video.url)}`,
        searchTerm: query,
        license: "Pexels License",
      });
    });
  }

  return results;
}

async function searchClips(many) {
  syncFromInputs();
  state.clips = [];
  saveState();
  renderClips();

  const queries = searchQueries();
  const runs = [
    ...queries.exact.map((term) => ["exact", term]),
    ...queries.related.map((term) => ["related", term]),
  ];

  setClipStatus("Starting strict search...");
  for (const [, term] of runs) {
    const sources = [["Wikimedia Commons", searchCommons]];
    if (state.mode !== "public") {
      if (state.pixabay) {
        sources.unshift(["Pixabay", searchPixabay]);
      }
      if (state.pexels) {
        sources.unshift(["Pexels", searchPexels]);
      }
    }

    for (const [name, searcher] of sources) {
      try {
        setClipStatus(`Searching ${name}: ${term}`);
        const results = await searcher(term, many);
        if (results.length) {
          addResults(results);
        }
      } catch (error) {
        // Keep searching other sources.
      }
    }
  }

  const exactCount = state.clips.filter((clip) => clip.match === "exact").length;
  const relatedCount = state.clips.filter((clip) => clip.match === "related").length;
  setClipStatus(`${exactCount} exact, ${relatedCount} related loaded`);
  toast(state.clips.length ? "Strict search finished." : "No relevant clips found. Add better scene words or a stock key.");
}

function addClip(index) {
  const clip = state.clips[index];
  if (!clip) {
    return;
  }
  state.timeline.push(clip);
  saveState();
  renderTimeline();
  renderPostPackage();
  toast("Clip added");
}

function ensurePreviewModal() {
  if ($("#clipModal")) {
    return;
  }
  const modal = document.createElement("div");
  modal.id = "clipModal";
  modal.innerHTML = `
    <div class="modal-card">
      <button class="modal-close" id="closeModal" type="button">x</button>
      <video id="modalVideo" controls playsinline></video>
      <div class="box" id="modalInfo"></div>
      <div class="two">
        <button class="btn primary" id="modalAdd" type="button">Add clip</button>
        <a class="btn secondary" id="modalSource" target="_blank" rel="noreferrer">Source</a>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  $("#closeModal").onclick = closePreview;
  modal.onclick = (event) => {
    if (event.target.id === "clipModal") {
      closePreview();
    }
  };
}

function openPreview(index) {
  const clip = state.clips[index];
  if (!clip) {
    return;
  }
  ensurePreviewModal();
  $("#modalVideo").src = clip.videoUrl;
  $("#modalVideo").play().catch(() => {});
  $("#modalInfo").textContent = `${clip.match === "exact" ? "Exact subject match" : "Related B-roll"}\n${clip.source}\nLicense: ${
    clip.license
  }\nTopic: ${clip.tags}`;
  $("#modalSource").href = clip.pageUrl;
  $("#modalAdd").onclick = () => {
    addClip(index);
    closePreview();
  };
  $("#clipModal").classList.add("show");
}

function closePreview() {
  const modalVideo = $("#modalVideo");
  const modal = $("#clipModal");
  if (modalVideo) {
    modalVideo.pause();
    modalVideo.removeAttribute("src");
  }
  if (modal) {
    modal.classList.remove("show");
  }
}

function renderClips() {
  const grid = $("#clipGrid");
  if (!grid) {
    return;
  }

  if ($("#clipCount") && !state.clips.length) {
    $("#clipCount").textContent = "0 clips loaded";
  }

  grid.innerHTML = "";
  if (!state.clips.length) {
    grid.innerHTML =
      '<div class="box">No clips loaded. Exact clips must contain your subject. Related B-roll must match your scene words. Random archive footage is off.</div>';
    return;
  }

  const exactClips = state.clips.filter((clip) => clip.match === "exact");
  const relatedClips = state.clips.filter((clip) => clip.match === "related");

  if (!exactClips.length && relatedClips.length) {
    const notice = document.createElement("div");
    notice.className = "box";
    notice.textContent =
      "No exact legal clip found for this subject. Showing related B-roll only so the app does not fake a match.";
    grid.appendChild(notice);
  }

  const groups = [
    ["EXACT TOPIC", exactClips],
    ["RELATED B-ROLL", relatedClips],
  ];

  groups.forEach(([label, clips]) => {
    if (!clips.length) {
      return;
    }

    const heading = document.createElement("div");
    heading.className = "box";
    heading.textContent = `${label} · ${clips.length} clips`;
    grid.appendChild(heading);

    clips.forEach((clip) => {
      const index = state.clips.indexOf(clip);
      const card = document.createElement("article");
      card.className = "clip";
      card.innerHTML = `
        <div class="thumb"><video muted playsinline preload="metadata" src="${clip.previewUrl}"></video></div>
        <strong>${label} · ${escapeHtml(clip.source)}</strong>
        <small>License: ${escapeHtml(clip.license)}</small>
        <small>Topic: ${escapeHtml((clip.tags || "").slice(0, 100))}</small>
        <div class="row">
          <button type="button" data-preview="${index}">Preview</button>
          <button type="button" data-add="${index}">Add</button>
        </div>
        <a href="${clip.pageUrl}" target="_blank" rel="noreferrer">Source</a>
      `;
      grid.appendChild(card);
    });
  });

  $$("[data-preview]", grid).forEach((button) => {
    button.onclick = () => openPreview(Number(button.dataset.preview));
  });
  $$("[data-add]", grid).forEach((button) => {
    button.onclick = () => addClip(Number(button.dataset.add));
  });
  $$(".clip", grid).forEach((card) => {
    card.onclick = (event) => {
      if (!event.target.closest("button,a")) {
        const button = $("[data-preview]", card);
        if (button) {
          openPreview(Number(button.dataset.preview));
        }
      }
    };
  });
}

function renderTimeline() {
  const timeline = $("#timeline");
  if (!timeline) {
    return;
  }

  const timelineCount = $("#timelineCount");
  if (timelineCount) {
    timelineCount.textContent = `${state.timeline.length} clips selected. Final length: ${state.length} seconds.`;
  }

  timeline.innerHTML = "";
  if (!state.timeline.length) {
    timeline.innerHTML = '<div class="box">No clips added yet.</div>';
    return;
  }

  state.timeline.forEach((clip, index) => {
    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <div>
        <strong>Clip ${index + 1} · ${escapeHtml(clip.source)}</strong>
        <small>${escapeHtml(clip.license)}</small>
        <small>${escapeHtml(clip.pageUrl)}</small>
      </div>
      <button type="button" data-remove="${index}">×</button>
    `;
    timeline.appendChild(item);
  });

  $$("[data-remove]", timeline).forEach((button) => {
    button.onclick = () => {
      state.timeline.splice(Number(button.dataset.remove), 1);
      saveState();
      renderTimeline();
      renderPostPackage();
    };
  });
}

function wrapText(context, text, x, y, width, lineHeight, maxLines) {
  const words = text.split(" ");
  let line = "";
  const lines = [];

  for (const word of words) {
    const testLine = `${line}${word} `;
    if (context.measureText(testLine).width > width && line) {
      lines.push(line.trim());
      line = `${word} `;
    } else {
      line = testLine;
    }
  }
  lines.push(line.trim());

  lines.slice(0, maxLines).forEach((entry, index) => {
    context.fillText(entry, x, y + index * lineHeight);
  });
}

function drawVideoFrame(context, video, x, y, width, height) {
  const videoWidth = video.videoWidth || 720;
  const videoHeight = video.videoHeight || 1280;
  const scale = Math.max(width / videoWidth, height / videoHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  context.drawImage(
    video,
    (videoWidth - sourceWidth) / 2,
    (videoHeight - sourceHeight) / 2,
    sourceWidth,
    sourceHeight,
    x,
    y,
    width,
    height
  );
}

function loadVideo(url) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    video.onloadeddata = () => resolve(video);
    video.onerror = reject;
  });
}

async function renderVideo() {
  syncFromInputs();

  const canvas = $("#canvas");
  const context = canvas ? canvas.getContext("2d") : null;
  const duration = state.length;
  if (!canvas || !context || !canvas.captureStream || !window.MediaRecorder) {
    toast("This browser cannot render video.");
    return;
  }

  const loadedVideos = [];
  try {
    for (const clip of state.timeline) {
      loadedVideos.push(await loadVideo(clip.videoUrl));
    }
  } catch (error) {
    // Continue and render with the fallback background.
  }

  const recorder = new MediaRecorder(canvas.captureStream(24), {
    mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm",
  });
  const chunks = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size) {
      chunks.push(event.data);
    }
  };

  const finished = new Promise((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
  });

  recorder.start();
  const startedAt = performance.now();

  function frame(now) {
    const elapsed = Math.min((now - startedAt) / 1000, duration);
    const topBand = 430;
    const bottomBand = 110;

    context.fillStyle = "#050505";
    context.fillRect(0, 0, 720, 1280);
    if (loadedVideos.length) {
      const clipIndex = Math.min(loadedVideos.length - 1, Math.floor(elapsed / (duration / loadedVideos.length || 1)));
      const video = loadedVideos[clipIndex];
      try {
        video.currentTime = elapsed % Math.max(video.duration || 4, 1);
        drawVideoFrame(context, video, 0, topBand, 720, 1280 - topBand - bottomBand);
      } catch (error) {
        context.fillStyle = "#1f6fb6";
        context.fillRect(0, topBand, 720, 1280 - topBand - bottomBand);
      }
    } else {
      context.fillStyle = "#1f6fb6";
      context.fillRect(0, topBand, 720, 1280 - topBand - bottomBand);
    }

    context.fillStyle = "#030303";
    context.fillRect(0, 0, 720, topBand);
    context.fillStyle = "#18f038";
    context.font = "900 56px -apple-system,Segoe UI,sans-serif";
    context.textAlign = "center";
    context.fillText("DID YOU KNOW?", 360, 82);

    context.fillStyle = "white";
    context.font = "900 35px -apple-system,Segoe UI,sans-serif";
    wrapText(context, clean(state.fact), 360, 137, 660, 39, 7);

    context.fillStyle = "#050505";
    context.fillRect(0, 1170, 720, 110);
    context.fillStyle = "white";
    context.font = "bold 29px -apple-system,Segoe UI,sans-serif";
    context.textAlign = "left";
    context.fillText("@FactPulse", 28, 1215);
    context.font = "bold 25px -apple-system,Segoe UI,sans-serif";
    context.fillText(postTitle().slice(0, 38), 28, 1256);

    const progress = $("#progress");
    if (progress) {
      progress.style.width = `${(elapsed / duration) * 100}%`;
    }

    if (elapsed < duration) {
      requestAnimationFrame(frame);
    } else {
      recorder.stop();
    }
  }

  requestAnimationFrame(frame);
  lastRenderedBlob = await finished;
  const url = URL.createObjectURL(lastRenderedBlob);
  const output = $("#videoOut");
  if (output) {
    output.innerHTML = `<video controls playsinline src="${url}"></video><a class="btn primary" href="${url}" download="factpulse-short.webm" style="margin-top:10px">Download styled video</a>`;
  }
  toast("Styled video rendered");
}

function editPack() {
  syncFromInputs();
  return {
    title: postTitle(),
    voiceover: voiceoverText(),
    description: clean(state.fact),
    clips: state.timeline,
  };
}

function downloadBlob(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function ensureModalStyles() {
  if ($("#modalStyle")) {
    return;
  }
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

async function apiGet(path) {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}.`);
  }
  return response.json();
}

async function apiPost(path, payload) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}.`);
  }
  return response.json();
}

function integrationOutputText(result) {
  const chunks = [];
  if (result.parsed) {
    chunks.push(JSON.stringify(result.parsed, null, 2));
  }
  if (result.summary) {
    chunks.push(JSON.stringify(result.summary, null, 2));
  }
  if (result.stdout) {
    chunks.push(result.stdout.trim());
  }
  if (result.stderr) {
    chunks.push(`STDERR:\n${result.stderr.trim()}`);
  }
  return chunks.filter(Boolean).join("\n\n") || JSON.stringify(result, null, 2);
}

function setIntegrationOutput(text) {
  const node = $("#integrationOutput");
  if (node) {
    node.textContent = text;
  }
}

function formatSeconds(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) {
    return "off";
  }
  if (value < 60) {
    return `${Math.round(value)}s`;
  }
  if (value < 3600) {
    return `${Math.round(value / 60)}m`;
  }
  return `${Math.round(value / 3600)}h`;
}

function formatTimestamp(value) {
  if (!value) {
    return "n/a";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function renderIntegrationStatus(status) {
  integrationStatusCache = status;
  const node = $("#integrationStatus");
  if (!node) {
    return;
  }
  const accountLines = (status.youtube_accounts || [])
    .map((account) => `- ${account.name}${account.enabled ? "" : " (disabled)"}`)
    .join("\n") || "- none";
  const daemon = status.forge_daemon || {};
  const daemonState = !status.forge_config_exists
    ? "not configured"
    : daemon.running
      ? "running"
      : daemon.exists
        ? daemon.state || "stopped"
        : "not started";
  const onlineState = daemon.online_enabled
    ? `${formatSeconds(daemon.online_interval_seconds)} (${daemon.online_approval || "report-only"})`
    : "off";

  node.textContent = [
    `Forge bot: ${status.forge_bot_exists ? "ready" : "missing"}`,
    `Forge bot config: ${status.forge_config_exists ? "found" : "missing"}`,
    `Forge bot daemon: ${daemonState}`,
    `Forge bot online cycle: ${onlineState}`,
    `Forge bot last heartbeat: ${formatTimestamp(daemon.timestamp)}`,
    `Uploader script: ${status.uploader_script_exists ? "ready" : "missing"}`,
    `Uploader venv python: ${status.uploader_python_exists ? "ready" : "missing"}`,
    `Generated videos dir: ${status.generated_videos_dir_exists ? "found" : "missing"}`,
    `Manifest: ${status.manifest_exists ? "found" : "missing"}`,
    `Workspace uploader env: ${status.env_exists ? "found" : "missing"}`,
    `Tracked YouTube uploads: ${status.youtube_upload_count}`,
    "",
    "YouTube accounts:",
    accountLines,
  ].join("\n");

  const select = $("#youtubeAccount");
  populateYouTubeAccountSelect("youtubeAccount", "Auto rotation / due account");
  populateYouTubeAccountSelect("renderYoutubeAccount", "youtube-main / first enabled account");
}

function populateYouTubeAccountSelect(id, defaultLabel) {
  const select = document.getElementById(id);
  if (!select) {
    return;
  }
  const current = select.value;
  select.innerHTML = "";
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = defaultLabel;
  select.appendChild(defaultOption);
  (integrationStatusCache?.youtube_accounts || []).forEach((account) => {
    const option = document.createElement("option");
    option.value = account.name;
    option.textContent = account.name;
    select.appendChild(option);
  });
  if ([...select.options].some((option) => option.value === current)) {
    select.value = current;
  }
}

async function refreshIntegrationStatus() {
  const statusNode = $("#integrationStatus");
  if (!statusNode) {
    return;
  }
  statusNode.textContent = "Loading integration status...";
  try {
    const status = await apiGet("/api/status");
    renderIntegrationStatus(status);
    setIntegrationOutput("Integration server ready.");
  } catch (error) {
    statusNode.textContent =
      "Integration server not reachable. Start it with `python3 app_server.py` in this folder, then refresh.";
    setIntegrationOutput(String(error));
  }
}

function toggleBusy(ids, disabled) {
  ids.forEach((id) => {
    const node = document.getElementById(id);
    if (node) {
      node.disabled = disabled;
    }
  });
}

async function runForgeInspect() {
  const prompt = clean($("#botPrompt") ? $("#botPrompt").value : "") || "Inspect the current YouTube app workspace.";
  const buttons = ["botInspect", "botFix", "bot24x7", "ytDryRun", "ytUploadNext", "refreshIntegration"];
  toggleBusy(buttons, true);
  setIntegrationOutput("Running Python bot inspect...");
  try {
    const result = await apiPost("/api/forge/inspect", { prompt });
    renderIntegrationStatus(result.status || integrationStatusCache || {});
    setIntegrationOutput(integrationOutputText(result));
    toast(result.ok ? "Python bot inspect finished." : "Python bot inspect returned warnings.");
  } catch (error) {
    setIntegrationOutput(String(error));
    toast("Python bot inspect failed.");
  } finally {
    toggleBusy(buttons, false);
  }
}

async function runForgeFix() {
  if (!window.confirm("Apply safe fixes in this workspace with the Python bot?")) {
    return;
  }
  const prompt = clean($("#botPrompt") ? $("#botPrompt").value : "") || "Apply safe fixes to the current YouTube app workspace.";
  const buttons = ["botInspect", "botFix", "bot24x7", "ytDryRun", "ytUploadNext", "refreshIntegration"];
  toggleBusy(buttons, true);
  setIntegrationOutput("Running Python bot fix...");
  try {
    const result = await apiPost("/api/forge/fix", {
      prompt,
      apply: true,
      diff: true,
    });
    renderIntegrationStatus(result.status || integrationStatusCache || {});
    setIntegrationOutput(integrationOutputText(result));
    toast(result.ok ? "Python bot safe fixes finished." : "Python bot safe fixes returned warnings.");
  } catch (error) {
    setIntegrationOutput(String(error));
    toast("Python bot safe fixes failed.");
  } finally {
    toggleBusy(buttons, false);
  }
}

function selectedAccount() {
  const select = $("#youtubeAccount");
  return clean(select ? select.value : "");
}

async function enableForge24x7() {
  const prompt =
    clean($("#botPrompt") ? $("#botPrompt").value : "") ||
    "Keep this YouTube app healthy, tighten clip relevance, apply safe fixes, and run conservative online checks.";
  const buttons = ["botInspect", "botFix", "bot24x7", "ytDryRun", "ytUploadNext", "refreshIntegration"];
  toggleBusy(buttons, true);
  setIntegrationOutput("Installing the 24/7 Forge bot launch agent...");
  try {
    const result = await apiPost("/api/forge/daemon/install", { prompt });
    renderIntegrationStatus(result.status || integrationStatusCache || {});
    setIntegrationOutput(integrationOutputText(result));
    toast(result.ok ? "24/7 Forge bot enabled." : "24/7 Forge bot returned warnings.");
  } catch (error) {
    setIntegrationOutput(String(error));
    toast("24/7 Forge bot install failed.");
  } finally {
    toggleBusy(buttons, false);
  }
}

async function runYouTubeDryRun() {
  const buttons = ["botInspect", "botFix", "bot24x7", "ytDryRun", "ytUploadNext", "refreshIntegration"];
  toggleBusy(buttons, true);
  setIntegrationOutput("Running YouTube dry run...");
  try {
    const result = await apiPost("/api/youtube/dry-run", {
      account: selectedAccount(),
      limit: 1,
      force: true,
    });
    renderIntegrationStatus(result.status || integrationStatusCache || {});
    setIntegrationOutput(integrationOutputText(result));
    toast(result.ok ? "Dry run finished." : "Dry run finished with warnings.");
  } catch (error) {
    setIntegrationOutput(String(error));
    toast("YouTube dry run failed.");
  } finally {
    toggleBusy(buttons, false);
  }
}

async function runYouTubeUploadNext() {
  if (!window.confirm("Upload the next due YouTube video with the local uploader runtime?")) {
    return;
  }
  const buttons = ["botInspect", "botFix", "bot24x7", "ytDryRun", "ytUploadNext", "refreshIntegration"];
  toggleBusy(buttons, true);
  setIntegrationOutput("Uploading the next YouTube video...");
  try {
    const result = await apiPost("/api/youtube/upload-next", {
      account: selectedAccount(),
      max_new: 1,
    });
    renderIntegrationStatus(result.status || integrationStatusCache || {});
    setIntegrationOutput(integrationOutputText(result));
    toast(result.ok ? "YouTube upload command finished." : "YouTube upload returned warnings.");
  } catch (error) {
    setIntegrationOutput(String(error));
    toast("YouTube upload failed.");
  } finally {
    toggleBusy(buttons, false);
  }
}

function renderUploadStatusText(result) {
  const parts = [];
  if (result.parsed) {
    parts.push(JSON.stringify(result.parsed, null, 2));
  }
  if (result.saved_file) {
    parts.push(`Saved file: ${result.saved_file}`);
  }
  if (result.stdout) {
    parts.push(result.stdout.trim());
  }
  if (result.stderr) {
    parts.push(`STDERR:\n${result.stderr.trim()}`);
  }
  return parts.filter(Boolean).join("\n\n") || JSON.stringify(result, null, 2);
}

function setRenderUploadStatus(text) {
  const node = $("#renderUploadStatus");
  if (node) {
    node.textContent = text;
  }
}

function selectedRenderAccount() {
  const select = $("#renderYoutubeAccount");
  return clean(select ? select.value : "");
}

async function uploadRenderedVideo(dryRun) {
  if (!lastRenderedBlob) {
    toast("Render a video first.");
    return;
  }

  if (!dryRun && !window.confirm("Upload the rendered video to YouTube now?")) {
    return;
  }

  const buttons = ["previewRenderedUpload", "uploadRenderedVideo", "renderBtn", "downloadPack"];
  toggleBusy(buttons, true);
  setRenderUploadStatus(dryRun ? "Previewing rendered upload..." : "Uploading rendered video to YouTube...");

  try {
    const response = await fetch(`${API_BASE}/api/render/upload-youtube`, {
      method: "POST",
      headers: {
        "Content-Type": lastRenderedBlob.type || "video/webm",
        "X-Upload-Filename": `${safeBrowserSlug(postTitle())}.webm`,
        "X-Upload-Title": postTitle(),
        "X-Upload-Description": currentYouTubeDescription(),
        "X-Upload-Account": selectedRenderAccount(),
        "X-Dry-Run": dryRun ? "true" : "false",
      },
      body: lastRenderedBlob,
    });
    if (!response.ok) {
      throw new Error(`Rendered upload request failed with status ${response.status}.`);
    }
    const result = await response.json();
    renderIntegrationStatus(result.status || integrationStatusCache || {});
    setRenderUploadStatus(renderUploadStatusText(result));
    if (result.parsed?.youtube_url) {
      toast("Rendered video uploaded.");
    } else {
      toast(dryRun ? "Rendered upload preview ready." : "Rendered upload request finished.");
    }
  } catch (error) {
    setRenderUploadStatus(String(error));
    toast(dryRun ? "Rendered upload preview failed." : "Rendered upload failed.");
  } finally {
    toggleBusy(buttons, false);
  }
}

function safeBrowserSlug(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "rendered-video";
}

function bindEvents() {
  ensureModalStyles();
  $$("[data-nav]").forEach((link) => {
    link.classList.toggle("active", link.dataset.nav === (document.body.dataset.page || "create"));
  });

  if ($("#factForm")) {
    $("#factForm").onsubmit = (event) => {
      event.preventDefault();
      syncFromInputs();
      state.clips = [];
      saveState();
      location.href = "clips-v15.html";
    };
  }

  if ($("#autoFill")) {
    $("#autoFill").onclick = wikiFill;
  }
  if ($("#searchClips")) {
    $("#searchClips").onclick = () => searchClips(false);
  }
  if ($("#searchMany")) {
    $("#searchMany").onclick = () => searchClips(true);
  }
  if ($("#renderBtn")) {
    $("#renderBtn").onclick = renderVideo;
  }
  if ($("#copyPost")) {
    $("#copyPost").onclick = async () => {
      syncFromInputs();
      try {
        await navigator.clipboard.writeText($("#postBox").textContent);
        toast("Copied");
      } catch (error) {
        toast("Copy failed.");
      }
    };
  }
  if ($("#downloadPack")) {
    $("#downloadPack").onclick = () =>
      downloadBlob("factpulse-edit-pack.json", JSON.stringify(editPack(), null, 2), "application/json");
  }

  ["subject", "fact", "scene", "details", "length", "licenseMode", "pixabayKey", "pexelsKey"].forEach((id) => {
    const element = document.getElementById(id);
    if (!element) {
      return;
    }
    const handler = () => syncFromInputs({ clearClips: true });
    element.addEventListener("input", handler);
    if (id === "licenseMode") {
      element.addEventListener("change", handler);
    }
  });

  if ($("#botPrompt") && !$("#botPrompt").value) {
    $("#botPrompt").value = "Inspect the current YouTube app workspace and suggest safe fixes.";
  }
  if ($("#refreshIntegration")) {
    $("#refreshIntegration").onclick = refreshIntegrationStatus;
  }
  if ($("#botInspect")) {
    $("#botInspect").onclick = runForgeInspect;
  }
  if ($("#botFix")) {
    $("#botFix").onclick = runForgeFix;
  }
  if ($("#bot24x7")) {
    $("#bot24x7").onclick = enableForge24x7;
  }
  if ($("#ytDryRun")) {
    $("#ytDryRun").onclick = runYouTubeDryRun;
  }
  if ($("#ytUploadNext")) {
    $("#ytUploadNext").onclick = runYouTubeUploadNext;
  }
  if ($("#previewRenderedUpload")) {
    $("#previewRenderedUpload").onclick = () => uploadRenderedVideo(true);
  }
  if ($("#uploadRenderedVideo")) {
    $("#uploadRenderedVideo").onclick = () => uploadRenderedVideo(false);
  }
}

loadState();
bindEvents();
renderPlan();
renderClips();
renderTimeline();
renderPostPackage();
if ($("#integrationStatus")) {
  refreshIntegrationStatus();
}
if ($("#renderYoutubeAccount") && !$("#integrationStatus")) {
  refreshIntegrationStatus();
}
