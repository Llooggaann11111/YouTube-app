(function(){
  const STORE='factpulse-v16';
  function clean(v){return String(v||'').trim().replace(/\s+/g,' ')}
  function lower(v){return clean(v).toLowerCase()}
  function load(){try{return JSON.parse(localStorage.getItem(STORE)||'{}')}catch(e){return{}}}
  function save(st){localStorage.setItem(STORE,JSON.stringify(st))}
  function toastMsg(m){if(window.toast)try{toast(m)}catch(e){}}
  function sentences(text){return clean(text).replace(/\s*\([^)]*\)/g,'').split(/\.\s+|!\s+|\?\s+/).map(clean).filter(x=>x.length>35&&x.length<260)}
  function nextIndex(subject,max){const st=load();const key='hookIndex_'+lower(subject).replace(/[^a-z0-9]+/g,'_');const n=((Number(st[key]||0)+1)%Math.max(1,max));st[key]=n;save(st);return n}
  function pickOne(subject,hooks,force){if(!hooks.length)return '';if(force)return hooks[nextIndex(subject,hooks.length)];const st=load();const key='hookIndex_'+lower(subject).replace(/[^a-z0-9]+/g,'_');return hooks[Number(st[key]||0)%hooks.length]}
  async function fetchJson(url,opt={},ms=9000){
    const ctrl=new AbortController();
    const id=setTimeout(()=>ctrl.abort(),ms);
    try{const r=await fetch(url,{...opt,signal:ctrl.signal});if(!r.ok)throw new Error('HTTP '+r.status);return await r.json()}
    catch(e){const prox='https://api.allorigins.win/raw?url='+encodeURIComponent(url);const r=await fetch(prox,opt);if(!r.ok)throw new Error('proxy '+r.status);return await r.json()}
    finally{clearTimeout(id)}
  }
  async function wikiResearch(subject){
    const out=[];
    const search='https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=4&srsearch='+encodeURIComponent(subject);
    const data=await fetchJson(search);
    const hits=(data.query&&data.query.search)||[];
    for(const hit of hits.slice(0,3)){
      try{
        const title=hit.title||subject;
        const sum=await fetchJson('https://en.wikipedia.org/api/rest_v1/page/summary/'+encodeURIComponent(title));
        out.push({source:'Wikipedia',title:clean(sum.title||title),description:clean(sum.description||''),extract:clean(sum.extract||''),page:(sum.content_urls&&sum.content_urls.desktop&&sum.content_urls.desktop.page)||''});
      }catch(e){}
    }
    return out;
  }
  async function wikidataResearch(subject){
    try{
      const url='https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&origin=*&language=en&limit=5&search='+encodeURIComponent(subject);
      const data=await fetchJson(url);
      return (data.search||[]).map(x=>({source:'Wikidata',title:clean(x.label||subject),description:clean(x.description||''),extract:clean((x.label||subject)+' is connected to '+(x.description||'a notable topic')+'.'),page:x.concepturi||''}));
    }catch(e){return []}
  }
  async function youtubeResearch(subject){
    const key=localStorage.getItem('factpulse-youtube-key')||'';
    if(!key)return [];
    try{
      const q=subject+' interview award show public event facts';
      const p=new URLSearchParams({part:'snippet',type:'video',q:q,maxResults:'5',safeSearch:'strict',videoEmbeddable:'true',key:key});
      const data=await fetchJson('https://www.googleapis.com/youtube/v3/search?'+p.toString());
      return (data.items||[]).map(v=>{const sn=v.snippet||{};return{source:'YouTube titles',title:clean(sn.title||subject),description:clean(sn.channelTitle||''),extract:clean((sn.title||'')+'. '+(sn.description||'')),page:v.id&&v.id.videoId?'https://www.youtube.com/watch?v='+v.id.videoId:''}});
    }catch(e){return []}
  }
  async function researchTopic(subject){
    const key='research_all_'+lower(subject).replace(/[^a-z0-9]+/g,'_');
    const st=load();
    if(st[key]&&Date.now()-st[key].time<86400000)return st[key].data;
    let items=[];
    const batches=await Promise.allSettled([wikiResearch(subject),wikidataResearch(subject),youtubeResearch(subject)]);
    batches.forEach(b=>{if(b.status==='fulfilled'&&Array.isArray(b.value))items=items.concat(b.value)});
    const best=items.find(x=>x.extract&&lower(x.title).includes(lower(subject).split(' ')[0]))||items.find(x=>x.extract)||items[0];
    const data={subject:clean(subject),items:items,title:clean((best&&best.title)||subject),description:clean((best&&best.description)||''),extract:clean((best&&best.extract)||''),page:(best&&best.page)||'',source:(best&&best.source)||'Research'};
    st[key]={time:Date.now(),data};
    save(st);
    return data;
  }
  function factScore(sentence){
    let s=lower(sentence),score=0;
    if(/\d{4}|\d+|million|billion|first|youngest|oldest|largest|record|award|won|discovered|signed|released|created|founded|invented|built|opened|sank|collapsed|viral|controvers|trial|arrest|lawsuit|deadliest|survived|changed|known for|became|rose to|began/i.test(sentence))score+=8;
    if(/is an?|was an?|born|located|type of|species of/i.test(sentence))score-=2;
    if(sentence.length>70&&sentence.length<190)score+=3;
    if(s.includes('known for'))score+=2;
    return score;
  }
  function pickSpecificFact(data){
    const all=[];
    (data.items||[]).forEach(item=>{
      sentences(item.extract||'').forEach(s=>all.push({text:s,source:item.source,title:item.title,page:item.page,score:factScore(s)}));
    });
    if(!all.length&&data.extract)sentences(data.extract).forEach(s=>all.push({text:s,source:data.source,title:data.title,page:data.page,score:factScore(s)}));
    all.sort((a,b)=>b.score-a.score);
    const best=all[0];
    if(best&&best.text)return best;
    return {text:data.title+' is known for a detail most people skip over.',source:data.source,title:data.title,page:data.page,score:0};
  }
  function topicType(data,fact){
    const s=lower([data.title,data.description,data.extract,fact].join(' '));
    if(/singer|rapper|musician|songwriter|recording artist|album|song|music|concert|tour/.test(s))return 'music';
    if(/actor|actress|film|television|model|celebrity|award show|red carpet/.test(s))return 'celebrity';
    if(/court|judge|trial|lawsuit|legal|convicted|crime|murder|arrest|prison|jury/.test(s))return 'court';
    if(/ship|sank|disaster|earthquake|hurricane|tsunami|eruption|volcano|crash|deadliest|flood/.test(s))return 'disaster';
    if(/space|planet|rocket|astronaut|nasa|moon|mars|black hole|galaxy/.test(s))return 'space';
    if(/animal|species|wildlife|predator|shark|lion|tiger|bear|snake|bird/.test(s))return 'animal';
    if(/technology|software|internet|computer|phone|ai|robot|app|youtube/.test(s))return 'tech';
    if(/building|tower|bridge|skyscraper|construction|built|architecture/.test(s))return 'building';
    return 'general';
  }
  function trimFact(text){let s=clean(text);if(s.length>210)s=s.slice(0,207).replace(/\s+\S*$/,'')+'...';return s}
  function buildHooks(subject,data){
    const picked=pickSpecificFact(data);
    const title=clean(data.title||subject);
    const fact=trimFact(picked.text);
    const type=topicType(data,fact);
    const templates={
      music:[
        'The hook is not just that '+title+' became famous. It is how it happened: '+fact+'.',
        title+' looks like a superstar story, but this detail makes it way more interesting: '+fact+'.',
        'Most people know the name. The better part is the turning point: '+fact+'.',
        title+' did not become a headline for no reason. This is the detail that makes the story stick: '+fact+'.',
        'This is why '+title+' works as a short: fame, timing, and one real detail. '+fact+'.'
      ],
      celebrity:[
        title+' looks glamorous from far away, but the real hook is this: '+fact+'.',
        'The interesting part about '+title+' is the moment behind the image. '+fact+'.',
        'A public figure becomes unforgettable when one detail changes how people see them. For '+title+', '+fact+'.',
        'The clip hook is simple: people know '+title+', but they may not know this. '+fact+'.',
        title+' has a story that gets better when you zoom in. '+fact+'.'
      ],
      court:[
        'The courtroom hook is this: one fact can flip the whole story. '+fact+'.',
        title+' is interesting because the details matter more than the noise. '+fact+'.',
        'Legal stories feel slow until one fact lands. For '+title+', '+fact+'.',
        'The tension comes from what can be proven. '+fact+'.',
        'This topic works because one detail decides how the audience sees the case: '+fact+'.'
      ],
      disaster:[
        'The chilling part about '+title+' is not just what happened. It is the detail that made it worse: '+fact+'.',
        title+' still grabs attention because the facts feel almost unreal. '+fact+'.',
        'Disaster stories hit hardest when one small detail changes everything. '+fact+'.',
        'At first, it sounds like history. Then this detail makes it feel real: '+fact+'.',
        'This is the hook: normal life changed because of one chain of events. '+fact+'.'
      ],
      space:[
        title+' is interesting because space turns small details into huge risks. '+fact+'.',
        'The mind-bending part is this: '+fact+'.',
        'Space stories look quiet, but the facts are intense. '+fact+'.',
        'The hook with '+title+' is discovery mixed with danger. '+fact+'.',
        'This fact makes '+title+' worth watching: '+fact+'.'
      ],
      animal:[
        title+' is interesting because nature does not waste details. '+fact+'.',
        'The wild part is not just how it looks. It is this survival detail: '+fact+'.',
        'Nature gets strange when you look closely. '+fact+'.',
        'This is the animal fact that makes people stop scrolling: '+fact+'.',
        'The hook is simple. '+title+' has a trait or story most people miss: '+fact+'.'
      ],
      tech:[
        title+' gets interesting when you realize one technical idea changed real behavior. '+fact+'.',
        'The hidden hook is behind the screen: '+fact+'.',
        'Tech stories matter when one system changes what people do. '+fact+'.',
        'The creepy and interesting part is how normal this feels now. '+fact+'.',
        'This is why '+title+' matters: '+fact+'.'
      ],
      building:[
        title+' looks simple from far away, but the real story is in the build. '+fact+'.',
        'The hidden hook is not just size or height. It is this detail: '+fact+'.',
        'Landmarks become interesting when you learn what it took to make them real. '+fact+'.',
        'This is the part most people miss when they look at '+title+': '+fact+'.',
        'The final result looks clean, but the story behind it is harder. '+fact+'.'
      ],
      general:[
        title+' gets interesting when you stop at the detail most people skip: '+fact+'.',
        'The story behind '+title+' has a real hook. '+fact+'.',
        title+' looks simple from far away, but this detail changes the whole story: '+fact+'.',
        'The part people miss about '+title+' is the fact that explains why it matters: '+fact+'.',
        'Here is the detail that makes '+title+' worth watching: '+fact+'.'
      ]
    };
    return {hooks:templates[type]||templates.general,scene:clean(title+' '+data.description+' '+type+' real footage interview public event').slice(0,180),source:picked.page||data.page||picked.source||data.source,rawFact:fact};
  }
  async function profile(subject,force){
    const data=await researchTopic(subject);
    const built=buildHooks(subject,data);
    return {scene:built.scene,fact:pickOne(subject,built.hooks,force),source:built.source,rawFact:built.rawFact};
  }
  async function apply(force){
    const subjectInput=document.querySelector('#subject');
    const factInput=document.querySelector('#fact');
    const sceneInput=document.querySelector('#scene');
    const detailsInput=document.querySelector('#details');
    const box=document.querySelector('#searchPlan');
    const btn=document.querySelector('#autoFill');
    const subject=clean(subjectInput&&subjectInput.value);
    if(!subject)return;
    if(btn){btn.disabled=true;btn.textContent='Researching every source...'}
    let p;
    try{p=await profile(subject,force)}catch(e){p={scene:subject+' real footage public event interview',fact:'The story gets interesting when you research the real details behind '+subject+'.',source:'fallback',rawFact:''}}
    const st=load();
    st.subject=subject;
    if(force||!clean(factInput&&factInput.value)){st.fact=p.fact;if(factInput)factInput.value=p.fact}
    if(sceneInput){sceneInput.value=p.scene;st.scene=p.scene}
    if(detailsInput){detailsInput.value='researched hook, topic-specific fact, real source detail, no generic filler';st.details=detailsInput.value}
    st.captionStyle='researched_topic_specific_hook';
    st.researchSource=p.source||'';
    st.rawResearchFact=p.rawFact||'';
    save(st);
    if(box)box.textContent='Researched source: '+(p.source||'fallback')+'\nFact used: '+(p.rawFact||p.fact);
    if(btn){btn.disabled=false;btn.textContent='Research every topic + generate hook'}
    toastMsg(p.source&&p.source!=='fallback'?'Topic-specific researched hook generated.':'Fallback hook generated.');
  }
  function bind(){
    const btn=document.querySelector('#autoFill');
    if(btn){btn.textContent='Research every topic + generate hook';btn.onclick=function(e){e.preventDefault();apply(true)}}
    const subject=document.querySelector('#subject');
    const fact=document.querySelector('#fact');
    if(subject&&!subject.dataset.researchedFacts){subject.dataset.researchedFacts='1';subject.addEventListener('change',function(){if(!clean(fact&&fact.value))apply(false)})}
    if(fact&&!fact.dataset.researchedFacts){fact.dataset.researchedFacts='1';const st=load();if(st.fact&&!clean(fact.value))fact.value=st.fact;fact.addEventListener('input',function(){const st=load();st.fact=clean(fact.value);save(st)})}
  }
  window.FactPulseBetterFacts={apply,pickProfile:profile,researchTopic};
  window.addEventListener('DOMContentLoaded',bind);
  setTimeout(bind,500);
})();