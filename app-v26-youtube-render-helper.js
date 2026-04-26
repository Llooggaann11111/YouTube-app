(function(){
  const STORE='factpulse-v16';
  function qs(x){return document.querySelector(x)}
  function clean(x){return String(x||'').trim().replace(/\s+/g,' ')}
  function read(){try{return JSON.parse(localStorage.getItem(STORE)||'{}')}catch(e){return{}}}
  function write(st){localStorage.setItem(STORE,JSON.stringify(st))}
  function isYouTube(c){return !!c&&(c.embed||/youtube/i.test(c.source||'')||/^yt-/.test(c.id||''))}
  function toastMsg(m){if(typeof toast==='function')toast(m);else alert(m)}
  function ensurePanel(){
    if(qs('#ytRenderRefPanel'))return;
    const form=qs('.form');
    if(!form)return;
    const box=document.createElement('div');
    box.id='ytRenderRefPanel';
    box.className='box';
    box.innerHTML='<strong>YouTube render helper</strong><br><span id="ytRenderRefText">No YouTube reference selected.</span><div class="two" style="margin-top:10px"><button class="btn" id="findSafeFromYT" type="button">Find render-safe match</button><button class="btn" id="clearYTRef" type="button">Clear reference</button></div>';
    const log=qs('#log');
    form.insertBefore(box,log||form.firstChild);
    qs('#findSafeFromYT').onclick=function(){findRenderableFromReference()};
    qs('#clearYTRef').onclick=function(){const st=read();st.youtubeReferences=[];st.youtubeReference=null;write(st);updatePanel();toastMsg('YouTube reference cleared.')};
    updatePanel();
  }
  function updatePanel(){
    const el=qs('#ytRenderRefText');
    if(!el)return;
    const st=read();
    const ref=(st.youtubeReferences&&st.youtubeReferences[0])||st.youtubeReference;
    if(!ref){el.textContent='No YouTube reference selected. Pick a YouTube result, then press Use as Reference.';return}
    el.textContent='Reference: '+(ref.title||'YouTube clip')+' | '+(ref.channel||'YouTube')+'. This guides captions and render-safe clip search.';
  }
  function saveReference(c){
    const st=read();
    const ref={
      id:c.id||'',
      title:c.title||'',
      channel:c.channel||'',
      page:c.page||'',
      embedUrl:c.embedUrl||'',
      duration:c.duration||0,
      source:'YouTube reference'
    };
    st.youtubeReference=ref;
    st.youtubeReferences=[ref];
    st.renderReference=ref.title;
    st.fact=clean(st.fact)||clean(c.title)||clean(st.subject)||'Watch this clip';
    st.captionLine=clean(st.fact||c.title||st.subject);
    st.scene=clean((st.subject||'')+' '+(c.title||'')+' render safe footage b roll');
    write(st);
    if(window.s){
      s.youtubeReference=ref;
      s.youtubeReferences=[ref];
      s.fact=st.fact;
      const fact=qs('#fact');
      if(fact&&!clean(fact.value))fact.value=st.fact;
    }
    updatePanel();
    toastMsg('YouTube saved as render reference. Now press Find render-safe match.');
  }
  const wait=setInterval(function(){
    if(typeof renderResults==='function'&&typeof findClip==='function'){
      clearInterval(wait);
      install();
    }
  },250);
  function install(){
    ensurePanel();
    const oldSelect=window.selectClip;
    window.selectClip=function(id,silent){
      const c=findClip(id);
      if(isYouTube(c)){
        saveReference(c);
        return;
      }
      return oldSelect(id,silent);
    };
    const oldRenderResults=window.renderResults;
    window.renderResults=function(){
      oldRenderResults();
      document.querySelectorAll('[data-use]').forEach(btn=>{
        const c=findClip(btn.dataset.use);
        if(isYouTube(c))btn.textContent='Use as Reference';
      });
      updatePanel();
    };
    const oldRenderTimeline=window.renderTimeline;
    if(typeof oldRenderTimeline==='function'){
      window.renderTimeline=function(){
        oldRenderTimeline();
        updatePanel();
      };
    }
    updatePanel();
  }
  async function findRenderableFromReference(){
    const st=read();
    const ref=(st.youtubeReferences&&st.youtubeReferences[0])||st.youtubeReference;
    if(!ref){toastMsg('Pick a YouTube result first.');return}
    if(typeof searchAll!=='function'){toastMsg('Search is not ready yet.');return}
    const subject=qs('#subject');
    const oldSubject=subject?subject.value:'';
    const base=clean((st.subject||oldSubject||'')+' '+(ref.title||'')).replace(/\b(official|video|youtube|full|hd|4k)\b/gi,'').slice(0,120);
    if(subject)subject.value=base;
    if(window.s){s.subject=base;s.timeline=[];s.clips=[]}
    const oldKey=qs('#youtubeKey')?qs('#youtubeKey').value:'';
    if(qs('#youtubeKey'))qs('#youtubeKey').value='';
    window.fp26RenderableMode=true;
    toastMsg('Searching render-safe clips based on the YouTube reference.');
    try{await searchAll(false)}catch(e){toastMsg('Render-safe search failed. Try a shorter subject.')}
    window.fp26RenderableMode=false;
    if(qs('#youtubeKey'))qs('#youtubeKey').value=oldKey;
    if(subject&&!clean(subject.value))subject.value=oldSubject;
  }
})();