function playableUrl(url, mime) {
  const u = String(url || '').toLowerCase().split('?')[0];
  const m = String(mime || '').toLowerCase();
  if (m.includes('mp4') || m.includes('quicktime')) return true;
  if (u.endsWith('.mp4') || u.endsWith('.m4v') || u.endsWith('.mov')) return true;
  const mobileApple = /iphone|ipad|ipod/i.test(navigator.userAgent || '');
  if (!mobileApple && (u.endsWith('.webm') || m.includes('webm'))) return true;
  return false;
}

const oldClassifyAndSaveClips = classifyAndSaveClips;
classifyAndSaveClips = function(newClips) {
  oldClassifyAndSaveClips((newClips || []).filter(c => playableUrl(c.videoUrl || c.previewUrl, c.mime || c.type)));
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
      if (!playableUrl(info.url, info.mime)) continue;
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

const oldRenderClips = renderClips;
renderClips = function() {
  state.clips = (state.clips || []).filter(c => playableUrl(c.videoUrl || c.previewUrl, c.mime || c.type));
  if (!state.clips.length) {
    const grid = document.querySelector('#clipGrid');
    if (grid) grid.innerHTML = '<div class="box">No playable clips loaded. Many Wikimedia clips are WebM or OGG and do not play on iPhone. Use Pixabay or Pexels keys for MP4 clips, then search again.</div>';
    const count = document.querySelector('#clipCount');
    if (count) count.textContent = '0 playable clips loaded';
    save();
    return;
  }
  oldRenderClips();
};
