(function(){
  const STORE='factpulse-v16';
  function clean(v){return String(v||'').trim().replace(/\s+/g,' ')}
  function lower(v){return clean(v).toLowerCase()}
  function load(){try{return JSON.parse(localStorage.getItem(STORE)||'{}')}catch(e){return{}}}
  function save(st){localStorage.setItem(STORE,JSON.stringify(st))}
  function pickProfile(subject){
    const s=lower(subject);
    const name=clean(subject)||'this topic';
    const profiles=[
      {re:/titanic|ship|sinking|ocean liner|iceberg/,scene:'ship ocean liner iceberg freezing water dark night lifeboats disaster',fact:'The chilling part about the Titanic is that the danger was quiet at first. One scrape in the dark turned a luxury trip into a fight for lifeboats, freezing water, and time.'},
      {re:/court|judge|trial|lawyer|lawsuit|crime|prison|jail|verdict|jury/,scene:'courtroom judge jury lawyer verdict tense hearing evidence',fact:'A courtroom can look calm, but one sentence can change a life. One detail, one witness, or one verdict can decide who walks free and who loses years.'},
      {re:/killer|murder|serial|crime scene|missing person|detective/,scene:'crime scene police tape detective dark street evidence',fact:'The scariest part of a crime story is usually the small clue everyone missed. A receipt, a camera angle, or one strange timeline can break the whole case open.'},
      {re:/lady gaga|celebrity|actor|actress|singer|rapper|artist|famous|red carpet|award show/,scene:'celebrity red carpet flashing cameras stage crowd interview award show',fact:'The dark side of fame is that one public moment can follow a person forever. A clip, a mistake, or a rumor can become the version millions remember.'},
      {re:/concert|stage|music|performance|tour|microphone/,scene:'concert stage lights screaming crowd microphone performance',fact:'A live show looks controlled, but one wrong cue can turn the entire room chaotic. Thousands of people, loud sound, hot lights, and split-second timing all have to work at once.'},
      {re:/volcano|eruption|lava|ash/,scene:'volcano lava eruption ash smoke mountain disaster',fact:'A volcano can look still for years, then change everything in minutes. The scary part is not just the lava, it is the ash, gas, heat, and silence before it breaks open.'},
      {re:/earthquake|hurricane|tornado|tsunami|flood|storm|disaster/,scene:'storm flood tornado earthquake disaster damage emergency',fact:'Natural disasters are terrifying because the warning can be shorter than the damage. In minutes, normal streets can become places people cannot escape.'},
      {re:/space|rocket|astronaut|planet|moon|mars|nasa|black hole/,scene:'space rocket astronaut planet dark universe stars',fact:'Space is beautiful, but it is also deadly. No air, no sound, extreme cold, and endless distance mean one small failure can become impossible to fix.'},
      {re:/ocean|shark|whale|deep sea|submarine|sea/,scene:'dark ocean deep sea waves submarine shark water',fact:'The ocean gets scarier the deeper you go. Light disappears, pressure rises, and most of what lives down there has never been seen by most humans.'},
      {re:/animal|lion|tiger|bear|wolf|snake|crocodile|alligator|shark/,scene:'wild animal predator close up nature danger',fact:'Predators do not need to look dramatic to be dangerous. The scariest attacks often happen fast, quiet, and before the target realizes it is being watched.'},
      {re:/war|soldier|army|military|battle|weapon|tank/,scene:'soldiers battlefield military smoke historic war footage',fact:'War footage can look distant until you remember every frame had real people inside it. One order, one mistake, or one explosion can change families forever.'},
      {re:/money|bank|billionaire|stock|business|scam|fraud|rich/,scene:'money cash bank business office dark finance',fact:'Money stories get scary when people stop seeing numbers and start losing lives, homes, and futures. One hidden decision can wreck thousands of people at once.'},
      {re:/school|student|teacher|college|exam|classroom/,scene:'school hallway classroom students desks quiet tension',fact:'A school can look ordinary, but pressure builds quietly. Grades, rumors, stress, and one bad day can change how someone remembers a place forever.'},
      {re:/doctor|hospital|medical|disease|virus|surgery|patient/,scene:'hospital doctor emergency room medical monitors patient',fact:'Hospitals feel safe, but they are built around emergencies. Behind every calm hallway, someone may be fighting a clock that no one else can see.'},
      {re:/ai|robot|technology|computer|phone|internet|app|youtube/,scene:'computer screen phone technology dark server data code',fact:'Technology feels harmless until it starts making choices faster than people can understand. A single tap can spread a lie, expose a secret, or change someone’s life.'},
      {re:/building|skyscraper|tower|bridge|burj|construction/,scene:'skyscraper tower glass building height workers city',fact:'Tall buildings look smooth from the ground, but every window, cable, and ledge has a risk behind it. At that height, one mistake has no time to be fixed.'}
    ];
    return profiles.find(p=>p.re.test(s))||{scene:name+' close up dramatic footage real event b roll',fact:'The chilling part about '+name+' is the detail most people miss. What looks normal at first can turn strange once you know what happened next.'};
  }
  function apply(force){
    const subjectInput=document.querySelector('#subject');
    const factInput=document.querySelector('#fact');
    const sceneInput=document.querySelector('#scene');
    const detailsInput=document.querySelector('#details');
    const subject=clean(subjectInput&&subjectInput.value);
    if(!subject)return;
    const p=pickProfile(subject);
    const st=load();
    st.subject=subject;
    if(force||!clean(factInput&&factInput.value)){st.fact=p.fact;if(factInput)factInput.value=p.fact}
    if(sceneInput){sceneInput.value=p.scene;st.scene=p.scene}
    if(detailsInput){detailsInput.value='dark hook, tension, real object, no random filler';st.details=detailsInput.value}
    st.captionStyle='scary_chilling_hook';
    save(st);
    if(window.toast)try{toast('Stronger fun fact added.')}catch(e){}
  }
  function bind(){
    const btn=document.querySelector('#autoFill');
    if(btn){btn.textContent='Auto fill scary hook fact';btn.onclick=function(e){e.preventDefault();apply(true)}}
    const subject=document.querySelector('#subject');
    const fact=document.querySelector('#fact');
    if(subject&&!subject.dataset.betterFacts){
      subject.dataset.betterFacts='1';
      subject.addEventListener('change',function(){apply(false)})
    }
    if(fact&&!fact.dataset.betterFacts){
      fact.dataset.betterFacts='1';
      const st=load();
      if(st.fact&&!clean(fact.value))fact.value=st.fact;
      fact.addEventListener('input',function(){const st=load();st.fact=clean(fact.value);save(st)})
    }
  }
  window.FactPulseBetterFacts={apply,pickProfile};
  window.addEventListener('DOMContentLoaded',bind);
  setTimeout(bind,500);
})();