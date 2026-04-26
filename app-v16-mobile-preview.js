const STORE = 'factpulse-v16';
const PREVIEW_STORE = 'factpulse-mobile-preview-clip';

function $(s){return document.querySelector(s)}
function clean(v){return String(v||'').trim().replace(/\s+/g,' ')}
function toast(msg){const t=$('#toast');if(!t)return;t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)}
function loadState(){try{return JSON.parse(localStorage.getItem(STORE)||'{}')}catch(_){return {}}}
function saveState(st){localStorage.setItem(STORE,JSON.stringify(st))}
function loadClip(){try{return JSON.parse(localStorage.getItem(PREVIEW_STORE)||'{}')}catch(_){return {}}}
function clipSource(clip){return clip.videoUrl||clip.previewUrl||clip.url||''}
function backUrl(){return localStorage.getItem('factpulse-last-clips-page')||'clips-coverr-v16.html'}
function setup(){
  const clip=loadClip();
  const src=clipSource(clip);
  $('#backBtn').href=backUrl();
  $('#clipsBtn').href=backUrl();
  $('#sourceBtn').href=clip.pageUrl||src||'#';
  $('#previewTitle').textContent=clip.title||clip.tags||'Video preview';
  $('#previewMeta').textContent=[clip.source,clip.license,clip.match==='exact'?'Exact match':'Related B-roll'].filter(Boolean).join(' · ');
  $('#previewNote').textContent='Mobile tip: tap Play video. iPhone often blocks autoplay until you tap. If the video still will not play, tap Open source.';
  const v=$('#previewVideo');
  if(!src){$('#previewMeta').textContent='No video URL found.';return}
  v.setAttribute('playsinline','');
  v.setAttribute('webkit-playsinline','');
  v.controls=true;
  v.preload='metadata';
  v.src=src;
  v.load();
  v.onloadedmetadata=()=>{
    const start=Number(clip.startTime||0);
    if(Number.isFinite(start)&&start>0){try{v.currentTime=start}catch(_){}}
    toast('Preview loaded');
  };
  v.onerror=()=>{toast('Video failed. Tap Open source.');$('#previewNote').textContent+='\n\nThis source may block mobile playback or use an unsupported format.'};
  $('#playBtn').onclick=async()=>{try{await v.play();toast('Playing')}catch(_){toast('Tap the video play button.')}};
  $('#addBtn').onclick=()=>{
    const st=loadState();
    st.timeline=Array.isArray(st.timeline)?st.timeline:[];
    st.timeline.push(clip);
    saveState(st);
    toast('Added to timeline');
    setTimeout(()=>location.href=backUrl(),700);
  };
}
setup();