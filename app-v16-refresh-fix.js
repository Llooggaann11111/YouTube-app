const REFRESH_FIX = { ran: false };

function refreshFixPlayable(clipOrUrl, mime = '') {
  const clip = typeof clipOrUrl === 'object' ? clipOrUrl : null;
  const url = String(clip ? (clip.videoUrl || clip.previewUrl || '') : clipOrUrl || '').trim();
  const lower = url.toLowerCase().split('?')[0];
  const type = String(clip ? (clip.mime || clip.type || clip.file_type || mime || '') : mime || '').toLowerCase();
  const source = String(clip ? clip.source || '' : '').toLowerCase();
  const appleMobile = /iphone|ipad|ipod/i.test(navigator.userAgent || '');

  if (!url) return false;
  if (type.includes('mp4') || type.includes('quicktime')) return true;
  if (lower.endsWith('.mp4') || lower.endsWith('.m4v') || lower.endsWith('.mov')) return true;
  if (!appleMobile && (lower.endsWith('.webm') || type.includes('webm'))) return true;

  if (source.includes('coverr') && /^https?:\/\//i.test(url)) return true;
  if (source.includes('pixabay') && /^https?:\/\//i.test(url)) return true;
  if (source.includes('pexels') && /^https?:\/\//i.test(url)) return true;

  if (/coverr\.co|storage\.coverr|cdn\.coverr|pixabay\.com|pexels\.com|videos\.pexels|player\.vimeo/i.test(url)) return true;
  return false;
}

function refreshFixSaveClipBackup() {
  try {
    const backup = {
      subject: state.subject || '',
      scene: state.scene || '',
      clips: state.clips || [],
      savedAt: Date.now()
    };
    localStorage.setItem('factpulse-last-good-clips', JSON.stringify(backup));
  } catch (_) {}
}

function refreshFixRestoreClipBackup() {
  try {
    const backup = JSON.parse(localStorage.getItem('factpulse-last-good-clips') || '{}');
    if (!backup.clips || !backup.clips.length) return false;
    const sameSubject = clean(backup.subject || '').toLowerCase() === clean(state.subject || '').toLowerCase();
    const recent = Date.now() - Number(backup.savedAt || 0) < 1000 * 60 * 60 * 24;
    if (!sameSubject || !recent) return false;
    state.clips = backup.clips;
    save();
    return true;
  } catch (_) {
    return false;
  }
}

function refreshFixSubjectMatch(clip) {
  if (typeof subjectMatch === 'function') return subjectMatch(clip);
  const subject = clean(state.subject || '').toLowerCase();
  if (!subject) return true;
  const text = `${clip.title || ''} ${clip.tags || ''} ${clip.credit || ''} ${clip.creator || ''} ${clip.pageUrl || ''} ${clip.source || ''}`.toLowerCase();
  const parts = subject.split(/\s+/).filter(Boolean);
  return parts.length <= 1 ? text.includes(subject) : parts.filter(p => text.includes(p)).length >= Math.min(2, parts.length);
}

function refreshFixKeepClip(clip) {
  if (!clip) return false;
  if (!refreshFixPlayable(clip)) return false;
  const mode = document.querySelector('#searchMode')?.value || state.searchMode || 'exact';
  if (refreshFixSubjectMatch(clip)) {
    clip.match = 'exact';
    return true;
  }
  if (mode === 'related' || clip.match === 'related') return true;
  return false;
}

function refreshFixRenderClips() {
  const grid = document.querySelector('#clipGrid');
  if (!grid) return;

  let clips = Array.isArray(state.clips) ? state.clips : [];
  if (!clips.length) {
    refreshFixRestoreClipBackup();
    clips = Array.isArray(state.clips) ? state.clips : [];
  }

  state.clips = clips.filter(refreshFixKeepClip);

  if (state.clips.length) {
    refreshFixSaveClipBackup();
    grid.innerHTML = '';
    const exact = state.clips.filter(c => c.match === 'exact');
    const related = state.clips.filter(c => c.match !== 'exact');
    const groups = [];
    if (exact.length) groups.push(['EXACT TOPIC', exact]);
    if (related.length) groups.push(['RELATED B-ROLL', related]);

    const frag = document.createDocumentFragment();
    groups.forEach(([label, list]) => {
      const heading = document.createElement('div');
      heading.className = 'box';
      heading.textContent = `${label} · ${list.length} saved playable clips`;
      frag.appendChild(heading);
      list.forEach(clip => {
        const index = state.clips.indexOf(clip);
        const card = document.createElement('article');
        card.className = 'clip';
        const src = clip.previewUrl || clip.videoUrl || '';
        card.innerHTML = `<div class="thumb"><video muted playsinline controls preload="metadata" src="${src}"></video></div><strong>${label} · ${esc(clip.source || 'Source')}</strong><small>License: ${esc(clip.license || 'verify source')}</small><small>Topic: ${esc((clip.tags || clip.title || '').slice(0,100))}</small><div class="row"><button type="button" data-preview="${index}">Preview</button><button type="button" data-add="${index}">Add</button></div><a href="${clip.pageUrl || src}" target="_blank" rel="noopener">Source</a>`;
        frag.appendChild(card);
      });
    });
    grid.appendChild(frag);
    const count = document.querySelector('#clipCount');
    if (count) count.textContent = `${exact.length} exact, ${related.length} related loaded`;
    save();
    return;
  }

  grid.innerHTML = `<div class="box full-empty">No saved playable clips found for "${esc(state.subject || 'this search')}". Press Search clips again. If a clip appeared before refreshing, this fix keeps it saved next time.</div>`;
  const count = document.querySelector('#clipCount');
  if (count) count.textContent = '0 saved clips. Search again.';
}

const refreshFixOldClassify = typeof classifyAndSaveClips === 'function' ? classifyAndSaveClips : null;
if (refreshFixOldClassify) {
  classifyAndSaveClips = function refreshFixClassify(newClips) {
    refreshFixOldClassify(newClips);
    if ((state.clips || []).length) refreshFixSaveClipBackup();
  };
}

const refreshFixOldSearch = typeof searchClips === 'function' ? searchClips : null;
if (refreshFixOldSearch) {
  searchClips = async function refreshFixSearchClips(many) {
    await refreshFixOldSearch(many);
    if ((state.clips || []).length) refreshFixSaveClipBackup();
    refreshFixRenderClips();
  };
}

if (typeof fpPlayable === 'function') fpPlayable = (url, mime) => refreshFixPlayable(url, mime);
if (typeof playableUrl === 'function') playableUrl = (url, mime) => refreshFixPlayable(url, mime);
if (typeof coverrPlayable === 'function') coverrPlayable = (url) => refreshFixPlayable({ videoUrl: url, source: 'Coverr' });

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(refreshFixRenderClips, 200);
});
