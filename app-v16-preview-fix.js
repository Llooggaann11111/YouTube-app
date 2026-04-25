function fpEnsurePreviewModal() {
  let modal = document.querySelector('#clipModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'clipModal';
    modal.innerHTML = `
      <div class="modal-card">
        <button class="modal-close" id="closeModal" type="button">×</button>
        <video id="modalVideo" controls playsinline preload="metadata"></video>
        <div class="box" id="modalInfo"></div>
        <div class="two">
          <button class="btn primary" id="modalAdd" type="button">Add clip</button>
          <a class="btn secondary" id="modalSource" target="_blank" rel="noopener">Source</a>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }
  if (!document.querySelector('#previewFixStyle')) {
    const style = document.createElement('style');
    style.id = 'previewFixStyle';
    style.textContent = `
      #clipModal{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.88);display:none;align-items:center;justify-content:center;padding:14px}
      #clipModal.show{display:flex}
      #clipModal .modal-card{width:min(96vw,460px);max-height:92vh;overflow:auto;background:#111318;border:1px solid #2a2e38;border-radius:24px;padding:12px}
      #clipModal video{width:100%;max-height:62vh;background:#000;border-radius:18px}
      #clipModal .modal-close{float:right;border:0;border-radius:999px;background:#18f038;color:#051007;font-weight:1000;width:40px;height:40px}
    `;
    document.head.appendChild(style);
  }
  const close = document.querySelector('#closeModal');
  if (close) close.onclick = fpClosePreview;
  modal.onclick = (event) => {
    if (event.target && event.target.id === 'clipModal') fpClosePreview();
  };
  return modal;
}

function fpClosePreview() {
  const video = document.querySelector('#modalVideo');
  if (video) {
    try { video.pause(); } catch (_) {}
    video.removeAttribute('src');
    try { video.load(); } catch (_) {}
  }
  const modal = document.querySelector('#clipModal');
  if (modal) modal.classList.remove('show');
}

function fpGetClip(index) {
  const i = Number(index);
  if (!Number.isFinite(i)) return null;
  return (state.clips || [])[i] || null;
}

function fpPreviewClip(index) {
  const clip = fpGetClip(index);
  if (!clip) {
    toast('No clip found for preview. Search again.');
    return;
  }
  const modal = fpEnsurePreviewModal();
  const video = document.querySelector('#modalVideo');
  const info = document.querySelector('#modalInfo');
  const source = document.querySelector('#modalSource');
  const add = document.querySelector('#modalAdd');
  const src = clip.videoUrl || clip.previewUrl;

  if (info) {
    info.textContent = `${clip.match === 'exact' ? 'Exact subject match' : 'Related B-roll'}\n${clip.source || 'Source'}\nLicense: ${clip.license || 'verify source'}\nTopic: ${clip.tags || clip.title || ''}`;
  }
  if (source) source.href = clip.pageUrl || src || '#';
  if (add) add.onclick = () => {
    if (typeof addClip === 'function') addClip(index);
    fpClosePreview();
  };

  if (!src) {
    toast('This clip has no playable video URL.');
    modal.classList.add('show');
    return;
  }

  if (video) {
    try { video.pause(); } catch (_) {}
    video.removeAttribute('src');
    video.setAttribute('playsinline', '');
    video.setAttribute('controls', '');
    video.preload = 'metadata';
    video.src = src;
    video.load();
    video.onloadedmetadata = () => {
      const start = Number(clip.startTime || 0);
      if (Number.isFinite(start) && start > 0) {
        try { video.currentTime = start; } catch (_) {}
      }
    };
    video.onerror = () => {
      if (info) info.textContent += '\n\nPreview could not load in this browser. Tap Source to open it.';
      toast('Preview failed. Tap Source to open it.');
    };
    video.play().catch(() => {
      if (info) info.textContent += '\n\nTap play on the video if it does not autoplay.';
    });
  }
  modal.classList.add('show');
}

openPreview = fpPreviewClip;
closePreview = fpClosePreview;

window.addEventListener('click', (event) => {
  const previewButton = event.target.closest('[data-preview],[data-p]');
  if (previewButton) {
    event.preventDefault();
    event.stopPropagation();
    fpPreviewClip(previewButton.dataset.preview ?? previewButton.dataset.p);
    return;
  }
  const addButton = event.target.closest('[data-add],[data-a]');
  if (addButton && typeof addClip === 'function') {
    event.preventDefault();
    event.stopPropagation();
    addClip(Number(addButton.dataset.add ?? addButton.dataset.a));
  }
}, true);

window.addEventListener('DOMContentLoaded', () => {
  fpEnsurePreviewModal();
});