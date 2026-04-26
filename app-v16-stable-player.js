const STABLE_CLIP_STORE = 'factpulse-stable-clips-v1';
const STABLE_PREVIEW_STORE = 'factpulse-mobile-preview-clip';
const STABLE_LAST_PAGE = 'factpulse-last-clips-page';

function stableHash(text) {
  let h = 2166136261;
  const value = String(text || '');
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return Math.abs(h >>> 0).toString(36);
}

function stableClipId(clip) {
  if (!clip) return '';
  if (clip.id) return String(clip.id);
  return 'clip-' + stableHash(`${clip.videoUrl || ''}|${clip.previewUrl || ''}|${clip.pageUrl || ''}|${clip.tags || ''}`);
}

function stablePlayable(clip) {
  if (!clip) return false;
  const url = String(clip.videoUrl || clip.previewUrl || '').trim();
  if (!url) return false;
  const lower = url.toLowerCase().split('?')[0];
  const mime = String(clip.mime || clip.type || clip.file_type || '').toLowerCase();
  const source = String(clip.source || '').toLowerCase();
  const apple = /iphone|ipad|ipod/i.test(navigator.userAgent || '');
  if (mime.includes('mp4') || mime.includes('quicktime')) return true;
  if (lower.endsWith('.mp4') || lower.endsWith('.m4v') || lower.endsWith('.mov')) return true;
  if (!apple && (lower.endsWith('.webm') || mime.includes('webm'))) return true;
  if (/coverr|pixabay|pexels/.test(source) && /^https?:\/\//i.test(url)) return true;
  if (/coverr\.co|storage\.coverr|pixabay\.com|pexels\.com|videos\.pexels/i.test(url)) return true;
  return false;
}

function stableNormalizeClips(clips) {
  const map = new Map();
  (clips || []).forEach(raw => {
    if (!raw) return;
    const clip = { ...raw };
    clip.id = stableClipId(clip);
    clip.previewUrl = clip.previewUrl || clip.videoUrl || '';
    clip.videoUrl = clip.videoUrl || clip.previewUrl || '';
    clip.credit = clip.credit || clip.creator || clip.source || 'Creator';
    if (!stablePlayable(clip)) return;
    map.set(clip.id, clip);
  });
  return [...map.values()];
}

function stableSaveClips() {
  try {
    const payload = {
      subject: state.subject || '',
      scene: state.scene || '',
      clips: stableNormalizeClips(state.clips || []),
      timeline: state.timeline || [],
      savedAt: Date.now()
    };
    localStorage.setItem(STABLE_CLIP_STORE, JSON.stringify(payload));
  } catch (_) {}
}

function stableRestoreClips() {
  try {
    if (state.clips && state.clips.length) return false;
    const payload = JSON.parse(localStorage.getItem(STABLE_CLIP_STORE) || '{}');
    if (!payload.clips || !payload.clips.length) return false;
    const same = clean(payload.subject || '').toLowerCase() === clean(state.subject || '').toLowerCase();
    const recent = Date.now() - Number(payload.savedAt || 0) < 1000 * 60 * 60 * 24;
    if (!same || !recent) return false;
    state.clips = stableNormalizeClips(payload.clips);
    save();
    return true;
  } catch (_) {
    return false;
  }
}

function stableGetClipById(id) {
  const clips = stableNormalizeClips(state.clips || []);
  return clips.find(c => c.id === id) || null;
}

function stableSceneMatch(clip) {
  if (typeof sceneMatch === 'function') return sceneMatch(clip);
  return true;
}

function stableSubjectMatch(clip) {
  if (typeof subjectMatch === 'function') return subjectMatch(clip);
  return true;
}

function stableRenderClips() {
  const grid = document.querySelector('#clipGrid');
  if (!grid) return;
  stableRestoreClips();
  state.clips = stableNormalizeClips(state.clips || []);
  stableSaveClips();

  grid.innerHTML = '';
  if (!state.clips.length) {
    grid.innerHTML = `<div class="box full-empty">No playable videos saved. Press Search clips again. Use Related B-roll for topics where exact footage is not available.</div>`;
    const count = document.querySelector('#clipCount');
    if (count) count.textContent = '0 playable clips';
    return;
  }

  const exact = state.clips.filter(c => c.match === 'exact' || stableSubjectMatch(c));
  const related = state.clips.filter(c => !(c.match === 'exact' || stableSubjectMatch(c)));
  const groups = [];
  if (exact.length) groups.push(['EXACT TOPIC', exact]);
  if (related.length) groups.push(['RELATED B-ROLL', related]);

  const frag = document.createDocumentFragment();
  groups.forEach(([label, clips]) => {
    const heading = document.createElement('div');
    heading.className = 'box';
    heading.textContent = `${label} · ${clips.length} playable clips`;
    frag.appendChild(heading);
    clips.slice(0, 120).forEach(clip => {
      const src = clip.previewUrl || clip.videoUrl;
      const card = document.createElement('article');
      card.className = 'clip';
      card.dataset.clipId = clip.id;
      card.innerHTML = `
        <div class="thumb"><button class="btn secondary" data-stable-preview="${clip.id}" type="button" style="width:100%;height:100%;border-radius:14px">Tap Preview</button></div>
        <strong>${esc(label)} · ${esc(clip.source || 'Source')}</strong>
        <small>License: ${esc(clip.license || 'verify source')}</small>
        <small>Topic: ${esc((clip.tags || clip.title || '').slice(0, 100))}</small>
        <div class="row">
          <button type="button" data-stable-preview="${clip.id}">Preview</button>
          <button type="button" data-stable-add="${clip.id}">Add</button>
        </div>
        <a href="${clip.pageUrl || src}" target="_blank" rel="noopener">Source</a>`;
      frag.appendChild(card);
    });
  });
  grid.appendChild(frag);

  const count = document.querySelector('#clipCount');
  if (count) count.textContent = `${exact.length} exact, ${related.length} related playable`;
  save();
}

function stableOpenPreviewById(id) {
  const clip = stableGetClipById(id);
  if (!clip) {
    toast('That preview clip is gone. Search again.');
    return;
  }
  localStorage.setItem(STABLE_PREVIEW_STORE, JSON.stringify(clip));
  localStorage.setItem(STABLE_LAST_PAGE, location.pathname.split('/').pop() || 'clips-coverr-v16.html');
  location.href = 'mobile-preview-v16.html';
}

function stableAddById(id) {
  const clip = stableGetClipById(id);
  if (!clip) {
    toast('That clip is gone. Search again.');
    return;
  }
  state.timeline = Array.isArray(state.timeline) ? state.timeline : [];
  const prepared = typeof chooseSegmentForClip === 'function' ? chooseSegmentForClip(clip) : clip;
  state.timeline.push(prepared);
  save();
  stableSaveClips();
  if (typeof renderTimeline === 'function') renderTimeline();
  if (typeof renderPost === 'function') renderPost();
  toast('Added the correct clip');
}

function stablePatchSearch() {
  const oldClassify = typeof classifyAndSaveClips === 'function' ? classifyAndSaveClips : null;
  if (oldClassify && !window.__stableClassifyPatched) {
    window.__stableClassifyPatched = true;
    classifyAndSaveClips = function stableClassify(newClips) {
      oldClassify(newClips);
      state.clips = stableNormalizeClips(state.clips || []);
      stableSaveClips();
      stableRenderClips();
    };
  }
  const oldSearch = typeof searchClips === 'function' ? searchClips : null;
  if (oldSearch && !window.__stableSearchPatched) {
    window.__stableSearchPatched = true;
    searchClips = async function stableSearch(many) {
      state.clips = [];
      save();
      await oldSearch(many);
      state.clips = stableNormalizeClips(state.clips || []);
      stableSaveClips();
      stableRenderClips();
    };
  }
}

window.addEventListener('click', event => {
  const preview = event.target.closest('[data-stable-preview]');
  if (preview) {
    event.preventDefault();
    event.stopPropagation();
    stableOpenPreviewById(preview.dataset.stablePreview);
    return;
  }
  const add = event.target.closest('[data-stable-add]');
  if (add) {
    event.preventDefault();
    event.stopPropagation();
    stableAddById(add.dataset.stableAdd);
  }
}, true);

window.addEventListener('DOMContentLoaded', () => {
  stablePatchSearch();
  stableRenderClips();
});

renderClips = stableRenderClips;
