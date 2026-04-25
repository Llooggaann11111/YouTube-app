const PERF_STATE = {
  rendering: false,
  lastRenderKey: '',
  visibleVideos: new Set(),
  maxLoadedThumbs: 3
};

function perfClipKey() {
  return JSON.stringify({
    clips: (state.clips || []).map(c => [c.id, c.match, c.videoUrl, c.previewUrl]),
    timeline: (state.timeline || []).map(c => c.id),
    page: document.body.dataset.page || ''
  });
}

function perfPauseVideo(video) {
  try { video.pause(); } catch (_) {}
}

function perfUnloadVideo(video) {
  try { video.pause(); } catch (_) {}
  video.removeAttribute('src');
  try { video.load(); } catch (_) {}
}

function perfPlayable(url, mime) {
  if (typeof fpPlayable === 'function') return fpPlayable(url, mime);
  if (typeof playableUrl === 'function') return playableUrl(url, mime);
  const u = String(url || '').toLowerCase().split('?')[0];
  const m = String(mime || '').toLowerCase();
  const appleMobile = /iphone|ipad|ipod/i.test(navigator.userAgent || '');
  if (m.includes('mp4') || m.includes('quicktime')) return true;
  if (u.endsWith('.mp4') || u.endsWith('.m4v') || u.endsWith('.mov')) return true;
  if (!appleMobile && (u.endsWith('.webm') || m.includes('webm'))) return true;
  return false;
}

function perfSetupLazyVideos(root = document) {
  const videos = Array.from(root.querySelectorAll('video[data-src]'));
  if (!videos.length) return;

  if (!('IntersectionObserver' in window)) {
    videos.slice(0, PERF_STATE.maxLoadedThumbs).forEach(video => {
      if (!video.src) video.src = video.dataset.src;
    });
    return;
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const video = entry.target;
      if (entry.isIntersecting) {
        if (PERF_STATE.visibleVideos.size >= PERF_STATE.maxLoadedThumbs) {
          const first = PERF_STATE.visibleVideos.values().next().value;
          if (first && first !== video) {
            perfUnloadVideo(first);
            PERF_STATE.visibleVideos.delete(first);
          }
        }
        if (!video.src && video.dataset.src) {
          video.src = video.dataset.src;
          video.load();
        }
        PERF_STATE.visibleVideos.add(video);
      } else {
        perfUnloadVideo(video);
        PERF_STATE.visibleVideos.delete(video);
      }
    });
  }, { rootMargin: '160px 0px', threshold: 0.01 });

  videos.forEach(video => observer.observe(video));
}

function perfMakeClipCard(clip, label, index) {
  const card = document.createElement('article');
  card.className = 'clip';
  const src = clip.previewUrl || clip.videoUrl || '';
  const playable = perfPlayable(src, clip.mime || clip.type || clip.file_type || '');
  const media = playable
    ? `<video muted playsinline preload="none" data-src="${src}"></video>`
    : `<div class="box">Preview format not supported. Tap Source.</div>`;
  card.innerHTML = `
    <div class="thumb">${media}</div>
    <strong>${esc(label)} · ${esc(clip.source || 'Source')}</strong>
    <small>License: ${esc(clip.license || 'verify source')}</small>
    <small>Topic: ${esc((clip.tags || clip.title || '').slice(0, 110))}</small>
    <div class="row">
      <button type="button" data-preview="${index}">Preview</button>
      <button type="button" data-add="${index}">Add</button>
    </div>
    <a href="${clip.pageUrl || src}" target="_blank" rel="noopener">Source</a>`;
  return card;
}

function perfRenderClips() {
  const grid = document.querySelector('#clipGrid');
  if (!grid) return;
  const key = perfClipKey();
  if (PERF_STATE.rendering || key === PERF_STATE.lastRenderKey) return;
  PERF_STATE.rendering = true;
  PERF_STATE.lastRenderKey = key;

  requestAnimationFrame(() => {
    const raw = state.clips || [];
    const playable = raw.filter(clip => perfPlayable(clip.videoUrl || clip.previewUrl, clip.mime || clip.type || clip.file_type));
    state.clips = playable;

    grid.innerHTML = '';
    if (!playable.length) {
      const empty = document.createElement('div');
      empty.className = 'box';
      empty.textContent = 'No playable clips loaded. Add Pixabay, Pexels, or Coverr keys, then search again.';
      grid.appendChild(empty);
      const count = document.querySelector('#clipCount');
      if (count) count.textContent = '0 playable clips loaded';
      PERF_STATE.rendering = false;
      return;
    }

    const frag = document.createDocumentFragment();
    const exact = playable.filter(c => c.match === 'exact');
    const related = playable.filter(c => c.match !== 'exact');
    const groups = [];
    if (exact.length) groups.push(['EXACT TOPIC', exact]);
    if (related.length) groups.push(['RELATED B-ROLL', related]);

    groups.forEach(([label, list]) => {
      const heading = document.createElement('div');
      heading.className = 'box';
      heading.textContent = `${label} · ${list.length} playable clips`;
      frag.appendChild(heading);
      list.slice(0, 80).forEach(clip => {
        const index = state.clips.indexOf(clip);
        frag.appendChild(perfMakeClipCard(clip, label, index));
      });
    });

    grid.appendChild(frag);
    perfSetupLazyVideos(grid);

    const count = document.querySelector('#clipCount');
    if (count) {
      const exactCount = exact.length;
      const relatedCount = related.length;
      count.textContent = `${exactCount} exact, ${relatedCount} related playable`;
    }

    PERF_STATE.rendering = false;
  });
}

function perfPatchPreview() {
  window.addEventListener('click', event => {
    const previewButton = event.target.closest('[data-preview],[data-p]');
    if (previewButton) {
      event.preventDefault();
      event.stopPropagation();
      const index = Number(previewButton.dataset.preview ?? previewButton.dataset.p);
      if (typeof fpPreviewClip === 'function') fpPreviewClip(index);
      else if (typeof openPreview === 'function') openPreview(index);
      return;
    }
    const addButton = event.target.closest('[data-add],[data-a]');
    if (addButton && typeof addClip === 'function') {
      event.preventDefault();
      event.stopPropagation();
      addClip(Number(addButton.dataset.add ?? addButton.dataset.a));
    }
  }, true);
}

function perfPatchSearchButtons() {
  ['#searchClips', '#searchMany'].forEach(selector => {
    const button = document.querySelector(selector);
    if (!button || button.dataset.perfPatched) return;
    button.dataset.perfPatched = '1';
    button.addEventListener('click', () => {
      button.disabled = true;
      button.style.opacity = '0.65';
      setTimeout(() => {
        button.disabled = false;
        button.style.opacity = '';
      }, selector === '#searchMany' ? 8000 : 3500);
    }, true);
  });
}

function perfPatchPage() {
  const originalRender = typeof renderClips === 'function' ? renderClips : null;
  renderClips = perfRenderClips;
  perfPatchPreview();
  perfPatchSearchButtons();
  document.querySelectorAll('video').forEach(video => {
    video.preload = 'none';
    perfPauseVideo(video);
  });
  perfRenderClips();
}

window.addEventListener('DOMContentLoaded', perfPatchPage);
window.addEventListener('pagehide', () => document.querySelectorAll('video').forEach(perfUnloadVideo));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) document.querySelectorAll('video').forEach(perfPauseVideo);
});