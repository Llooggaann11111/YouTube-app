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
  resolvedSubject: "",
  clips: [],
  timeline: [],
};

let lastRenderedBlob = null;
let integrationStatusCache = null;

const SEARCH_STOP_WORDS = new Set([
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
  "official",
  "video",
  "clip",
  "stock",
  "footage",
  "background",
  "broll",
  "roll",
]);

const PERSON_WORD_RE =
  /\b(inventor|scientist|engineer|physicist|chemist|mathematician|artist|writer|president|king|queen|actor|founder|born|died|biography|portrait|professor|activist|athlete|singer|composer|entrepreneur|leader|explorer)\b/;

const PERSON_VISUAL_ANCHORS = [
  "portrait",
  "photo",
  "photograph",
  "image",
  "biography",
  "documentary",
  "archive",
  "archival",
  "museum",
  "laboratory",
  "lab",
  "experiment",
  "research",
  "inventor",
  "scientist",
  "engineer",
  "physicist",
  "electricity",
  "electrical",
  "invention",
  "equipment",
  "demonstration",
  "coil",
  "current",
  "power",
  "motor",
  "wireless",
  "radio",
  "historic",
  "historical",
  "memorial",
  "statue",
  "reenactment",
];

const PERSON_BAD_MEDIA_TERMS = [
  "streamyard",
  "webinar",
  "podcast",
  "livestream",
  "live stream",
  "zoom",
  "meeting",
  "conference call",
  "panel discussion",
  "talk show",
  "talking head",
  "webcam",
  "video call",
  "online event",
  "host",
  "guest",
  "episode",
  "reaction",
];

const KNOWN_PERSON_SUBJECTS = [
  "Nikola Tesla",
  "Albert Einstein",
  "Isaac Newton",
  "Marie Curie",
  "Ada Lovelace",
  "Alan Turing",
  "Thomas Edison",
  "Alexander Graham Bell",
  "Leonardo da Vinci",
  "Galileo Galilei",
  "Martin Luther King Jr",
  "Abraham Lincoln",
  "George Washington",
  "Rosa Parks",
  "Amelia Earhart",
  "Walt Disney",
  "Steve Jobs",
  "Elon Musk",
  "Michael Jordan",
  "Cristiano Ronaldo",
  "Lionel Messi",
  "Taylor Swift",
  "Beyonce",
  "Oprah Winfrey",
  "Cleopatra",
  "Julius Caesar",
  "Napoleon Bonaparte",
  "Queen Elizabeth II",
  "Barack Obama",
  "Joe Biden",
  "Donald Trump",
];

const SUBJECT_ALIASES = new Map([
  ["nikola tasla", "Nikola Tesla"],
  ["nicola tesla", "Nikola Tesla"],
  ["nikola telsa", "Nikola Tesla"],
  ["nikola tesler", "Nikola Tesla"],
  ["albert einstien", "Albert Einstein"],
  ["issac newton", "Isaac Newton"],
  ["marry curie", "Marie Curie"],
  ["thomas edisonn", "Thomas Edison"],
]);

const KNOWN_PERSON_PROFILES = new Map([
  [
    "nikola tesla",
    {
      description: "Serbian-American inventor, electrical engineer, and futurist",
      fact:
        "Nikola Tesla was a Serbian-American inventor and electrical engineer known for his work on alternating current power systems. His experiments helped shape modern electricity, motors, radio, and wireless energy ideas.",
      scene: "inventor laboratory electricity invention machine experiment alternating current",
      details: "inventor, electricity, alternating current, laboratory, experiment, wireless power, induction motor",
    },
  ],
  [
    "albert einstein",
    {
      description: "theoretical physicist",
      fact:
        "Albert Einstein was a theoretical physicist best known for the theory of relativity and the equation E = mc2. His work changed modern physics and helped explain space, time, energy, and gravity.",
      scene: "physicist chalkboard science equations research lecture",
      details: "physicist, relativity, equations, science, research, lecture, chalkboard",
    },
  ],
]);

const NON_PERSON_TOPIC_WORDS = new Set([
  "volcano",
  "eruption",
  "earthquake",
  "storm",
  "weather",
  "ocean",
  "animal",
  "car",
  "phone",
  "telephone",
  "city",
  "building",
  "food",
  "recipe",
  "money",
  "space",
  "planet",
  "rocket",
  "war",
  "battle",
  "court",
  "trial",
  "case",
]);

function clean(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeWord(word) {
  let token = String(word || "").toLowerCase();
  if (token.endsWith("ies") && token.length > 5) {
    token = `${token.slice(0, -3)}y`;
  } else if (token.endsWith("es") && token.length > 5) {
    token = token.slice(0, -2);
  } else if (token.endsWith("s") && token.length > 4) {
    token = token.slice(0, -1);
  }
  return token;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
  const words = clean(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map(normalizeWord)
    .filter(
      (word) =>
        word.length > 2 &&
        !SEARCH_STOP_WORDS.has(word)
    )
    .slice(0, 28);
  return Array.from(new Set(words));
}

function titleCase(text) {
  return clean(text)
    .split(" ")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : ""))
    .join(" ");
}

function compactKey(text) {
  return keywordList(text).join("");
}

function editDistance(left, right, max = 4) {
  const a = String(left || "");
  const b = String(right || "");
  if (Math.abs(a.length - b.length) > max) {
    return max + 1;
  }
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let row = 1; row <= a.length; row += 1) {
    current[0] = row;
    let best = current[0];
    for (let column = 1; column <= b.length; column += 1) {
      const cost = a[row - 1] === b[column - 1] ? 0 : 1;
      current[column] = Math.min(previous[column] + 1, current[column - 1] + 1, previous[column - 1] + cost);
      best = Math.min(best, current[column]);
    }
    if (best > max) {
      return max + 1;
    }
    for (let column = 0; column <= b.length; column += 1) {
      previous[column] = current[column];
    }
  }
  return previous[b.length];
}

function bestKnownSubjectMatch(subject) {
  const typed = clean(subject);
  const lowered = typed.toLowerCase();
  if (!typed) {
    return "";
  }
  if (SUBJECT_ALIASES.has(lowered)) {
    return SUBJECT_ALIASES.get(lowered);
  }

  const typedTokens = keywordList(typed);
  if (typedTokens.length < 2) {
    return "";
  }

  const typedKey = compactKey(typed);
  let best = "";
  let bestDistance = 99;
  KNOWN_PERSON_SUBJECTS.forEach((candidate) => {
    const candidateTokens = keywordList(candidate);
    const candidateKey = compactKey(candidate);
    const wholeDistance = editDistance(typedKey, candidateKey, 3);
    const firstMatches = typedTokens[0] === candidateTokens[0] || editDistance(typedTokens[0], candidateTokens[0], 1) <= 1;
    const lastDistance = editDistance(typedTokens[typedTokens.length - 1], candidateTokens[candidateTokens.length - 1], 2);
    const distance = Math.min(wholeDistance, firstMatches ? lastDistance : 99);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  });

  return bestDistance <= 2 ? best : "";
}

function canonicalSubject() {
  return clean(state.resolvedSubject) || bestKnownSubjectMatch(state.subject) || clean(state.subject);
}

function looksLikePersonSubject() {
  const subject = canonicalSubject();
  const tokens = keywordList(subject);
  const hasNonPersonWord = tokens.some((token) => NON_PERSON_TOPIC_WORDS.has(token));
  return tokens.length >= 2 && !hasNonPersonWord && /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+|(?:\s+[A-Z][a-z]+){2,})/.test(titleCase(subject));
}

function postTitle() {
  return (titleCase(canonicalSubject() || keywordList(state.fact).slice(0, 4).join(" ") || "Fact") + " Fact")
    .toUpperCase()
    .slice(0, 70);
}

function autoSceneText(text) {
  const lowered = clean(text).toLowerCase();
  const mappings = [
    ["court", "courtroom judge lawyer courthouse hearing documents"],
    ["speech", "speech podium microphone crowd"],
    ["inventor", "inventor laboratory electricity invention machine experiment"],
    ["scientist", "scientist laboratory experiment research equipment"],
    ["science", "science laboratory microscope experiment research"],
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
  return keywordList(canonicalSubject());
}

function detailTokens() {
  return mergedKeywords(state.details, state.fact).slice(0, 12);
}

function sceneTokens() {
  const scene = clean(state.scene);
  if (scene) {
    return keywordList(scene).slice(0, 10);
  }
  if (looksLikePersonSubject() && !clean(state.fact) && !clean(state.details)) {
    return keywordList("portrait biography documentary archive museum interview laboratory research").slice(0, 10);
  }
  return keywordList(autoSceneText(`${canonicalSubject()} ${state.fact}`)).slice(0, 10);
}

function visualContextTokens() {
  const subject = new Set(subjectTokens());
  return mergedKeywords(state.scene, state.details, state.fact)
    .filter((token) => !subject.has(token))
    .filter((token) => !["known", "topic", "detail", "context", "fact"].includes(token))
    .slice(0, 14);
}

function isPersonLikeSubject() {
  const fact = clean(`${canonicalSubject()} ${state.fact} ${state.details}`).toLowerCase();
  return (
    looksLikePersonSubject() ||
    PERSON_WORD_RE.test(fact)
  );
}

function forbiddenContextTerms() {
  const context = new Set(mergedKeywords(canonicalSubject(), state.subject, state.fact, state.scene, state.details));
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
    {
      allow: ["car", "vehicle", "traffic", "road", "driving", "automotive"],
      block: ["car", "vehicle", "automotive", "cybertruck", "autopilot", "dealership", "driver", "driving", "traffic"],
    },
    {
      allow: ["music", "singer", "concert", "song", "album"],
      block: ["lyrics", "karaoke", "cover song", "music video"],
    },
    {
      allow: ["telephone", "phone", "smartphone", "cellphone", "mobile", "call", "communication"],
      block: ["telephone", "phone", "smartphone", "cellphone", "mobile phone", "handset", "dialing", "call center"],
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
  const subject = canonicalSubject();
  const scenePhrase = sceneTokens().slice(0, 5).join(" ");
  const visualPhrase = visualContextTokens().slice(0, 5).join(" ");
  const detailPhrase = detailTokens().slice(0, 5).join(" ");
  const exact = Array.from(
    new Set(
      [
        subject,
        subject && detailPhrase ? `${subject} ${detailTokens().slice(0, 3).join(" ")}` : "",
        isPersonLikeSubject() && subject ? `${subject} biography documentary` : "",
        isPersonLikeSubject() && subject ? `${subject} portrait laboratory` : "",
      ]
        .map(clean)
        .filter(Boolean)
    )
  ).slice(0, 4);
  const relatedSeed = isPersonLikeSubject()
    ? [
        `${subject} ${scenePhrase}`,
        visualPhrase,
        `${visualContextTokens().slice(0, 3).join(" ")} laboratory experiment`,
        `${scenePhrase} research equipment close up`,
        `${scenePhrase} documentary reenactment`,
      ]
    : [
        `${subject} ${scenePhrase}`,
        scenePhrase,
        visualPhrase,
        `${scenePhrase} close up`,
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
  if (state.clips.length) {
    classifyClips(state.clips);
  }
  if (state.timeline.length) {
    state.timeline = state.timeline.filter((clip) => subjectMatch(clip) || sceneMatch(clip));
  }
}

function syncFromInputs(options = {}) {
  const { write = true, clearClips = false } = options;
  const previousSubject = clean(state.subject);
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

  if (clean(state.subject) !== previousSubject && clean(state.subject) !== clean(state.resolvedSubject)) {
    state.resolvedSubject = "";
  }
  state.length = Math.min(45, Math.max(25, Number(state.length) || 30));
  if (clearClips) {
    state.clips = [];
    state.timeline = [];
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
  const correction = canonicalSubject() && clean(state.subject) !== canonicalSubject() ? [`Using corrected subject: ${canonicalSubject()}`, ""] : [];
  node.textContent = [
    ...correction,
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

function sceneMostlySubject(scene, subject) {
  const sceneWords = keywordList(scene);
  const subjectWords = new Set(keywordList(subject));
  return sceneWords.length > 0 && sceneWords.every((word) => subjectWords.has(word));
}

function shouldAcceptWikiTitle(input, title, summary = {}) {
  const inputTokens = keywordList(input);
  const titleTokens = keywordList(title);
  if (!inputTokens.length || !titleTokens.length) {
    return false;
  }
  const inputKey = inputTokens.join("");
  const titleKey = titleTokens.join("");
  const tokenOverlap = inputTokens.filter((token) => titleTokens.some((titleToken) => editDistance(token, titleToken, 2) <= 2));
  const summaryText = clean(`${summary.title || ""} ${summary.description || ""} ${summary.extract || ""}`).toLowerCase();
  const personish = inputTokens.length >= 2 || PERSON_WORD_RE.test(summaryText);

  return (
    personish &&
    (tokenOverlap.length >= Math.min(2, inputTokens.length) || editDistance(inputKey, titleKey, 4) <= 4)
  );
}

async function resolveSubjectWithWikipedia(subject) {
  const searchResponse = await fetchTimeout(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      subject
    )}&format=json&origin=*`,
    {},
    8000
  );
  if (!searchResponse.ok) {
    return null;
  }
  const searchJson = await searchResponse.json();
  const hits = (searchJson.query && searchJson.query.search) || [];
  for (const hit of hits.slice(0, 5)) {
    const summaryResponse = await fetchTimeout(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title)}`,
      {},
      8000
    );
    const summaryJson = summaryResponse.ok ? await summaryResponse.json() : {};
    if (shouldAcceptWikiTitle(subject, hit.title, summaryJson)) {
      return { title: hit.title, summary: summaryJson };
    }
  }
  return null;
}

function applyResolvedSubject(title, summaryJson = {}, originalSubject = state.subject) {
  const previousSubject = clean(originalSubject);
  const resolvedTitle = clean(title);
  if (!resolvedTitle) {
    return false;
  }

  const changed = resolvedTitle.toLowerCase() !== previousSubject.toLowerCase();
  const profile = KNOWN_PERSON_PROFILES.get(resolvedTitle.toLowerCase()) || {};
  const description = clean(summaryJson.description || profile.description || "");
  const extract = clean(summaryJson.extract || profile.fact || "");

  state.subject = resolvedTitle;
  state.resolvedSubject = resolvedTitle;
  if (!clean(state.fact) || changed) {
    state.fact =
      extract
        .split(/(?<=[.!?])\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .join(" ") || profile.fact || `${resolvedTitle} is a person with a biography, timeline, and historical context.`;
  }
  if (!clean(state.scene) || changed || sceneMostlySubject(state.scene, previousSubject)) {
    state.scene = profile.scene || autoSceneText(`${resolvedTitle} ${description} ${state.fact}`);
  }
  if (!clean(state.details) || changed) {
    state.details = profile.details || keywordList(`${resolvedTitle} ${description} ${state.fact}`).slice(0, 8).join(", ");
  }
  state.clips = [];
  state.timeline = [];
  applyStateToInputs();
  saveState();
  syncFromInputs({ write: false });
  return changed;
}

async function resolveSubjectBeforeSearch() {
  const typed = clean(state.subject);
  if (!typed) {
    return;
  }

  const known = bestKnownSubjectMatch(typed);
  if (known && known.toLowerCase() !== typed.toLowerCase()) {
    applyResolvedSubject(known, {}, typed);
    toast(`Corrected subject to ${known}.`);
  }

  const lookup = canonicalSubject();
  try {
    const resolved = await resolveSubjectWithWikipedia(typed);
    if (resolved && resolved.title) {
      const changed = applyResolvedSubject(resolved.title, resolved.summary, typed);
      if (changed || clean(resolved.title).toLowerCase() !== lookup.toLowerCase()) {
        toast(`Using ${resolved.title}.`);
      }
    }
  } catch (error) {
    // Offline mode still benefits from local typo aliases and fuzzy scoring.
  }
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
    const known = bestKnownSubjectMatch(subject);
    const resolved = await resolveSubjectWithWikipedia(known || subject);
    if (resolved && resolved.title) {
      applyResolvedSubject(resolved.title, resolved.summary, subject);
    } else if (known) {
      applyResolvedSubject(known, {}, subject);
    } else {
      state.resolvedSubject = "";
      state.fact = `${subject} is a topic with details, timeline, and context.`;
      state.scene = autoSceneText(`${subject} ${state.fact}`);
      state.details = keywordList(`${subject} ${state.fact}`).slice(0, 6).join(", ");
      state.clips = [];
      applyStateToInputs();
      saveState();
      syncFromInputs({ write: false });
    }
    toast("Auto filled.");
  } catch (error) {
    const known = bestKnownSubjectMatch(subject);
    if (known) {
      applyResolvedSubject(known, {}, subject);
      toast(`Corrected to ${known}.`);
    } else {
      toast("Auto fill failed. Type scene words manually.");
    }
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
  return [clip.title, clip.tags, clip.credit, clip.metadata, urlWords(clip.pageUrl)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function hasToken(text, token) {
  return new RegExp(`(^|[^a-z0-9])${escapeRegex(token)}([^a-z0-9]|$)`, "i").test(text);
}

function textTokens(text) {
  return keywordList(text);
}

function hasFuzzyToken(text, token) {
  if (hasToken(text, token)) {
    return true;
  }
  const limit = token.length >= 7 ? 2 : 1;
  return textTokens(text).some((word) => Math.abs(word.length - token.length) <= limit && editDistance(word, token, limit) <= limit);
}

function matchedTokens(tokens, text, options = {}) {
  const matcher = options.fuzzy ? hasFuzzyToken : hasToken;
  return tokens.filter((token) => matcher(text, token));
}

function hasForbiddenTerms(clip) {
  const text = clipText(clip);
  return forbiddenContextTerms().some((term) => {
    const parts = keywordList(term);
    return parts.length > 1 ? text.includes(parts.join(" ")) : hasToken(text, parts[0] || term);
  });
}

function clipHasAnyTerm(clip, terms) {
  const text = clipText(clip);
  return terms.some((term) => {
    const lowered = clean(term).toLowerCase();
    const parts = keywordList(lowered);
    if (lowered.includes(" ")) {
      return text.includes(lowered);
    }
    return hasToken(text, parts[0] || lowered);
  });
}

function personVisualEvidenceScore(clip) {
  const text = clipText(clip);
  return matchedTokens(PERSON_VISUAL_ANCHORS, text).length;
}

function isBadPersonMediaClip(clip) {
  return isPersonLikeSubject() && clipHasAnyTerm(clip, PERSON_BAD_MEDIA_TERMS);
}

function shouldRejectClip(clip) {
  return hasForbiddenTerms(clip) || isBadPersonMediaClip(clip);
}

function personExactHits(tokens, text) {
  if (tokens.length < 2) {
    return matchedTokens(tokens, text, { fuzzy: true }).length;
  }
  const first = tokens[0];
  const last = tokens[tokens.length - 1];
  const hasFirst = hasFuzzyToken(text, first);
  const hasLast = hasFuzzyToken(text, last);
  return hasFirst && hasLast ? tokens.length : matchedTokens(tokens, text, { fuzzy: true }).length;
}

function personAnchorTokens() {
  return Array.from(
    new Set([
      ...PERSON_VISUAL_ANCHORS,
      "lecture",
      "concert",
      "stage",
      "athlete",
      "stadium",
    ])
  );
}

function subjectMatch(clip) {
  const tokens = subjectTokens();
  if (!tokens.length) {
    return false;
  }
  if (shouldRejectClip(clip)) {
    return false;
  }
  const text = clipText(clip);
  const hits = isPersonLikeSubject() ? personExactHits(tokens, text) : matchedTokens(tokens, text).length;
  const fullSubject = clean(state.subject).toLowerCase();
  if (isPersonLikeSubject() && tokens.length >= 2) {
    const canonical = canonicalSubject().toLowerCase();
    const fullNameHit = canonical && text.includes(canonical);
    const visualEvidence = personVisualEvidenceScore(clip);
    return hits >= tokens.length && fullNameHit && visualEvidence >= 1;
  }
  if (fullSubject && text.includes(fullSubject)) {
    return true;
  }
  return tokens.length === 1 ? hits === 1 : hits >= Math.ceil(tokens.length * 0.75);
}

function sceneMatch(clip) {
  const tokens = Array.from(new Set([...sceneTokens(), ...visualContextTokens()])).slice(0, 14);
  if (!tokens.length) {
    return false;
  }
  if (shouldRejectClip(clip)) {
    return false;
  }
  const text = clipText(clip);
  const hits = matchedTokens(tokens, text).length;
  const subjectHits = matchedTokens(subjectTokens(), text, { fuzzy: true }).length;
  const detailHits = matchedTokens(detailTokens(), text).length;
  if (isPersonLikeSubject()) {
    const personContextHits = matchedTokens(personAnchorTokens(), text).length;
    return hits >= Math.min(2, tokens.length) && personContextHits >= 2 && (subjectHits >= 2 || detailHits >= 2 || personContextHits >= 3);
  }
  return hits >= Math.min(2, tokens.length);
}

function clipScore(clip) {
  const text = clipText(clip);
  let score = 0;
  const subjectHits = matchedTokens(subjectTokens(), text, { fuzzy: true });
  const sceneHits = matchedTokens(sceneTokens(), text);
  const detailHits = matchedTokens(detailTokens(), text);
  const visualHits = matchedTokens(visualContextTokens(), text);
  const personVisualHits = isPersonLikeSubject() ? matchedTokens(PERSON_VISUAL_ANCHORS, text) : [];
  score += subjectHits.length * 20;
  score += sceneHits.length * 6;
  score += detailHits.length * 8;
  score += visualHits.length * 7;
  score += personVisualHits.length * 10;
  if (clean(state.subject) && text.includes(clean(state.subject).toLowerCase())) {
    score += 45;
  }
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
  if (Number(clip.width) >= 720 && Number(clip.height) >= 720) {
    score += 8;
  }
  if (Number(clip.duration) >= 6) {
    score += 4;
  }
  if (shouldRejectClip(clip)) {
    score -= 300;
  }
  clip.score = score;
  clip.reason =
    subjectHits.length || sceneHits.length || detailHits.length || visualHits.length || personVisualHits.length
      ? [...subjectHits, ...sceneHits, ...detailHits, ...visualHits, ...personVisualHits].slice(0, 6).join(", ")
      : "source metadata";
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
    .filter((clip) => clipScore(clip) > 0)
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
        width: imageInfo.width || 0,
        height: imageInfo.height || 0,
        duration: 10,
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
        width: file.width || video.videos?.large?.width || 0,
        height: file.height || video.videos?.large?.height || 0,
        duration: video.duration || 0,
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
        width: portraitFile.width || video.width || 0,
        height: portraitFile.height || video.height || 0,
        duration: video.duration || 0,
        license: "Pexels License",
      });
    });
  }

  return results;
}

async function searchClips(many) {
  syncFromInputs();
  await resolveSubjectBeforeSearch();
  state.clips = [];
  state.timeline = [];
  saveState();
  renderClips();
  renderTimeline();
  renderPostPackage();

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
  state.timeline.push(prepareTimelineClip(clip, state.timeline.length, Math.max(1, state.timeline.length + 1)));
  saveState();
  renderTimeline();
  renderPostPackage();
  toast("Clip added");
}

function clipDiversityKey(clip) {
  return keywordList(`${clip.source} ${clip.tags || clip.title || ""}`)
    .slice(0, 3)
    .join("-");
}

function prepareTimelineClip(clip, index, total) {
  const clipLength = Math.max(4, Math.min(7, Math.round(Number(state.length || 30) / Math.max(total, 1))));
  const duration = Math.max(clipLength, Math.min(Number(clip.duration) || clipLength + 2, 30));
  const startTime = Math.max(0, Math.min(Number(clip.startTime || 0), Math.max(0, duration - clipLength)));
  return {
    ...clip,
    startTime,
    clipDuration: clipLength,
    editLabel: index === 0 ? "hook" : index === total - 1 ? "payoff" : "beat",
  };
}

function autoBuildTimeline() {
  syncFromInputs();
  if (!state.clips.length) {
    toast("Find clips first.");
    return;
  }

  const desired = Math.max(4, Math.min(7, Math.round(Number(state.length || 30) / 6)));
  const candidates = [...state.clips]
    .filter((clip) => clip.videoUrl || clip.previewUrl)
    .sort((left, right) => clipScore(right) - clipScore(left));
  const exact = candidates.filter((clip) => clip.match === "exact");
  const related = candidates.filter((clip) => clip.match !== "exact");
  const selected = [];
  const usedIds = new Set();
  const usedKeys = new Set();

  function takeFrom(list, limit) {
    for (const clip of list) {
      if (selected.length >= desired || selected.filter((item) => item.match === clip.match).length >= limit) {
        break;
      }
      const key = clipDiversityKey(clip);
      if (usedIds.has(clip.id) || (usedKeys.has(key) && selected.length < desired - 1)) {
        continue;
      }
      selected.push(clip);
      usedIds.add(clip.id);
      usedKeys.add(key);
    }
  }

  takeFrom(exact, Math.min(2, desired));
  takeFrom(related, desired);
  if (selected.length < Math.min(3, desired)) {
    candidates.forEach((clip) => {
      if (selected.length < desired && !usedIds.has(clip.id)) {
        selected.push(clip);
        usedIds.add(clip.id);
      }
    });
  }

  state.timeline = selected.slice(0, desired).map((clip, index, list) => prepareTimelineClip(clip, index, list.length));
  saveState();
  renderTimeline();
  renderPostPackage();
  toast(state.timeline.length ? "Auto edit built." : "No playable clips found.");
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
        <small>Topic: ${escapeHtml((clip.tags || clip.title || "").slice(0, 100))}</small>
        <small>Matched: ${escapeHtml((clip.reason || "metadata").slice(0, 100))}</small>
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
        <strong>Clip ${index + 1} · ${escapeHtml(clip.editLabel || "beat")} · ${escapeHtml(clip.source)}</strong>
        <small>${escapeHtml(clip.license)}</small>
        <small>${escapeHtml(clip.reason ? `matched ${clip.reason}` : clip.pageUrl)}</small>
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
  const words = clean(text).split(" ");
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
  return lines.slice(0, maxLines);
}

function roundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function fillRounded(context, x, y, width, height, radius, fillStyle) {
  context.fillStyle = fillStyle;
  roundedRect(context, x, y, width, height, radius);
  context.fill();
}

function drawVideoFrame(context, video, x, y, width, height, zoom = 1) {
  const videoWidth = video.videoWidth || 720;
  const videoHeight = video.videoHeight || 1280;
  const scale = Math.max(width / videoWidth, height / videoHeight) * zoom;
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
    video.preload = "auto";
    video.src = url;
    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(video);
    };
    video.onloadeddata = finish;
    video.oncanplay = finish;
    video.onerror = reject;
    setTimeout(() => {
      if (!settled && video.readyState >= 1) {
        finish();
      } else if (!settled) {
        reject(new Error("Video timed out."));
      }
    }, 9000);
    video.load();
  });
}

function captionChunks() {
  const source = clean(state.fact) || voiceoverText();
  const chunks = source
    .split(/(?<=[.!?])\s+|,\s+/)
    .map(clean)
    .filter(Boolean);
  if (chunks.length >= 3) {
    return chunks.slice(0, 7);
  }
  const words = source.split(" ").filter(Boolean);
  const grouped = [];
  for (let index = 0; index < words.length; index += 8) {
    grouped.push(words.slice(index, index + 8).join(" "));
  }
  return grouped.length ? grouped.slice(0, 7) : ["A quick fact worth watching."];
}

function captionAt(elapsed, duration) {
  const chunks = captionChunks();
  const index = Math.min(chunks.length - 1, Math.floor((elapsed / Math.max(duration, 1)) * chunks.length));
  return chunks[index] || chunks[0];
}

function drawPlaceholder(context, elapsed) {
  const gradient = context.createLinearGradient(0, 0, 720, 1280);
  gradient.addColorStop(0, "#12311e");
  gradient.addColorStop(0.5, "#0b1320");
  gradient.addColorStop(1, "#050505");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 720, 1280);

  context.save();
  context.globalAlpha = 0.22;
  context.strokeStyle = "#18f038";
  context.lineWidth = 3;
  for (let x = -260; x < 880; x += 82) {
    context.beginPath();
    context.moveTo(x + elapsed * 18, 0);
    context.lineTo(x + 380 + elapsed * 18, 1280);
    context.stroke();
  }
  context.restore();

  context.fillStyle = "#18f038";
  context.font = "900 56px -apple-system,Segoe UI,sans-serif";
  context.textAlign = "center";
  wrapText(context, postTitle(), 360, 620, 610, 62, 3);
}

function drawActionRail(context) {
  const actions = [
    ["<3", "99K"],
    ["++", "12K"],
    [">", "Share"],
    ["+", "Save"],
  ];
  context.textAlign = "center";
  actions.forEach(([icon, label], index) => {
    const y = 500 + index * 124;
    fillRounded(context, 626, y - 34, 62, 62, 31, "rgba(0,0,0,.55)");
    context.fillStyle = "#fff";
    context.font = "900 27px -apple-system,Segoe UI,sans-serif";
    context.fillText(icon, 657, y + 7);
    context.font = "900 18px -apple-system,Segoe UI,sans-serif";
    context.fillText(label, 657, y + 58);
  });
}

function drawShortsOverlay(context, elapsed, duration, activeClip) {
  const topGradient = context.createLinearGradient(0, 0, 0, 360);
  topGradient.addColorStop(0, "rgba(0,0,0,.84)");
  topGradient.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = topGradient;
  context.fillRect(0, 0, 720, 360);

  const bottomGradient = context.createLinearGradient(0, 820, 0, 1280);
  bottomGradient.addColorStop(0, "rgba(0,0,0,0)");
  bottomGradient.addColorStop(1, "rgba(0,0,0,.9)");
  context.fillStyle = bottomGradient;
  context.fillRect(0, 820, 720, 460);

  fillRounded(context, 28, 30, 266, 54, 27, "rgba(0,0,0,.62)");
  context.fillStyle = "#18f038";
  context.font = "900 21px -apple-system,Segoe UI,sans-serif";
  context.textAlign = "left";
  context.fillText("@FactPulse", 50, 65);
  fillRounded(context, 520, 30, 154, 54, 27, "#fff");
  context.fillStyle = "#050505";
  context.font = "900 19px -apple-system,Segoe UI,sans-serif";
  context.textAlign = "center";
  context.fillText("SUBSCRIBE", 597, 65);

  context.fillStyle = "#18f038";
  context.font = "1000 58px -apple-system,Segoe UI,sans-serif";
  context.textAlign = "center";
  context.fillText("DID YOU KNOW?", 360, 150);
  context.fillStyle = "#fff";
  context.font = "900 34px -apple-system,Segoe UI,sans-serif";
  wrapText(context, titleCase(state.subject || "FactPulse"), 360, 198, 620, 40, 2);

  const caption = captionAt(elapsed, duration);
  fillRounded(context, 42, 888, 570, 172, 24, "rgba(0,0,0,.72)");
  context.fillStyle = "#fff";
  context.font = "900 39px -apple-system,Segoe UI,sans-serif";
  context.textAlign = "center";
  wrapText(context, caption, 327, 938, 510, 43, 3);

  const source = activeClip ? `${activeClip.source} / ${activeClip.match === "exact" ? "exact" : "b-roll"}` : "FactPulse auto edit";
  fillRounded(context, 42, 1080, 408, 44, 22, "rgba(24,240,56,.94)");
  context.fillStyle = "#061007";
  context.font = "900 18px -apple-system,Segoe UI,sans-serif";
  context.textAlign = "left";
  context.fillText(source.slice(0, 34), 64, 1108);

  context.fillStyle = "rgba(255,255,255,.2)";
  context.fillRect(28, 1242, 664, 10);
  context.fillStyle = "#18f038";
  context.fillRect(28, 1242, 664 * (elapsed / Math.max(duration, 1)), 10);

  drawActionRail(context);
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
  const output = $("#videoOut");
  if (output) {
    output.innerHTML = '<div class="box">Loading clips and building the edit...</div>';
  }
  for (const clip of state.timeline) {
    try {
      const video = await loadVideo(clip.videoUrl || clip.previewUrl);
      loadedVideos.push({ clip, video });
    } catch (error) {
      // Bad external files are skipped so one broken source does not kill the render.
    }
  }

  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
  let recorder;
  try {
    recorder = new MediaRecorder(canvas.captureStream(24), { mimeType });
  } catch (error) {
    recorder = new MediaRecorder(canvas.captureStream(24));
  }
  const chunks = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size) {
      chunks.push(event.data);
    }
  };

  const finished = new Promise((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || "video/webm" }));
  });

  recorder.start(500);
  const startedAt = performance.now();

  function frame(now) {
    const elapsed = Math.min((now - startedAt) / 1000, duration);

    if (loadedVideos.length) {
      const clipIndex = Math.min(loadedVideos.length - 1, Math.floor(elapsed / (duration / loadedVideos.length || 1)));
      const { clip, video } = loadedVideos[clipIndex];
      try {
        const slot = duration / loadedVideos.length || duration;
        const localTime = elapsed - clipIndex * slot;
        const segment = Math.max(1, Number(clip.clipDuration) || slot);
        const start = Math.max(0, Number(clip.startTime) || 0);
        const maxTime = Math.max(0, (video.duration || start + localTime + 1) - 0.25);
        video.currentTime = Math.min(start + (localTime % segment), maxTime);
        drawVideoFrame(context, video, 0, 0, 720, 1280, 1.03 + Math.sin(elapsed / 2) * 0.015);
        drawShortsOverlay(context, elapsed, duration, clip);
      } catch (error) {
        drawPlaceholder(context, elapsed);
        drawShortsOverlay(context, elapsed, duration, null);
      }
    } else {
      drawPlaceholder(context, elapsed);
      drawShortsOverlay(context, elapsed, duration, null);
    }

    const progress = $("#progress");
    if (progress) {
      progress.style.width = `${(elapsed / duration) * 100}%`;
    }

    if (elapsed < duration) {
      requestAnimationFrame(frame);
    } else {
      setTimeout(() => recorder.stop(), 250);
    }
  }

  requestAnimationFrame(frame);
  lastRenderedBlob = await finished;
  const url = URL.createObjectURL(lastRenderedBlob);
  if (output) {
    const size = Math.round(lastRenderedBlob.size / 1024);
    output.innerHTML = `<video controls playsinline src="${url}"></video><a class="btn primary" href="${url}" download="factpulse-short.webm" style="margin-top:10px">Download styled video</a><div class="box" style="margin-top:10px">Preview ready · ${loadedVideos.length} clips · ${size} KB</div>`;
  }
  toast("Shorts-style video rendered");
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
  if ($("#autoEdit")) {
    $("#autoEdit").onclick = autoBuildTimeline;
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
