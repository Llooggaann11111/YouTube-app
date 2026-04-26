function uifSubject(){return clean((document.querySelector('#subject')&&document.querySelector('#subject').value)||app.subject||'').toLowerCase()}
function uifToast(m){if(typeof toast==='function')toast(m)}
function uifEnsureClearTimeline(){
  const head=document.querySelector('#timelineCount');
  if(!head||document.querySelector('#clearTimelineBtn'))return;
  const btn=document.createElement('button');
  btn.id='clearTimelineBtn';
  btn.type='button';
  btn.className='btn secondary';
  btn.style.marginTop='10px';
  btn.textContent='Clear timeline';
  btn.onclick=()=>{app.timeline=[];save();timeline();uifToast('Timeline cleared.')};
  head.parentElement.appendChild(btn);
}
const uifOldTimeline=typeof timeline==='function'?timeline:null;
if(uifOldTimeline){timeline=function(){uifOldTimeline();uifEnsureClearTimeline();}}
function uifRender(){
  let g=document.querySelector('#clipGrid');
  if(!g)return;
  g.innerHTML='';
  if(!(app.clips||[]).length){
    const subject=clean(app.subject||document.querySelector('#subject')?.value||'this subject');
    g.innerHTML='<div class="box full-empty">No clips loaded for '+esc(subject)+'. Press Search clips or Search thousands. For better results, add a Pixabay or Pexels key, or try simpler object words like courtroom, judge, courthouse, ship, volcano, singer, or building.</div>';
    if(typeof count==='function')count('0 clips loaded');
    return;
  }
  let ex=app.clips.filter(c=>c.match==='exact'),re=app.clips.filter(c=>c.match!=='exact'),groups=[];
  if(ex.length)groups.push(['EXACT OBJECT',ex]);
  if(re.length)groups.push(['RELATED OBJECT B-ROLL',re]);
  let f=document.createDocumentFragment();
  for(let [label,list]of groups){
    let h=document.createElement('div');
    h.className='box';
    h.textContent=label+' · '+list.length+' clips';
    f.appendChild(h);
    for(let c of list){
      let card=document.createElement('article');
      card.className='clip';
      card.innerHTML='<div class="thumb"><button class="btn secondary" data-preview-id="'+c.id+'" type="button" style="width:100%;height:100%;border-radius:14px">Preview</button></div><strong>'+esc(label)+' · '+esc(c.source)+'</strong><small>'+esc(c.license)+'</small><small>'+esc((c.tags||c.title||'').slice(0,100))+'</small><div class="row"><button type="button" data-preview-id="'+c.id+'">Preview</button><button type="button" data-add-id="'+c.id+'">Add</button></div><a href="'+(c.pageUrl||c.videoUrl)+'" target="_blank" rel="noopener">Source</a>';
      f.appendChild(card);
    }
  }
  g.appendChild(f);
  if(typeof count==='function')count(ex.length+' exact, '+re.length+' related loaded');
}
render=uifRender;
const uifOldSearch=typeof search==='function'?search:null;
if(uifOldSearch){
  search=async function(many=false){
    const before=clean(app.lastSearchSubject||'').toLowerCase();
    sync();
    const current=uifSubject();
    if(before&&current&&before!==current){app.timeline=[];app.clips=[];save();timeline();uifToast('New subject detected. Old timeline cleared.');}
    app.lastSearchSubject=current;
    save();
    return await uifOldSearch(many);
  }
}
window.addEventListener('DOMContentLoaded',()=>{uifEnsureClearTimeline();uifRender();});