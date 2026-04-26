(function(){
  const STORE='factpulse-v16';
  function clean(v){return String(v||'').trim().replace(/\s+/g,' ')}
  function lower(v){return clean(v).toLowerCase()}
  function load(){try{return JSON.parse(localStorage.getItem(STORE)||'{}')}catch(e){return{}}}
  function save(st){localStorage.setItem(STORE,JSON.stringify(st))}
  function toastMsg(m){if(window.toast)try{toast(m)}catch(e){}}
  function splitSentences(text){return clean(text).split(/(?<=[.!?])\s+/).map(clean).filter(s=>s.length>35&&s.length<240)}
  function nextIndex(subject,max){const st=load();const key='hookIndex_'+lower(subject).replace(/[^a-z0-9]+/g,'_');const n=((Number(st[key]||0)+1)%Math.max(1,max));st[key]=n;save(st);return n}
  function pickOne(subject,hooks,force){if(!hooks.length)return '';if(force)return hooks[nextIndex(subject,hooks.length)];const st=load();const key='hookIndex_'+lower(subject).replace(/[^a-z0-9]+/g,'_');return hooks[Number(st[key]||0)%hooks.length]}
  async function fetchJson(url,ms=9000){const ctrl=new AbortController();const id=setTimeout(()=>ctrl.abort(),ms);try{const r=await fetch(url,{signal:ctrl.signal});if(!r.ok)throw new Error('HTTP '+r.status);return await r.json()}catch(e){const prox='https://api.allorigins.win/raw?url='+encodeURIComponent(url);const r=await fetch(prox);if(!r.ok)throw new Error('proxy '+r.status);return await r.json()}finally{clearTimeout(id)}}
  async function researchTopic(subject){
    const key='research_'+lower(subject).replace(/[^a-z0-9]+/g,'_');
    const st=load();
    if(st[key]&&Date.now()-st[key].time<86400000)return st[key].data;
    const searchUrl='https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=1&srsearch='+encodeURIComponent(subject);
    const search=await fetchJson(searchUrl);
    const hit=search&&search.query&&search.query.search&&search.query.search[0];
    const title=hit&&hit.title?hit.title:subject;
    const sumUrl='https://en.wikipedia.org/api/rest_v1/page/summary/'+encodeURIComponent(title);
    const summary=await fetchJson(sumUrl);
    const data={
      title:clean(summary.title||title||subject),
      description:clean(summary.description||''),
      extract:clean(summary.extract||''),
      page:(summary.content_urls&&summary.content_urls.desktop&&summary.content_urls.desktop.page)||'',
      source:'Wikipedia'
    };
    st[key]={time:Date.now(),data};
    save(st);
    return data;
  }
  function chooseSpecificSentence(data){
    const sentences=splitSentences(data.extract||'');
    const priority=/discovered|became|first|youngest|oldest|largest|deadliest|survived|sank|founded|invented|created|released|record|viral|controvers|trial|arrest|won|award|known|began|rose|signed|opened|built|collapsed|died|killed|missing|murder|scandal|broke/i;
    return sentences.find(s=>priority.test(s))||sentences[1]||sentences[0]||clean(data.extract||'');
  }
  function shortFact(sentence,title){
    let s=clean(sentence).replace(/\s*\([^)]*\)/g,'');
    if(s.length>190)s=s.slice(0,187).replace(/\s+\S*$/,'')+'...';
    if(!s)return title+' has a detail most people miss.';
    return s;
  }
  function topicType(text){
    const s=lower(text);
    if(/singer|rapper|musician|songwriter|recording artist|band|album|music|pop|concert/.test(s))return 'music';
    if(/actor|actress|film|television|celebrity|model/.test(s))return 'celebrity';
    if(/ship|sank|disaster|earthquake|hurricane|eruption|volcano|flood|crash|deadliest/.test(s))return 'disaster';
    if(/court|judge|trial|lawyer|legal|convicted|lawsuit|crime|murder|killer/.test(s))return 'court';
    if(/space|planet|rocket|astronaut|nasa|moon|mars|black hole/.test(s))return 'space';
    if(/building|tower|skyscraper|bridge|construction|built/.test(s))return 'building';
    if(/animal|species|predator|wildlife|shark|lion|tiger|bear|snake/.test(s))return 'animal';
    if(/technology|computer|internet|software|ai|robot|phone|youtube/.test(s))return 'tech';
    return 'general';
  }
  function buildResearchHooks(subject,data){
    const title=clean(data.title||subject);
    const desc=clean(data.description||'');
    const specific=shortFact(chooseSpecificSentence(data),title);
    const type=topicType((title+' '+desc+' '+data.extract));
    const hooks={
      music:[
        title+' did not become huge by accident. '+specific+' That detail makes the fame story way more interesting.',
        'The wild part about '+title+' is how fast one moment can change a career. '+specific,
        title+' looks like a normal superstar story until you notice this detail: '+specific,
        'Before the fame looked permanent, '+title+' had a turning point people still talk about. '+specific,
        'The hook with '+title+' is not just the music. It is the moment the world started paying attention: '+specific
      ],
      celebrity:[
        title+' looks glamorous from the outside, but the interesting part is the turn that made everyone watch. '+specific,
        'The reason '+title+' keeps pulling attention is hidden in one detail: '+specific,
        'A celebrity story gets interesting when one moment becomes bigger than the person expected. For '+title+', '+specific,
        title+' became more than a name because of moments like this: '+specific,
        'The part people miss about '+title+' is how one public detail can reshape the whole story. '+specific
      ],
      disaster:[
        'The chilling part about '+title+' is how normal everything can look before disaster becomes history. '+specific,
        title+' is not interesting because it was big. It is interesting because one detail changed everything: '+specific,
        'This is the kind of story where one decision, one warning, or one failure matters. '+specific,
        'The scary detail about '+title+' is the timeline. '+specific,
        title+' still grabs attention because the facts feel almost unreal. '+specific
      ],
      court:[
        'Court stories get interesting when one detail flips the room. With '+title+', '+specific,
        'The tense part about '+title+' is not the noise. It is the evidence, timing, and one fact that changes the story: '+specific,
        title+' shows how quickly a public story can become a legal one. '+specific,
        'The part that makes '+title+' worth watching is the detail most people would miss first. '+specific,
        'Legal stories feel slow until the key fact lands. For '+title+', '+specific
      ],
      space:[
        title+' is fascinating because space makes every small detail serious. '+specific,
        'The mind-bending part about '+title+' is not just the science. It is this detail: '+specific,
        title+' makes people stop because it turns distance, danger, and discovery into one story. '+specific,
        'Space stories feel quiet, but the facts can be intense. '+specific,
        'The interesting thing about '+title+' is how one discovery changes how we picture the universe. '+specific
      ],
      building:[
        title+' looks simple from far away, but the interesting part is the engineering risk behind it. '+specific,
        'The hidden story behind '+title+' is not just height or size. It is this detail: '+specific,
        title+' became impressive because someone had to turn an impossible-looking idea into a real structure. '+specific,
        'Every landmark has a detail most people miss. For '+title+', '+specific,
        'The hook with '+title+' is that the clean final look hides the hard part: '+specific
      ],
      animal:[
        title+' is interesting because nature does not waste details. '+specific,
        'The wild part about '+title+' is not just how it looks. It is the survival detail behind it: '+specific,
        title+' proves nature can be stranger than anything made for a movie. '+specific,
        'The detail that makes '+title+' worth watching is simple: '+specific,
        'Animals become fascinating when one trait explains how they survive. With '+title+', '+specific
      ],
      tech:[
        title+' gets interesting when you realize one technical idea changed real behavior. '+specific,
        'The creepy and interesting part about '+title+' is how normal it feels now. '+specific,
        title+' is not just tech. It changed what people do, watch, share, or trust. '+specific,
        'The hidden hook with '+title+' is the detail behind the screen: '+specific,
        'Technology stories matter when one invention changes everyday life. '+specific
      ],
      general:[
        title+' gets interesting when you stop looking at the obvious part and notice this: '+specific,
        'The story behind '+title+' has a real turn. '+specific,
        title+' looks simple from far away, but this detail changes the whole story: '+specific,
        'The part people miss about '+title+' is the fact that explains why it became famous: '+specific,
        'Here is the detail that makes '+title+' worth watching: '+specific
      ]
    };
    return hooks[type]||hooks.general;
  }
  function fallbackProfile(subject,force){
    const name=clean(subject)||'this topic';
    const hooks=[
      name+' gets interesting when you stop looking at the obvious part and follow the detail most people miss.',
      'The story behind '+name+' has a turn most people do not expect. At first it looks simple, then the details change the whole thing.',
      name+' looks ordinary from far away, but the closer you look, the stranger the story gets.',
      'The part people remember about '+name+' is not always the biggest moment. Sometimes it is the detail that makes everything click.',
      'What makes '+name+' worth watching is the hidden tension. Something small is usually doing more work than people realize.'
    ];
    return {scene:name+' close up dramatic footage real event interesting tension b roll',fact:pickOne(subject,hooks,force)};
  }
  async function profile(subject,force){
    try{
      const data=await researchTopic(subject);
      const hooks=buildResearchHooks(subject,data);
      const scene=clean((data.title||subject)+' '+(data.description||'')+' interview public event real footage').slice(0,180);
      return {scene,fact:pickOne(subject,hooks,force),source:data.page||data.source};
    }catch(e){
      return fallbackProfile(subject,force);
    }
  }
  async function apply(force){
    const subjectInput=document.querySelector('#subject');
    const factInput=document.querySelector('#fact');
    const sceneInput=document.querySelector('#scene');
    const detailsInput=document.querySelector('#details');
    const btn=document.querySelector('#autoFill');
    const subject=clean(subjectInput&&subjectInput.value);
    if(!subject)return;
    if(btn){btn.disabled=true;btn.textContent='Researching topic...'}
    const p=await profile(subject,force);
    const st=load();
    st.subject=subject;
    if(force||!clean(factInput&&factInput.value)){st.fact=p.fact;if(factInput)factInput.value=p.fact}
    if(sceneInput){sceneInput.value=p.scene;st.scene=p.scene}
    if(detailsInput){detailsInput.value='researched hook, interesting twist, real topic detail, no random filler';st.details=detailsInput.value}
    st.captionStyle='researched_viral_hook';
    st.researchSource=p.source||'';
    save(st);
    if(btn){btn.disabled=false;btn.textContent='Research topic + generate hook'}
    toastMsg(p.source?'Researched hook generated.':'Hook generated with fallback.');
  }
  function bind(){
    const btn=document.querySelector('#autoFill');
    if(btn){btn.textContent='Research topic + generate hook';btn.onclick=function(e){e.preventDefault();apply(true)}}
    const subject=document.querySelector('#subject');
    const fact=document.querySelector('#fact');
    if(subject&&!subject.dataset.researchedFacts){subject.dataset.researchedFacts='1';subject.addEventListener('change',function(){if(!clean(fact&&fact.value))apply(false)})}
    if(fact&&!fact.dataset.researchedFacts){fact.dataset.researchedFacts='1';const st=load();if(st.fact&&!clean(fact.value))fact.value=st.fact;fact.addEventListener('input',function(){const st=load();st.fact=clean(fact.value);save(st)})}
  }
  window.FactPulseBetterFacts={apply,pickProfile:profile,researchTopic};
  window.addEventListener('DOMContentLoaded',bind);
  setTimeout(bind,500);
})();