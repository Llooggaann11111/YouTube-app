function ffClean(v){return String(v||'').trim().replace(/\s+/g,' ')}
function ffFact(subject){
  const s=ffClean(subject).toLowerCase();
  const name=ffClean(subject)||'this topic';
  if(s.includes('titanic'))return 'The Titanic was once called unsinkable, but one iceberg turned its first voyage into one of history’s most famous disasters.';
  if(s.includes('burj khalifa'))return 'The Burj Khalifa is so tall that cleaning all of its windows takes months, and the crews start again when they finish.';
  if(s.includes('volcano'))return 'A volcano does not just explode upward. It can release lava, ash, gas, and heat that change the land around it.';
  if(s.includes('court')||s.includes('trial'))return 'Court cases often come down to small details, because one piece of evidence can change the whole story.';
  if(s.includes('space')||s.includes('rocket')||s.includes('planet'))return 'Space is so large that even light, the fastest thing we know, takes time to travel between planets.';
  if(s.includes('singer')||s.includes('concert')||s.includes('music')||s.includes('bieber'))return 'A live performance looks simple from the crowd, but it takes lights, timing, sound, and practice to make it feel effortless.';
  if(s.includes('money')||s.includes('bank')||s.includes('business'))return 'Small money habits look harmless at first, but repeated every day they can change a person’s future.';
  if(s.includes('animal')||s.includes('wildlife'))return 'Animals survive by using traits that match their environment, from speed and strength to camouflage and teamwork.';
  if(s.includes('technology')||s.includes('phone')||s.includes('computer')||s.includes('ai'))return 'Most technology feels instant, but behind every tap are servers, code, chips, and signals working at the same time.';
  return 'The story behind '+name+' is more interesting when you see the object, the setting, and the details together.';
}
function ffLoad(){try{return JSON.parse(localStorage.getItem('factpulse-v16')||'{}')}catch(e){return app||{}}}
function ffSave(state){localStorage.setItem('factpulse-v16',JSON.stringify(state));}
function ffApply(force){
  const subjectInput=document.querySelector('#subject');
  const factInput=document.querySelector('#fact');
  const subject=ffClean(subjectInput&&subjectInput.value?subjectInput.value:(app&&app.subject));
  if(!subject)return;
  const state=ffLoad();
  state.subject=subject;
  const current=ffClean(factInput&&factInput.value?factInput.value:state.fact);
  if(force||!current){state.fact=ffFact(subject);if(factInput)factInput.value=state.fact;}
  if(typeof app==='object'){app.fact=state.fact;app.subject=state.subject;}
  ffSave(state);
}
function ffBind(){
  const factInput=document.querySelector('#fact');
  const autoFill=document.querySelector('#autoFillClips');
  const autoSearch=document.querySelector('#autoSearchClips');
  const subject=document.querySelector('#subject');
  if(factInput&&!factInput.dataset.ff){
    factInput.dataset.ff='1';
    const state=ffLoad();
    if(state.fact)factInput.value=state.fact;
    factInput.addEventListener('input',()=>{const st=ffLoad();st.fact=ffClean(factInput.value);if(typeof app==='object')app.fact=st.fact;ffSave(st);});
  }
  if(subject&&!subject.dataset.ff){subject.dataset.ff='1';subject.addEventListener('change',()=>ffApply(false));}
  if(autoFill&&!autoFill.dataset.ff){autoFill.dataset.ff='1';autoFill.addEventListener('click',()=>ffApply(false));}
  if(autoSearch&&!autoSearch.dataset.ff){autoSearch.dataset.ff='1';autoSearch.addEventListener('click',()=>ffApply(false));}
}
window.addEventListener('DOMContentLoaded',ffBind);
setTimeout(ffBind,400);
