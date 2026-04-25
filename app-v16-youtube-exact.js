const YT_KEY_STORE = 'factpulse-youtube-api-key';
let youtubeResults = [];

function ytClean(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function ytWords(text) {
  const stop = new Set(['the','and','for','with','that','this','from','into','about','after','before','official','video','music','clip','lyrics','audio','live']);
  return ytClean(text).toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2 && !stop.has(w)).slice(0, 10);
}

function getYouTubeKey() {
  const input = document.querySelector('#youtubeKey');
  const value = (input && input.value ? input.value : localStorage.getItem(YT_KEY_STORE) || '').trim();
  if (input && value) input.value = value;
  return value;
}

function saveYouTubeKey() {
  const key = getYouTubeKey();
  if (key) localStorage.setItem(YT_KEY_STORE, key);
}

function ytSubjectMatch(item) {
  const subject = ytWords(state.subject);
  if (!subject.length) return false;
  const text = `${item.title || ''} ${item.description || ''} ${item.channelTitle || ''}`.toLowerCase();
  const hits = subject.filter(w => text.includes(w)).length;
  return subject.length === 1 ? hits >= 1 : hits >= Math.min(2, subject.length);
}

function ytScore(item) {
  const subject = ytWords(state.subject);
  const text = `${item.title || ''} ${item.description || ''} ${item.channelTitle || ''}`.toLowerCase();
  let score = 0;
  for (const w of subject) if (text.includes(w)) score += 15;
  if ((item.title || '').toLowerCase().includes((state.subject || '').toLowerCase())) score += 30;
  if ((item.channelTitle || '').toLowerCase().includes((state.subject || '').toLowerCase())) score += 20;
  if ((item.title || '').toLowerCase().includes('official')) score += 8;
  if ((item.title || '').toLowerCase().includes('interview')) score += 5;
  if ((item.title || '').toLowerCase().includes('live')) score += 5;
  return score;
}

async function searchYouTubeExact() {
  syncFromFields(true);
  saveYouTubeKey();
  const key = getYouTubeKey();
  const grid = document.querySelector('#youtubeGrid');
  const count = document.querySelector('#youtubeCount');
  if (!grid || !count) return;
  if (!key) {
    count.textContent = 'Add a YouTube Data API key first';
    grid.innerHTML = '<div class="box">Paste a YouTube Data API key. This finds exact source videos and embeds them. It does not download or import YouTube videos.</div>';
    return;
  }
  const licenseMode = document.querySelector('#youtubeLicense')?.value || 'creativeCommon';
  const query = ytClean(document.querySelector('#youtubeQuery')?.value || state.subject);
  if (!query) {
    count.textContent = 'Type a subject first';
    return;
  }
  count.textContent = 'Searching YouTube exact sources...';
  grid.innerHTML = '<div class="box">Searching...</div>';
  try {
    const params = new URLSearchParams({ part: 'snippet', type: 'video', q: query, maxResults: '25', safeSearch: 'strict', videoEmbeddable: 'true', key });
    if (licenseMode !== 'any') params.set('videoLicense', licenseMode);
    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'YouTube search failed');
    youtubeResults = (json.items || []).map(item => ({
      videoId: item.id?.videoId,
      title: item.snippet?.title || '',
      description: item.snippet?.description || '',
      channelTitle: item.snippet?.channelTitle || '',
      publishedAt: item.snippet?.publishedAt || '',
      thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || '',
      url: `https://www.youtube.com/watch?v=${item.id?.videoId}`,
      embedUrl: `https://www.youtube.com/embed/${item.id?.videoId}`,
      licenseMode
    })).filter(r => r.videoId && ytSubjectMatch(r)).sort((a, b) => ytScore(b) - ytScore(a));
    renderYouTubeResults();
  } catch (error) {
    count.textContent = 'Search failed';
    grid.innerHTML = `<div class="box">${esc(error.message || 'Search failed')}</div>`;
  }
}

function renderYouTubeResults() {
  const grid = document.querySelector('#youtubeGrid');
  const count = document.querySelector('#youtubeCount');
  if (!grid || !count) return;
  count.textContent = `${youtubeResults.length} exact YouTube sources found`;
  if (!youtubeResults.length) {
    grid.innerHTML = '<div class="box">No exact YouTube sources found with this license filter. Try Any YouTube result for reference only, or use a more specific query like Justin Bieber interview.</div>';
    return;
  }
  grid.innerHTML = '';
  youtubeResults.forEach((item, index) => {
    const card = document.createElement('article');
    card.className = 'clip';
    card.innerHTML = `
      <div class="thumb"><iframe width="100%" height="180" src="${item.embedUrl}" title="${esc(item.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>
      <strong>${esc(item.title)}</strong>
      <small>Channel: ${esc(item.channelTitle)}</small>
      <small>Published: ${esc(item.publishedAt.slice(0, 10))}</small>
      <small>Mode: ${esc(item.licenseMode === 'creativeCommon' ? 'Creative Commons filter' : 'Reference only')}</small>
      <div class="row"><button type="button" data-copy="${index}">Copy link</button><a href="${item.url}" target="_blank">Open</a></div>`;
    grid.appendChild(card);
  });
  $$('[data-copy]').forEach(button => button.onclick = async () => {
    const item = youtubeResults[Number(button.dataset.copy)];
    await navigator.clipboard.writeText(item.url);
    toast('YouTube source copied');
  });
}

window.addEventListener('DOMContentLoaded', () => {
  const key = document.querySelector('#youtubeKey');
  if (key) {
    key.value = localStorage.getItem(YT_KEY_STORE) || '';
    key.addEventListener('input', saveYouTubeKey);
  }
  const query = document.querySelector('#youtubeQuery');
  if (query && state.subject) query.value = state.subject;
  const btn = document.querySelector('#searchYouTube');
  if (btn) btn.onclick = searchYouTubeExact;
});