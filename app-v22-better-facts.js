(function(){
  const STORE='factpulse-v16';
  function clean(v){return String(v||'').trim().replace(/\s+/g,' ')}
  function lower(v){return clean(v).toLowerCase()}
  function load(){try{return JSON.parse(localStorage.getItem(STORE)||'{}')}catch(e){return{}}}
  function save(st){localStorage.setItem(STORE,JSON.stringify(st))}
  function nextIndex(subject,max){
    const st=load();
    const key='hookIndex_'+lower(subject).replace(/[^a-z0-9]+/g,'_');
    const n=((Number(st[key]||0)+1)%Math.max(1,max));
    st[key]=n;
    save(st);
    return n;
  }
  function pickOne(subject,hooks,force){
    if(!hooks.length)return '';
    if(force)return hooks[nextIndex(subject,hooks.length)];
    const st=load();
    const key='hookIndex_'+lower(subject).replace(/[^a-z0-9]+/g,'_');
    return hooks[Number(st[key]||0)%hooks.length];
  }
  function pickProfile(subject,force){
    const s=lower(subject);
    const name=clean(subject)||'this topic';
    const profiles=[
      {re:/lady gaga/,scene:'lady gaga red carpet award show shocking fashion cameras performance crowd',hooks:[
        'Lady Gaga once turned an award show into a horror movie by wearing raw meat on the red carpet. The outfit was fashion, protest, and shock value all at once.',
        'The wildest Lady Gaga moments work because they feel unsafe at first. The room expects a pop star, then she walks in like a headline nobody prepared for.',
        'Lady Gaga built fame by making people stare before they even understood the message. That is why one outfit, one stage move, or one silence turns into a viral moment.'
      ]},
      {re:/judge judy/,scene:'judge judy courtroom judge verdict evidence audience tense legal scene',hooks:[
        'Judge Judy became famous for the moment a story stops making sense. The scary part is how fast one tiny detail makes someone look guilty in front of millions.',
        'In Judge Judy’s courtroom, the loudest moment is not yelling. It is the pause right before she catches the lie.',
        'Judge Judy clips go viral because they feel like a trap closing. Someone walks in with a story, then one question makes the whole thing collapse.'
      ]},
      {re:/titanic|ship|sinking|ocean liner|iceberg/,scene:'titanic ship ocean liner iceberg freezing water dark night lifeboats disaster',hooks:[
        'The Titanic horror was not one giant crash. It started as a quiet scrape in the dark, then turned into freezing water, locked panic, and lifeboats that were not enough.',
        'The scariest Titanic detail is how normal the night looked at first. Music, lights, calm water, then the ocean started taking the ship piece by piece.',
        'Titanic passengers did not all panic right away. That is what makes it chilling. Some people were still standing on a floating hotel while time was already running out.'
      ]},
      {re:/court|judge|trial|lawyer|lawsuit|crime|prison|jail|verdict|jury/,scene:'courtroom judge jury lawyer verdict tense hearing evidence',hooks:[
        'A courtroom looks calm until the verdict drops. One sentence decides who goes home and who loses years of their life.',
        'The scariest thing in court is not the judge’s voice. It is the tiny piece of evidence that changes everything after everyone thought the story was finished.',
        'Trials feel slow, then one answer flips the room. A witness, a receipt, a camera angle, one detail becomes the whole case.'
      ]},
      {re:/killer|murder|serial|crime scene|missing person|detective/,scene:'crime scene police tape detective dark street evidence',hooks:[
        'The creepiest crime stories are not solved by huge clues. They break open because of one weird detail nobody noticed at first.',
        'A crime scene can look silent, but every object is talking. The terrifying part is finding the one clue that points to someone nobody suspected.',
        'The scary part is not just what happened. It is how long the truth can sit in plain sight before anyone sees it.'
      ]},
      {re:/celebrity|actor|actress|singer|rapper|artist|famous|red carpet|award show/,scene:'celebrity red carpet flashing cameras stage crowd interview award show',hooks:[
        'Fame looks glamorous until one moment follows a person forever. One clip, one outfit, one sentence, and millions decide what the story means.',
        'The red carpet is not just cameras and lights. It is a pressure chamber where every blink, step, and reaction gets saved forever.',
        'The creepy part of fame is that strangers remember moments the celebrity might want to forget. The internet does not blink.'
      ]},
      {re:/concert|stage|music|performance|tour|microphone/,scene:'concert stage lights screaming crowd microphone performance',hooks:[
        'A concert looks controlled from the crowd, but one failed cue turns lights, sound, heat, and thousands of people into chaos.',
        'The stage is built to look perfect. Behind it, one mistake in timing, audio, or crowd movement can ruin the whole night in seconds.',
        'The scariest part of a live show is the crowd. Thousands of people move as one, and nobody controls what happens if the energy turns.'
      ]},
      {re:/volcano|eruption|lava|ash/,scene:'volcano lava eruption ash smoke mountain disaster',hooks:[
        'A volcano can sit quiet for years, then erase the word safe in minutes. The lava is terrifying, but the ash and gas reach people first.',
        'The chilling part of a volcano is the silence before it breaks open. The mountain looks still, while pressure builds underneath everything.',
        'Volcanoes do not need to chase anyone. The ash, heat, gas, and mud move fast enough to turn a normal day into an escape story.'
      ]},
      {re:/earthquake|hurricane|tornado|tsunami|flood|storm|disaster/,scene:'storm flood tornado earthquake disaster damage emergency',hooks:[
        'Natural disasters are terrifying because normal life changes before your brain catches up. A street, a house, a school, gone in minutes.',
        'The scariest disasters do not look real at first. The sky changes, the ground moves, the water rises, and suddenly every second matters.',
        'The warning is often shorter than the damage. That is what makes disaster footage so hard to look away from.'
      ]},
      {re:/space|rocket|astronaut|planet|moon|mars|nasa|black hole/,scene:'space rocket astronaut planet dark universe stars',hooks:[
        'Space looks peaceful because there is no sound. That is the terrifying part. No air, no rescue, no quick fix, and every mistake happens in silence.',
        'The universe is not empty in a comforting way. It is empty in a way that makes one broken part, one leak, or one wrong angle deadly.',
        'Astronauts train for calm because panic wastes oxygen. That alone tells you how serious space really is.'
      ]},
      {re:/ocean|shark|whale|deep sea|submarine|sea/,scene:'dark ocean deep sea waves submarine shark water',hooks:[
        'The ocean gets scarier the deeper you go. Sunlight disappears, pressure crushes metal, and most of the world below is still unknown.',
        'The deep sea is a place where humans do not belong. The pressure alone is strong enough to turn one weak spot into disaster.',
        'At the surface, the ocean looks beautiful. Underneath, it is dark, freezing, heavy, and full of things built to survive where we cannot.'
      ]},
      {re:/animal|lion|tiger|bear|wolf|snake|crocodile|alligator|shark/,scene:'wild animal predator close up nature danger',hooks:[
        'Predators are scariest when they are quiet. By the time the target realizes it is being watched, the dangerous part already started.',
        'The wild does not give warnings. One step too close, one wrong turn, one second of panic, and the animal has the advantage.',
        'Nature looks calm in clips, but predators do not waste movement. The attack often starts before the viewer even notices the danger.'
      ]},
      {re:/war|soldier|army|military|battle|weapon|tank/,scene:'soldiers battlefield military smoke historic war footage',hooks:[
        'War footage feels old until you remember every frame had real people inside it. One order, one mistake, one explosion, and families changed forever.',
        'The chilling part of war is how fast ordinary people become names in history books. A road, a field, a building, suddenly becomes a battlefield.',
        'War turns small decisions into permanent consequences. That is why even silent footage feels heavy.'
      ]},
      {re:/money|bank|billionaire|stock|business|scam|fraud|rich/,scene:'money cash bank business office dark finance',hooks:[
        'Money gets scary when the numbers stop being numbers. One hidden decision can cost people homes, jobs, and futures before they even know it happened.',
        'A scam does not look like a monster. It looks like trust, paperwork, promises, and a number that feels too good to question.',
        'The darkest money stories start clean. A signature, a deal, a quiet transfer, then thousands of people pay for it later.'
      ]},
      {re:/school|student|teacher|college|exam|classroom/,scene:'school hallway classroom students desks quiet tension',hooks:[
        'A school can look normal while someone is quietly falling apart. That is what makes hallways, rumors, grades, and pressure heavier than they look.',
        'The scariest school stories rarely start loud. They start with stress, silence, and people missing the warning signs.',
        'A classroom looks safe, but pressure builds in private. One bad day can turn into the memory someone never forgets.'
      ]},
      {re:/doctor|hospital|medical|disease|virus|surgery|patient/,scene:'hospital doctor emergency room medical monitors patient',hooks:[
        'Hospitals feel safe until you hear the machines. Every beep means someone is being measured against time.',
        'The scariest part of medicine is how fast normal can change. One scan, one number, one result, and life splits into before and after.',
        'Behind every calm hospital hallway, someone is having the worst day of their life. That is why the silence feels so heavy.'
      ]},
      {re:/ai|robot|technology|computer|phone|internet|app|youtube/,scene:'computer screen phone technology dark server data code',hooks:[
        'Technology gets creepy when it knows your habits better than people do. Every tap teaches the machine what keeps you watching.',
        'The scary part of the internet is speed. A lie, a leak, or a mistake spreads before anyone has time to pull it back.',
        'Your phone feels personal, but it is also a window. Every search, pause, click, and scroll leaves a pattern behind.'
      ]},
      {re:/building|skyscraper|tower|bridge|burj|construction/,scene:'skyscraper tower glass building height workers city',hooks:[
        'Skyscrapers look clean from the ground. Up close, they are wind, glass, cables, and workers hanging where one mistake has no second chance.',
        'The scariest part of a tall building is how normal it looks from below. Hundreds of feet up, even a small job becomes a survival test.',
        'Every shiny tower hides a dangerous truth. Someone had to build it, clean it, and trust a rope above the city.'
      ]}
    ];
    const picked=profiles.find(p=>p.re.test(s));
    if(picked)return {scene:picked.scene,fact:pickOne(subject,picked.hooks,force)};
    const fallback=[
      'The disturbing part about '+name+' is not the obvious story. It is the small detail that makes everything feel different once you notice it.',
      name+' looks simple until you follow the details. Then the story gets stranger, darker, and harder to ignore.',
      'The part people miss about '+name+' is the moment everything turns. Before that, it looks normal. After that, it feels impossible to unsee.'
    ];
    return {scene:name+' close up dramatic footage real event tension b roll',fact:pickOne(subject,fallback,force)};
  }
  function apply(force){
    const subjectInput=document.querySelector('#subject');
    const factInput=document.querySelector('#fact');
    const sceneInput=document.querySelector('#scene');
    const detailsInput=document.querySelector('#details');
    const subject=clean(subjectInput&&subjectInput.value);
    if(!subject)return;
    const p=pickProfile(subject,force);
    const st=load();
    st.subject=subject;
    if(force||!clean(factInput&&factInput.value)){st.fact=p.fact;if(factInput)factInput.value=p.fact}
    if(sceneInput){sceneInput.value=p.scene;st.scene=p.scene}
    if(detailsInput){detailsInput.value='viral hook, chilling tension, real object, no random filler';st.details=detailsInput.value}
    st.captionStyle='viral_chilling_hook';
    save(st);
    if(window.toast)try{toast(force?'New hook generated.':'Hook saved.')}catch(e){}
  }
  function bind(){
    const btn=document.querySelector('#autoFill');
    if(btn){btn.textContent='Generate better scary hook';btn.onclick=function(e){e.preventDefault();apply(true)}}
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