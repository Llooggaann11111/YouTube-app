const AUTO_FALLBACK_STATE = {
  triedRelated: false,
  lastSubject: ''
};

function fallbackIsSingerTopic() {
  const text = `${state.subject || ''} ${state.fact || ''} ${state.scene || ''}`.toLowerCase();
  return /(bieber|singer|music|musician|artist|concert|song|album|pop|rapper|band|vocal|stage|performance)/i.test(text);
}

function fallbackSceneForSubject() {
  if (fallbackIsSingerTopic()) return 'singer microphone stage concert audience music performance crowd lights';
  const text = `${state.subject || ''} ${state.fact || ''}`.toLowerCase();
  const pairs = [
    [/court|trial|lawsuit|judge|legal/, 'courtroom judge lawyer courthouse hearing legal documents'],
    [/speech|president|leader|civil rights/, 'speech podium microphone crowd audience'],
    [/science|scientist|inventor|tesla|einstein/, 'laboratory experiment machine electricity researcher'],
    [/volcano|earthquake|storm|weather/, 'volcano lava eruption smoke mountain storm clouds'],
    [/money|business|finance|bank/, 'money cash bank finance coins wallet'],
    [/school|student|study/, 'students classroom books studying'],
    [/fitness|sports|athlete/, 'athlete training gym sports stadium'],
    [/technology|phone|computer|ai/, 'computer phone circuit technology screen'],
    [/animal|wildlife/, 'wild animals wildlife nature close up']
  ];
  for (const [regex, scene] of pairs) if (regex.test(text)) return scene;
  return clean(state.scene || words(`${state.subject} ${state.fact}`).slice(0, 6).join(' '));
}

function fallbackBuildRelatedQueries() {
  const subject = clean(state.subject);
  const scene = fallbackSceneForSubject();
  const base = [scene, `${scene} b roll`, `${scene} stock video`];
  if (fallbackIsSingerTopic()) {
    base.unshift('singer microphone stage concert audience');
    base.unshift('music concert singer performance');
    base.unshift('artist singing on stage');
    base.unshift('musician performing crowd');
  } else if (subject) {
    base.unshift(`${subject} ${scene}`);
  }
  return Array.from(new Set(base.map(clean).filter(Boolean))).slice(0, 8);
}

const fallbackOriginalBuildSearches = buildSearches;
buildSearches = function buildSearchesWithAutoFallback() {
  const plan = fallbackOriginalBuildSearches();
  const mode = document.querySelector('#searchMode')?.value || state.searchMode || 'exact';
  if (mode === 'related') {
    plan.related = fallbackBuildRelatedQueries();
  }
  return plan;
};

async function fallbackRunRelatedSearch(many = false) {
  AUTO_FALLBACK_STATE.triedRelated = true;
  state.searchMode = 'related';
  const mode = document.querySelector('#searchMode');
  if (mode) mode.value = 'related';
  if (!clean(state.scene)) {
    state.scene = fallbackSceneForSubject();
    const sceneInput = document.querySelector('#scene');
    if (sceneInput) sceneInput.value = state.scene;
  }
  save();
  renderSearchPlan();
  toast('No exact clip found. Searching related B-roll now.');
  await searchClips(many);
}

const fallbackOriginalSearchClips = searchClips;
searchClips = async function searchClipsWithFallback(many) {
  AUTO_FALLBACK_STATE.lastSubject = clean(state.subject);
  AUTO_FALLBACK_STATE.triedRelated = false;
  await fallbackOriginalSearchClips(many);

  const exactCount = (state.clips || []).filter(c => c.match === 'exact').length;
  const currentMode = document.querySelector('#searchMode')?.value || state.searchMode || 'exact';
  if (currentMode === 'exact' && exactCount === 0) {
    await fallbackRunRelatedSearch(many);
  }
};

function fallbackShowHelpfulEmpty(grid) {
  if (!grid) return;
  const scene = fallbackSceneForSubject();
  grid.innerHTML = `
    <div class="box full-empty">
      No exact playable legal clips found for "${esc(state.subject || 'this subject')}".
      The app will not fake exact footage.
      Use related B-roll for a Shorts-style video.
      Suggested scene: ${esc(scene)}
      <br><br>
      <button class="btn primary" id="fallbackRelatedBtn" type="button">Search related B-roll</button>
      <a class="btn secondary" href="clips-youtube-exact-v16.html">Find exact YouTube sources</a>
    </div>`;
  const btn = document.querySelector('#fallbackRelatedBtn');
  if (btn) btn.onclick = () => fallbackRunRelatedSearch(false);
}

const fallbackOriginalRenderClips = renderClips;
renderClips = function renderClipsWithFullEmpty() {
  fallbackOriginalRenderClips();
  const grid = document.querySelector('#clipGrid');
  const hasCards = grid && grid.querySelector('.clip');
  if (grid && !hasCards && !(state.clips || []).length) {
    fallbackShowHelpfulEmpty(grid);
    const count = document.querySelector('#clipCount');
    if (count) count.textContent = '0 exact clips. Related B-roll available.';
  }
};

window.addEventListener('DOMContentLoaded', () => {
  const style = document.createElement('style');
  style.textContent = `
    .clips .full-empty{grid-column:1 / -1; width:100%; line-height:1.35; white-space:normal}
    .full-empty .btn{margin-top:12px; margin-right:8px; display:inline-flex; justify-content:center; align-items:center; text-decoration:none}
  `;
  document.head.appendChild(style);
  renderSearchPlan();
});