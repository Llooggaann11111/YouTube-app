function fpPlayable(url, mime) {
  const u = String(url || '').toLowerCase().split('?')[0];
  const m = String(mime || '').toLowerCase();
  const appleMobile = /iphone|ipad|ipod/i.test(navigator.userAgent || '');
  if (m.includes('mp4') || m.includes('quicktime')) return true;
  if (u.endsWith('.mp4') || u.endsWith('.m4v') || u.endsWith('.mov')) return true;
  if (!appleMobile && (u.endsWith('.webm') || m.includes('webm'))) return true;
  return false;
}

function fpExactPlayable(clip) {
  if (!clip) return false;
  if (!fpPlayable(clip.videoUrl || clip.previewUrl, clip.mime || clip.type || clip.file_type)) return false;
  if (!subjectMatch(clip)) return false;
  clip.match = 'exact';
  return true;
}

classifyAndSaveClips = function(newClips) {
  const combined = new Map(state.clips.map((clip) => [clip.id, clip]));
  for (const clip of newClips || []) {
    if (fpExactPlayable(clip)) combined.set(clip.id, clip);
  }
  state.clips = [...combined.values()].filter(fpExactPlayable).sort((a, b) => scoreClip(b) - scoreClip(a)).slice(0, 500);
  save();
  renderClips();
  updateClipCount();
};

searchCommons = async function(query) {
  const clips = [];
  let offset = 0;
  while (clips.length < 60) {
    const url = 'https://commons.wikimedia.org/w/api.php' +
      `?action=query&generator=search&gsrnamespace=6&gsrlimit=50&gsroffset=${offset}` +
      `&gsrsearch=${encodeURIComponent(query + ' filetype:video')}` +
      '&prop=imageinfo&iiprop=url|mime|extmetadata&format=json&origin=*';
    const res = await fetchWithTimeout(url, {}, 8000);
    if (!res.ok) break;
    const json = await res.json();
    const pages = json.query?.pages ? Object.values(json.query.pages) : [];
    for (const page of pages) {
      const info = page.imageinfo?.[0];
      if (!info || !String(info.mime || '').startsWith('video/')) continue;
      if (!fpPlayable(info.url, info.mime)) continue;
      const meta = info.extmetadata || {};
      const license = meta.LicenseShortName?.value || meta.UsageTerms?.value || 'Unknown license';
      if (state.licenseMode === 'public' && !isPublicLicense(license)) continue;
      if (state.licenseMode !== 'public' && !isAllowedLicense(license)) continue;
      clips.push({
        id: `commons-${page.pageid}`,
        source: 'Wikimedia Commons',
        credit: meta.Artist?.value ? meta.Artist.value.replace(/<[^>]+>/g, '') : 'Wikimedia contributor',
        pageUrl: 'https://commons.wikimedia.org/wiki/' + encodeURIComponent(page.title.replaceAll(' ', '_')),
        videoUrl: info.url,
        previewUrl: info.url,
        tags: `${page.title} ${query}`,
        license,
        mime: info.mime
      });
    }
    if (!json.continue?.gsroffset) break;
    offset = json.continue.gsroffset;
  }
  return clips;
};

const fpOldSearchPixabay = searchPixabay;
searchPixabay = async function(query, many) {
  const clips = await fpOldSearchPixabay(query, many);
  return (clips || []).map((clip) => ({...clip, mime: clip.mime || 'video/mp4'})).filter((clip) => fpPlayable(clip.videoUrl || clip.previewUrl, clip.mime));
};

const fpOldSearchPexels = searchPexels;
searchPexels = async function(query, many) {
  const clips = await fpOldSearchPexels(query, many);
  return (clips || []).map((clip) => ({...clip, mime: clip.mime || 'video/mp4'})).filter((clip) => fpPlayable(clip.videoUrl || clip.previewUrl, clip.mime));
};

renderClips = function() {
  const grid = document.querySelector('#clipGrid');
  if (!grid) return;
  state.clips = (state.clips || []).filter(fpExactPlayable);
  if (!state.clips.length) {
    setClipStatus('0 exact playable clips loaded');
    grid.innerHTML = '<div class="box">No exact playable legal clips found. The app will not show unrelated concert or stock B-roll as Justin Bieber. For famous people, free legal MP4 footage is often not available through these free sources.</div>';
    save();
    return;
  }
  grid.innerHTML = '';
  const heading = document.createElement('div');
  heading.className = 'box';
  heading.textContent = `EXACT TOPIC · ${state.clips.length} playable clips`;
  grid.appendChild(heading);
  state.clips.forEach((clip, index) => {
    const card = document.createElement('article');
    card.className = 'clip';
    card.innerHTML = `<div class="thumb"><video muted playsinline controls preload="metadata" src="${clip.previewUrl || clip.videoUrl}"></video></div><strong>EXACT TOPIC · ${esc(clip.source)}</strong><small>License: ${esc(clip.license)}</small><small>Topic: ${esc((clip.tags || '').slice(0, 100))}</small><div class="row"><button type="button" data-preview="${index}">Preview</button><button type="button" data-add="${index}">Add</button></div><a href="${clip.pageUrl}" target="_blank">Source</a>`;
    grid.appendChild(card);
  });
  $$('[data-preview]').forEach((button) => button.onclick = () => openPreview(Number(button.dataset.preview)));
  $$('[data-add]').forEach((button) => button.onclick = () => addClip(Number(button.dataset.add)));
  setClipStatus(`${state.clips.length} exact playable clips loaded`);
  save();
};

openPreview = function(index) {
  const clip = state.clips[index];
  if (!clip) return;
  ensureModal();
  const video = $('#modalVideo');
  video.pause();
  video.removeAttribute('src');
  video.load();
  video.src = clip.videoUrl;
  video.controls = true;
  video.playsInline = true;
  video.load();
  video.play().catch(() => {});
  $('#modalInfo').textContent = `Exact subject match\n${clip.source}\nLicense: ${clip.license}\nTopic: ${clip.tags}`;
  $('#modalSource').href = clip.pageUrl;
  $('#modalAdd').onclick = () => { addClip(index); closePreview(); };
  $('#clipModal').classList.add('show');
};

window.addEventListener('DOMContentLoaded', () => {
  state.clips = (state.clips || []).filter(fpExactPlayable);
  renderClips();
});