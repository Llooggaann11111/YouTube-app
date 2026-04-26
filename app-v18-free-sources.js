const FP_FREE_SOURCES = [
  'Wikimedia Commons video',
  'Internet Archive movies',
  'NASA image and video library',
  'Library of Congress film and videos',
  'National Archives catalog',
  'DVIDS public military videos',
  'Pixabay videos',
  'Pexels videos',
  'Coverr videos'
];

function fsClean(value){return String(value||'').trim().replace(/\s+/g,' ')}
function fsEsc(value){return String(value||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')}
function fsCanUseClip(clip){return clip && (clip.videoUrl||clip.previewUrl) && playable(clip.videoUrl||clip.previewUrl,clip.mime||clip.type||clip.file_type,clip.source)}
function fsStatus(message){let box=document.querySelector('#freeSourceStatus');if(box)box.textContent=message;}
function fsEnsureSourceBox(){
  if(document.querySelector('#freeSourceStatus'))return;
  const plan=document.querySelector('#searchPlan');
  if(!plan||!plan.parentElement)return;
  const box=document.createElement('div');
  box.className='box';
  box.id='freeSourceStatus';
  box.textContent='Free source router ready: '+FP_FREE_SOURCES.join(', ');
  plan.parentElement.insertBefore(box,plan.nextSibling);
}
async function fsFetch(url,opt={},ms=12000){
  const controller=new AbortController();
  const id=setTimeout(()=>controller.abort(),ms);
  try{return await fetch(url,{...opt,signal:controller.signal})}
  finally{clearTimeout(id)}
}
function fsLooksLikeVideoUrl(u){return /\.(mp4|m4v|mov|webm|ogv)($|\?)/i.test(String(u||''))}
function fsLooksLikeMp4(u){return /\.mp4($|\?)/i.test(String(u||''))}
function fsSourceUrl(url){return String(url||'').replace(/^http:\/\//i,'https://')}

async function fsWikimediaDeep(query,many){
  const out=[];
  let offset=0;
  const loops=many?5:2;
  for(let i=0;i<loops;i++){
    const url='https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrlimit=50&gsroffset='+offset+'&gsrsearch='+encodeURIComponent(query+' filetype:video')+'&prop=imageinfo&iiprop=url|mime|extmetadata&format=json&origin=*';
    const res=await fsFetch(url);
    if(!res.ok)break;
    const json=await res.json();
    const pages=Object.values(json.query&&json.query.pages?json.query.pages:{});
    for(const page of pages){
      const info=page.imageinfo&&page.imageinfo[0];
      if(!info||!String(info.mime||'').startsWith('video/'))continue;
      if(!fsCanUseClip({videoUrl:info.url,mime:info.mime,source:'Wikimedia Commons'}))continue;
      const meta=info.extmetadata||{};
      const license=(meta.LicenseShortName&&meta.LicenseShortName.value)||(meta.UsageTerms&&meta.UsageTerms.value)||'Wikimedia license, verify on source';
      out.push({id:'commons-deep-'+page.pageid,source:'Wikimedia Commons',title:page.title||query,tags:(page.title||'')+' '+query,credit:meta.Artist&&meta.Artist.value?meta.Artist.value.replace(/<[^>]+>/g,''):'Wikimedia contributor',pageUrl:'https://commons.wikimedia.org/wiki/'+encodeURIComponent(String(page.title||'').replaceAll(' ','_')),videoUrl:info.url,previewUrl:info.url,license,mime:info.mime,duration:0});
    }
    if(!json.continue||!json.continue.gsroffset)break;
    offset=json.continue.gsroffset;
  }
  return out;
}

function fsArchiveFileUrl(identifier,name){return 'https://archive.org/download/'+encodeURIComponent(identifier)+'/'+String(name).split('/').map(encodeURIComponent).join('/')}
function fsPickArchiveFile(files){
  const list=Array.isArray(files)?files:[];
  const scored=list.map(f=>{const name=String(f.name||'');const format=String(f.format||'').toLowerCase();let score=0;if(/\.mp4$/i.test(name))score+=20;if(format.includes('mpeg4')||format.includes('h.264'))score+=18;if(format.includes('512kb'))score+=8;if(format.includes('original'))score+=2;if(/thumb|sample|gif|torrent|metadata|files.xml/i.test(name))score-=50;return{file:f,score};}).sort((a,b)=>b.score-a.score);
  const pick=scored.find(x=>x.score>10);
  return pick&&pick.file;
}
async function fsInternetArchive(query,many){
  const out=[];
  const rows=many?50:20;
  const search='('+query+') AND mediatype:(movies)';
  const url='https://archive.org/advancedsearch.php?q='+encodeURIComponent(search)+'&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=description&rows='+rows+'&page=1&output=json';
  const res=await fsFetch(url);
  if(!res.ok)return out;
  const json=await res.json();
  const docs=(json.response&&json.response.docs)||[];
  const max=many?22:10;
  for(const doc of docs.slice(0,max)){
    const identifier=doc.identifier;
    if(!identifier)continue;
    try{const metaRes=await fsFetch('https://archive.org/metadata/'+encodeURIComponent(identifier),{},10000);if(!metaRes.ok)continue;const meta=await metaRes.json();const file=fsPickArchiveFile(meta.files||[]);if(!file)continue;const videoUrl=fsArchiveFileUrl(identifier,file.name);const title=fsClean(doc.title||meta.metadata&&meta.metadata.title||identifier);out.push({id:'archive-'+identifier+'-'+file.name,source:'Internet Archive',title,tags:title+' '+fsClean(doc.description||'')+' '+query,credit:fsClean(doc.creator||meta.metadata&&meta.metadata.creator||'Internet Archive contributor'),pageUrl:'https://archive.org/details/'+identifier,videoUrl,previewUrl:videoUrl,license:'Internet Archive item, verify license on source',mime:'video/mp4',duration:Number(file.length||0)||0});}catch(e){}
  }
  return out.filter(fsCanUseClip);
}

async function fsNASA(query,many){
  const out=[];
  const pageSize=many?80:35;
  const url='https://images-api.nasa.gov/search?q='+encodeURIComponent(query)+'&media_type=video&page_size='+pageSize;
  const res=await fsFetch(url);
  if(!res.ok)return out;
  const json=await res.json();
  const items=(json.collection&&json.collection.items)||[];
  const max=many?25:10;
  for(const item of items.slice(0,max)){
    try{const data=(item.data&&item.data[0])||{};const href=item.href;if(!href)continue;const assetRes=await fsFetch(href,{},10000);if(!assetRes.ok)continue;const assets=await assetRes.json();const urls=Array.isArray(assets)?assets:[];const mp4=urls.find(u=>fsLooksLikeMp4(u)&&!/preview|thumb|small/i.test(String(u)))||urls.find(u=>fsLooksLikeMp4(u));if(!mp4)continue;const nasaId=data.nasa_id||'';out.push({id:'nasa-'+(nasaId||Math.random().toString(36).slice(2)),source:'NASA Video Library',title:data.title||query,tags:(data.title||'')+' '+(data.description||'')+' '+query,credit:'NASA',pageUrl:nasaId?'https://images.nasa.gov/details/'+encodeURIComponent(nasaId):'https://images.nasa.gov/search-results?q='+encodeURIComponent(query),videoUrl:mp4,previewUrl:mp4,license:'NASA media, verify usage rules on source',mime:'video/mp4',duration:0});}catch(e){}
  }
  return out.filter(fsCanUseClip);
}

function fsFindVideoInObject(obj,found=[]){
  if(!obj||found.length>8)return found;
  if(typeof obj==='string'){if(fsLooksLikeVideoUrl(obj))found.push(fsSourceUrl(obj));return found;}
  if(Array.isArray(obj)){for(const x of obj)fsFindVideoInObject(x,found);return found;}
  if(typeof obj==='object'){for(const k of Object.keys(obj)){fsFindVideoInObject(obj[k],found)}}
  return found;
}
async function fsLOC(query,many){
  const out=[];
  const count=many?50:25;
  const url='https://www.loc.gov/film-and-videos/?fo=json&c='+count+'&q='+encodeURIComponent(query);
  const res=await fsFetch(url,{},12000);
  if(!res.ok)return out;
  const json=await res.json();
  const results=json.results||[];
  for(const item of results){
    const urls=fsFindVideoInObject(item,[]);
    const mp4=urls.find(fsLooksLikeMp4)||urls[0];
    if(!mp4)continue;
    const title=fsClean(item.title||query);
    out.push({id:'loc-'+(item.id||item.url||title),source:'Library of Congress',title,tags:title+' '+fsClean(item.description||'')+' '+query,credit:'Library of Congress',pageUrl:item.url||'https://www.loc.gov/film-and-videos/?q='+encodeURIComponent(query),videoUrl:mp4,previewUrl:mp4,license:'Library of Congress item, verify rights on source',mime:fsLooksLikeMp4(mp4)?'video/mp4':'video/webm',duration:0});
  }
  return out.filter(fsCanUseClip);
}

async function fsNARA(query,many){
  const out=[];
  const rows=many?50:20;
  const url='https://catalog.archives.gov/api/v1/?q='+encodeURIComponent(query)+'&availableOnline=true&typeOfMaterials=Moving Images&rows='+rows;
  const res=await fsFetch(url,{},12000);
  if(!res.ok)return out;
  const json=await res.json();
  const records=((json.opaResponse||{}).results||{}).result||[];
  for(const r of Array.isArray(records)?records:[records]){
    const desc=(r.description&&r.description.item)||r.description||{};
    const title=fsClean(desc.title||query);
    const urls=fsFindVideoInObject(r,[]);
    const mp4=urls.find(fsLooksLikeMp4)||urls[0];
    if(!mp4)continue;
    const naId=desc.naId||desc.identifier||'';
    out.push({id:'nara-'+(naId||mp4),source:'National Archives',title,tags:title+' '+query,credit:'National Archives',pageUrl:naId?'https://catalog.archives.gov/id/'+naId:'https://catalog.archives.gov/search?q='+encodeURIComponent(query),videoUrl:mp4,previewUrl:mp4,license:'National Archives item, verify rights on source',mime:fsLooksLikeMp4(mp4)?'video/mp4':'video/webm',duration:0});
  }
  return out.filter(fsCanUseClip);
}

async function fsDVIDS(query,many){
  const out=[];
  const max=many?50:20;
  const endpoints=[
    'https://api.dvidshub.net/search?type=video&max_results='+max+'&query='+encodeURIComponent(query)+'&format=json',
    'https://api.dvidshub.net/search?type=video&max_results='+max+'&q='+encodeURIComponent(query)+'&format=json'
  ];
  for(const url of endpoints){
    try{
      const res=await fsFetch(url,{},12000);
      if(!res.ok)continue;
      const json=await res.json();
      const items=json.results||json.data||json.items||[];
      for(const item of Array.isArray(items)?items:[]){
        const urls=fsFindVideoInObject(item,[]);
        const mp4=urls.find(fsLooksLikeMp4)||urls[0];
        const title=fsClean(item.title||item.name||query);
        const page=item.url||item.web_url||item.link||'https://www.dvidshub.net/search?q='+encodeURIComponent(query);
        if(!mp4)continue;
        out.push({id:'dvids-'+(item.id||item.slug||mp4),source:'DVIDS',title,tags:title+' '+fsClean(item.description||item.caption||'')+' '+query,credit:item.credit||item.unit_name||'DVIDS',pageUrl:page,videoUrl:mp4,previewUrl:mp4,license:'DVIDS public media, verify rights on source',mime:fsLooksLikeMp4(mp4)?'video/mp4':'video/webm',duration:Number(item.duration||0)||0});
      }
      if(out.length)break;
    }catch(e){}
  }
  return out.filter(fsCanUseClip);
}

async function fsSearchAll(query,many){
  const results=[];
  const sources=[['Pixabay',typeof pix==='function'?pix:null],['Pexels',typeof pex==='function'?pex:null],['Coverr',typeof cov==='function'?cov:null],['Wikimedia Commons',fsWikimediaDeep],['Internet Archive',fsInternetArchive],['NASA',fsNASA],['Library of Congress',fsLOC],['National Archives',fsNARA],['DVIDS',fsDVIDS]];
  for(const [name,fn] of sources){
    if(!fn)continue;
    try{fsStatus('Searching '+name+': '+query);const list=await fn(query,many);if(list&&list.length)results.push(...list);}catch(e){}
  }
  return results;
}

search=async function freeSourceSearch(many=false){
  sync();app.clips=[];save();render();fsEnsureSourceBox();
  const q=queries();const runs=app.mode==='exact'?q.exact:[...q.exact,...q.related];
  if(!runs.length)return toast('Type a subject first.');
  count('Searching free sources...');
  for(const query of runs){merge(await fsSearchAll(query,many));}
  if(!app.clips.length&&app.mode==='exact'){app.mode='related';const mode=document.querySelector('#mode');if(mode)mode.value='related';save();toast('No exact clips. Switching to related object search.');await search(many);return;}
  const exact=app.clips.filter(c=>c.match==='exact').length;
  const related=app.clips.filter(c=>c.match!=='exact').length;
  count(exact+' exact, '+related+' related loaded');
  fsStatus('Sources used: '+FP_FREE_SOURCES.join(', '));
  toast(app.clips.length?'Search finished across free sources.':'No playable clips found. Try Search thousands or a simpler subject.');
}

window.addEventListener('DOMContentLoaded',()=>{fsEnsureSourceBox();fsStatus('Free source router ready: '+FP_FREE_SOURCES.join(', '));});
