const COVERR_KEY_STORE = 'factpulse-coverr-key';

function getCoverrKey() {
  const input = document.querySelector('#coverrKey');
  const value = (input && input.value ? input.value : localStorage.getItem(COVERR_KEY_STORE) || '').trim();
  if (input && value) input.value = value;
  return value;
}

function saveCoverrKey() {
  const key = getCoverrKey();
  if (key) localStorage.setItem(COVERR_KEY_STORE, key);
}

function coverrPlayable(url) {
  return String(url || '').toLowerCase().includes('.mp4') || String(url || '').includes('storage.coverr.co');
}

async function searchCoverr(query, many) {
  const key = getCoverrKey();
  if (!key) return [];
  const clips = [];
  const pages = many ? 3 : 1;
  for (let page = 0; page < pages; page++) {
    const url = 'https://api.coverr.co/videos' +
      `?api_key=${encodeURIComponent(key)}` +
      `&query=${encodeURIComponent(query)}` +
      `&page=${page}` +
      `&page_size=${many ? 40 : 20}` +
      '&sort=popular&urls=true';
    const res = await fetchWithTimeout(url, {}, 10000);
    if (!res.ok) break;
    const json = await res.json();
    for (const hit of json.hits || []) {
      const urls = hit.urls || {};
      const videoUrl = urls.mp4_preview || urls.mp4 || urls.mp4_download;
      if (!videoUrl || !coverrPlayable(videoUrl)) continue;
      const tags = Array.isArray(hit.tags) ? hit.tags.join(', ') : String(hit.tags || query);
      clips.push({
        id: `coverr-${hit.id}`,
        source: 'Coverr',
        title: hit.title || query,
        credit: 'Coverr',
        pageUrl: `https://coverr.co/search?q=${encodeURIComponent(query)}`,
        videoUrl,
        previewUrl: videoUrl,
        tags: `${hit.title || ''} ${hit.description || ''} ${tags} ${query}`,
        license: 'Coverr Free Videos API',
        mime: 'video/mp4',
        duration: hit.duration || 0
      });
    }
  }
  return clips;
}

const originalBuildSearchesForCoverr = buildSearches;
buildSearches = function buildSearchesWithCoverrMode() {
  const plan = originalBuildSearchesForCoverr();
  const mode = document.querySelector('#searchMode')?.value || 'exact';
  if (mode === 'exact') return { exact: plan.exact, related: [] };
  return plan;
};

const originalSearchClipsForCoverr = searchClips;
searchClips = async function searchClipsWithCoverr(many) {
  syncFromFields(true);
  saveCoverrKey();
  state.clips = [];
  renderClips();
  const plan = buildSearches();
  const runs = [...plan.exact.map((query) => ({ query, exact: true })), ...plan.related.map((query) => ({ query, exact: false }))];
  setClipStatus('Starting Coverr, Pixabay, Pexels search...');
  for (const run of runs) {
    const sources = [['Coverr', searchCoverr], ['Wikimedia', searchCommons]];
    if (state.licenseMode !== 'public') {
      if (state.pixabayKey) sources.unshift(['Pixabay', searchPixabay]);
      if (state.pexelsKey) sources.unshift(['Pexels', searchPexels]);
    }
    for (const [name, fn] of sources) {
      try {
        setClipStatus(`Searching ${name}: ${run.query}`);
        const results = await fn(run.query, many);
        if (results && results.length) classifyAndSaveClips(results);
      } catch (_) {}
    }
  }
  updateClipCount();
  toast(state.clips.length ? 'Coverr search finished.' : 'No exact playable legal clips found. Try Related mode for stock B-roll.');
};

window.addEventListener('DOMContentLoaded', () => {
  const coverrInput = document.querySelector('#coverrKey');
  if (coverrInput) {
    coverrInput.value = localStorage.getItem(COVERR_KEY_STORE) || '';
    coverrInput.addEventListener('input', saveCoverrKey);
  }
  const searchMode = document.querySelector('#searchMode');
  if (searchMode) {
    searchMode.addEventListener('change', () => {
      state.clips = [];
      save();
      renderAll();
    });
  }
  const find = document.querySelector('#searchClips');
  const many = document.querySelector('#searchMany');
  if (find) find.onclick = () => searchClips(false);
  if (many) many.onclick = () => searchClips(true);
});