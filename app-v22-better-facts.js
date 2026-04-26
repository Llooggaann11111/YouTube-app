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
  function profile(subject,force){
    const s=lower(subject);
    const name=clean(subject)||'this topic';
    const list=[
      {re:/lady gaga/,scene:'lady gaga red carpet award show fashion performance cameras crowd interview',hooks:[
        'Lady Gaga did not become unforgettable by only singing. She turned outfits, interviews, and award shows into moments people argued about for years.',
        'One Lady Gaga entrance can feel like a music video, a protest, and a headline at the same time. That is why cameras never look away.',
        'Lady Gaga knows the secret of viral fame. Give people something they understand later, but cannot stop staring at now.',
        'The interesting part about Lady Gaga is how controlled the chaos is. Even the strangest moments usually have a message hiding inside them.',
        'Lady Gaga proved fame is not only about being liked. Sometimes the moment people cannot explain becomes the moment they remember forever.'
      ]},
      {re:/judge judy/,scene:'judge judy courtroom judge verdict evidence audience legal tense',hooks:[
        'Judge Judy clips are addictive because the twist is usually small. A date, a receipt, or one answer makes the whole story fall apart.',
        'The best Judge Judy moments feel like a trap. Someone starts confident, then one question makes the room go silent.',
        'Judge Judy became famous for cutting through messy stories fast. The interesting part is how often the truth shows up in one tiny detail.',
        'A courtroom looks formal, but Judge Judy made it feel like a lie detector with an audience.',
        'The chilling part is not the yelling. It is the second someone realizes their story no longer works.'
      ]},
      {re:/titanic|ship|sinking|ocean liner|iceberg/,scene:'titanic ship ocean liner iceberg freezing water dark night lifeboats disaster',hooks:[
        'The Titanic was a floating symbol of confidence. That is what makes the story so gripping. It was not supposed to fail, then the ocean proved otherwise.',
        'The Titanic disaster started with something almost too quiet to fear. A scrape in the dark became one of history’s most unforgettable nights.',
        'The most haunting Titanic detail is how normal everything looked before it turned. Lights, music, calm water, then time started running out.',
        'Titanic is interesting because it was not just a shipwreck. It was a test of class, pride, engineering, panic, and survival.',
        'The ship was called unsinkable by many people around it. That confidence is what makes the ending feel even colder.'
      ]},
      {re:/court|judge|trial|lawyer|lawsuit|crime|prison|jail|verdict|jury/,scene:'courtroom judge jury lawyer verdict tense hearing evidence',hooks:[
        'Court cases are interesting because the ending can turn on one small thing. A phone record, a receipt, or a witness can rewrite the whole story.',
        'A courtroom looks calm, but every sentence has weight. One answer can decide money, freedom, reputation, or years of someone’s life.',
        'The most gripping trials are not loud the whole time. They build slowly, then one piece of evidence changes the room.',
        'A jury does not need a movie scene to change a life. Sometimes it only needs one detail that finally makes sense.',
        'The scary part of court is how permanent the final words sound. Guilty. Not guilty. Case dismissed. Everything changes after that.'
      ]},
      {re:/killer|murder|serial|crime scene|missing person|detective/,scene:'crime scene police tape detective dark street evidence',hooks:[
        'True crime pulls people in because the answer is usually hidden in something ordinary. A route, a message, or a missed camera angle.',
        'The creepiest crime stories are not always the bloodiest. They are the ones where the truth sat in plain sight and nobody saw it.',
        'A crime scene is like a puzzle where every object could matter. The disturbing part is realizing which detail everyone ignored.',
        'The most interesting clue is often the boring one. That is why detectives care about timelines, receipts, and tiny contradictions.',
        'True crime feels chilling because it proves a normal day can become evidence.'
      ]},
      {re:/celebrity|actor|actress|singer|rapper|artist|famous|red carpet|award show/,scene:'celebrity red carpet flashing cameras stage crowd interview award show',hooks:[
        'Celebrity moments go viral when they feel bigger than the event. One look, one answer, or one mistake can take over the whole internet.',
        'The interesting thing about fame is how fast a person becomes a symbol. The crowd sees a star, but the camera catches a human moment.',
        'A red carpet is not only fashion. It is a live test where every pose, pause, and reaction becomes content.',
        'Fame looks glamorous, but it also means millions of strangers remember moments the person might want to forget.',
        'The best celebrity clips work because they feel unscripted. For a few seconds, the mask slips and everyone notices.'
      ]},
      {re:/concert|stage|music|performance|tour|microphone/,scene:'concert stage lights screaming crowd microphone performance',hooks:[
        'A concert looks effortless, but it is controlled chaos. Lights, sound, timing, security, and thousands of people all have to move together.',
        'The most interesting live performances are the ones where something almost goes wrong, then the artist turns it into the moment everyone remembers.',
        'A stage is built to look magical. Behind it, every second is planned so the crowd feels like it is happening naturally.',
        'Live music is risky because nothing can be edited. One cracked note, one fall, or one surprise becomes part of the legend.',
        'The crowd is the hidden character in every concert. Their reaction can turn a normal performance into history.'
      ]},
      {re:/volcano|eruption|lava|ash/,scene:'volcano lava eruption ash smoke mountain disaster',hooks:[
        'Volcanoes are fascinating because they look like mountains until the planet reminds everyone they are alive.',
        'Lava gets attention, but ash can travel farther and cause more chaos. That is the part many people forget.',
        'A volcano can stay quiet for years, then change the land in hours. That mix of beauty and danger is why eruption footage feels unreal.',
        'The chilling part is the pressure building under a calm surface. The mountain looks still while the ground is preparing to open.',
        'Volcanoes do not only destroy. They also create new land, which makes them one of nature’s strangest forces.'
      ]},
      {re:/earthquake|hurricane|tornado|tsunami|flood|storm|disaster/,scene:'storm flood tornado earthquake disaster damage emergency',hooks:[
        'Disaster footage is gripping because everything familiar changes fast. A street, a house, or a beach becomes dangerous in minutes.',
        'The scary part of a storm is not only its size. It is how quickly people realize their normal plan no longer matters.',
        'A tsunami is not just a big wave. It is moving ocean power, and by the time it looks obvious, it may already be too late.',
        'Tornadoes look unreal because the sky reaches down and starts choosing what stays and what disappears.',
        'Natural disasters are interesting because they expose how fragile normal life is. The same place can look safe in the morning and unrecognizable by night.'
      ]},
      {re:/space|rocket|astronaut|planet|moon|mars|nasa|black hole/,scene:'space rocket astronaut planet dark universe stars',hooks:[
        'Space is fascinating because it is beautiful and hostile at the same time. No air, no sound, no quick rescue.',
        'A rocket launch looks clean from far away, but it is controlled explosion pointed at the sky.',
        'The moon looks calm, but every footprint there exists in a place where one broken suit would become an emergency.',
        'Black holes are interesting because they turn gravity into something almost impossible to picture. Even light does not get to leave.',
        'Astronauts train to stay calm because panic wastes oxygen. That one detail says everything about space.'
      ]},
      {re:/ocean|shark|whale|deep sea|submarine|sea/,scene:'dark ocean deep sea waves submarine shark water',hooks:[
        'The ocean is interesting because most of it is still mystery. We have maps of planets, but the deep sea still hides things on Earth.',
        'Deep water is not just dark. It is heavy. The pressure alone can turn one weak spot into disaster.',
        'The surface looks peaceful, but below it are currents, predators, wrecks, and places sunlight never reaches.',
        'A submarine clip is tense because the danger is invisible. The water outside does not need to move fast to be deadly.',
        'The ocean makes humans feel small in a way few places can. That is why even calm water can feel unsettling.'
      ]},
      {re:/animal|lion|tiger|bear|wolf|snake|crocodile|alligator|shark/,scene:'wild animal predator close up nature danger',hooks:[
        'Predators are interesting because they waste almost nothing. Every pause, stare, and step has a purpose.',
        'The wild does not work like a movie. The dangerous moments often happen quietly, before anyone realizes the chase started.',
        'A crocodile can look like a log until the water explodes. That is what makes patience one of nature’s scariest weapons.',
        'Animals survive with tools humans cannot see right away. Speed, camouflage, smell, silence, and timing all matter.',
        'The most chilling predator clips are the ones where nothing happens at first. That is usually when the animal is deciding.'
      ]},
      {re:/war|soldier|army|military|battle|weapon|tank/,scene:'soldiers battlefield military smoke historic war footage',hooks:[
        'War footage is interesting because it turns history into real movement. Every frame was once someone’s present moment.',
        'A battlefield is not only explosions. It is confusion, fear, waiting, and decisions made with almost no time.',
        'The chilling part of war is how normal places become historic for the worst reasons.',
        'Military clips can look distant, but every vehicle, road, and building had people attached to it.',
        'War changes maps, but it also changes families. That is why silent footage can feel heavier than loud footage.'
      ]},
      {re:/money|bank|billionaire|stock|business|scam|fraud|rich/,scene:'money cash bank business office dark finance',hooks:[
        'Money stories get interesting when the numbers stop being abstract. A quiet decision in one room can affect thousands of people outside it.',
        'A scam usually does not look suspicious at first. It looks like trust, confidence, paperwork, and a promise that feels safe.',
        'The richest stories are often about timing. Being early, being lucky, or seeing something everyone else ignored.',
        'Business can look boring until one deal changes a company, a city, or a whole industry.',
        'The dark side of money is how clean it can look while the damage happens somewhere else.'
      ]},
      {re:/school|student|teacher|college|exam|classroom/,scene:'school hallway classroom students desks quiet tension',hooks:[
        'School stories hit because everyone understands the pressure. One test, one rumor, or one mistake can feel huge when you are inside it.',
        'A classroom looks simple, but it can hold stress, competition, fear, friendships, and secrets all at once.',
        'The interesting part of school is how small moments feel permanent. A hallway conversation can stay in someone’s memory for years.',
        'Pressure in school is quiet. That is why people miss it until it shows up in a bigger way.',
        'Every school has two versions. The one adults see, and the one students actually live in.'
      ]},
      {re:/doctor|hospital|medical|disease|virus|surgery|patient/,scene:'hospital doctor emergency room medical monitors patient',hooks:[
        'Hospitals are interesting because every calm hallway is connected to someone’s emergency.',
        'One medical result can split a life into before and after. That is why a single number on a screen can feel terrifying.',
        'Doctors make fast choices with real consequences. The pressure is hidden behind calm voices and clean rooms.',
        'The machines in hospitals do not look emotional, but every beep means someone is being watched by time.',
        'Medicine is full of moments where science, luck, and timing meet in the same room.'
      ]},
      {re:/ai|robot|technology|computer|phone|internet|app|youtube/,scene:'computer screen phone technology dark server data code',hooks:[
        'Technology is interesting because it feels invisible when it works. Behind one tap are servers, code, signals, and decisions happening fast.',
        'Your phone learns patterns from tiny choices. Searches, pauses, clicks, and scrolls all turn into a picture of what keeps you watching.',
        'The internet makes things feel instant, but that speed is also what makes mistakes, leaks, and lies hard to stop.',
        'AI feels new because it does not only store information. It starts predicting what people might want next.',
        'The creepy part of apps is how normal tracking feels. The system learns while the user thinks they are just scrolling.'
      ]},
      {re:/building|skyscraper|tower|bridge|burj|construction/,scene:'skyscraper tower glass building height workers city',hooks:[
        'Skyscrapers are interesting because they make danger look clean. Glass, steel, wind, and height all get hidden behind a shiny skyline.',
        'Every tall building has two stories. The view from the ground, and the workers who trusted ropes, cranes, and balance above the city.',
        'A bridge looks simple until you think about the weight, weather, movement, and pressure it survives every day.',
        'The higher a building gets, the more every small job becomes serious. Cleaning one window can turn into a test of nerves.',
        'Cities look permanent, but every landmark started as a risky idea someone had to build in the air.'
      ]}
    ];
    const picked=list.find(p=>p.re.test(s));
    if(picked)return {scene:picked.scene,fact:pickOne(subject,picked.hooks,force)};
    const fallback=[
      name+' gets interesting when you stop looking at the obvious part and follow the detail most people miss.',
      'The story behind '+name+' has a turn most people do not expect. At first it looks simple, then the details change the whole thing.',
      name+' looks ordinary from far away, but the closer you look, the stranger the story gets.',
      'The part people remember about '+name+' is not always the biggest moment. Sometimes it is the detail that makes everything click.',
      'What makes '+name+' worth watching is the hidden tension. Something small is usually doing more work than people realize.'
    ];
    return {scene:name+' close up dramatic footage real event interesting tension b roll',fact:pickOne(subject,fallback,force)};
  }
  function apply(force){
    const subjectInput=document.querySelector('#subject');
    const factInput=document.querySelector('#fact');
    const sceneInput=document.querySelector('#scene');
    const detailsInput=document.querySelector('#details');
    const subject=clean(subjectInput&&subjectInput.value);
    if(!subject)return;
    const p=profile(subject,force);
    const st=load();
    st.subject=subject;
    if(force||!clean(factInput&&factInput.value)){st.fact=p.fact;if(factInput)factInput.value=p.fact}
    if(sceneInput){sceneInput.value=p.scene;st.scene=p.scene}
    if(detailsInput){detailsInput.value='viral hook, interesting twist, tension, real object, no random filler';st.details=detailsInput.value}
    st.captionStyle='viral_interesting_chilling_hook';
    save(st);
    if(window.toast)try{toast(force?'New interesting hook generated.':'Hook saved.')}catch(e){}
  }
  function bind(){
    const btn=document.querySelector('#autoFill');
    if(btn){btn.textContent='Generate viral fact hook';btn.onclick=function(e){e.preventDefault();apply(true)}}
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
  window.FactPulseBetterFacts={apply,pickProfile:profile};
  window.addEventListener('DOMContentLoaded',bind);
  setTimeout(bind,500);
})();