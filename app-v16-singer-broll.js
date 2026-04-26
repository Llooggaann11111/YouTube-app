function singerQueryBase() {
  const subject = clean(state.subject || 'singer');
  const subjectWords = words(subject).join(' ');
  return [subjectWords, 'singer microphone stage concert audience', 'music concert singer performance', 'artist singing on stage', 'musician performing crowd', 'pop singer concert lights'];
}

buildSearches = function buildSingerSearches() {
  const queries = singerQueryBase().map(clean).filter(Boolean);
  return {
    exact: [],
    related: Array.from(new Set(queries)).slice(0, 8)
  };
};

function singerMatch(clip) {
  const text = clipText(clip);
  const needed = ['singer', 'singing', 'microphone', 'concert', 'music', 'musician', 'stage', 'performance', 'artist', 'crowd'];
  const hits = needed.filter((word) => text.includes(word)).length;
  return hits >= 1;
}

const singerOldClassify = classifyAndSaveClips;
classifyAndSaveClips = function classifySingerBroll(newClips) {
  const combined = new Map(state.clips.map((clip) => [clip.id, clip]));
  for (const clip of newClips || []) {
    if (!fpPlayable(clip.videoUrl || clip.previewUrl, clip.mime || clip.type || clip.file_type)) continue;
    if (!singerMatch(clip)) continue;
    clip.match = 'related';
    combined.set(clip.id, clip);
  }
  state.clips = [...combined.values()].sort((a, b) => scoreClip(b) - scoreClip(a)).slice(0, 500);
  save();
  renderClips();
  updateClipCount();
};

renderClips = function renderSingerClips() {
  const grid = document.querySelector('#clipGrid');
  if (!grid) return;
  state.clips = (state.clips || []).filter((clip) => fpPlayable(clip.videoUrl || clip.previewUrl, clip.mime || clip.type || clip.file_type) && singerMatch(clip));
  if (!state.clips.length) {
    setClipStatus('0 singer clips loaded');
    grid.innerHTML = '<div class="box">No singer clips loaded yet. Add a free Pexels or Pixabay key, then press Search singer clips. These will be generic singer and concert B-roll, not footage of a specific celebrity.</div>';
    save();
    return;
  }
  grid.innerHTML = '';
  const heading = document.createElement('div');
  heading.className = 'box';
  heading.textContent = `SINGER / CONCERT B-ROLL · ${state.clips.length} playable clips`;
  grid.appendChild(heading);
  state.clips.forEach((clip, index) => {
    const card = document.createElement('article');
    card.className = 'clip';
    card.innerHTML = `<div class="thumb"><video muted playsinline controls preload="metadata" src="${clip.previewUrl || clip.videoUrl}"></video></div><strong>SINGER B-ROLL · ${esc(clip.source)}</strong><small>License: ${esc(clip.license)}</small><small>Topic: ${esc((clip.tags || '').slice(0, 100))}</small><div class="row"><button type="button" data-preview="${index}">Preview</button><button type="button" data-add="${index}">Add</button></div><a href="${clip.pageUrl}" target="_blank">Source</a>`;
    grid.appendChild(card);
  });
  $$('[data-preview]').forEach((button) => button.onclick = () => openPreview(Number(button.dataset.preview)));
  $$('[data-add]').forEach((button) => button.onclick = () => addClip(Number(button.dataset.add)));
  setClipStatus(`${state.clips.length} singer clips loaded`);
  save();
};

window.addEventListener('DOMContentLoaded', () => {
  state.searchMode = 'related';
  if (document.querySelector('#searchMode')) document.querySelector('#searchMode').value = 'related';
  renderSearchPlan();
  renderClips();
});