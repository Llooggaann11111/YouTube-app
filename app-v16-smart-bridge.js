const SMART_BOT_URL = "http://127.0.0.1:8000";

async function smartBotFetch(path, payload, timeoutMs = 120000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${SMART_BOT_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Smart bot error ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function analyzeClipWithSmartBot(clip) {
  try {
    const analyzed = await smartBotFetch("/api/analyze-segment", {
      clip,
      subject: state.subject,
      scene: state.scene
    });
    if (analyzed && analyzed.videoUrl) return analyzed;
    return clip;
  } catch (_) {
    return typeof chooseSegmentForClip === "function" ? chooseSegmentForClip(clip) : clip;
  }
}

async function addClip(index) {
  const clip = state.clips[index];
  if (!clip) return;
  toast("Analyzing best 20 to 30 seconds...");
  const analyzed = await analyzeClipWithSmartBot(clip);
  state.timeline.push(analyzed);
  save();
  renderTimeline();
  renderPost();
  const start = Number(analyzed.startTime || 0).toFixed(1);
  const end = Number(analyzed.endTime || analyzed.clipDuration || 25).toFixed(1);
  toast(`Added best segment: ${start}s to ${end}s`);
}

async function searchClipsSmart(many) {
  syncFromFields(true);
  state.clips = [];
  renderClips();
  setClipStatus("Smart bot searching and watching top clips...");
  try {
    const result = await smartBotFetch("/api/search-clips-smart", {
      subject: state.subject,
      fact: state.fact,
      scene: state.scene,
      pixabayKey: state.pixabayKey,
      pexelsKey: state.pexelsKey,
      many,
      analyzeTop: 5
    }, 300000);
    state.clips = result.clips || [];
    save();
    renderClips();
    updateClipCount();
    toast("Smart bot finished. Top clips have vision and audio analysis.");
  } catch (_) {
    toast("Smart bot not running. Using browser search.");
    searchClips(many);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const find = document.querySelector("#searchClips");
  const many = document.querySelector("#searchMany");
  if (find) find.onclick = () => searchClipsSmart(false);
  if (many) many.onclick = () => searchClipsSmart(true);
});
