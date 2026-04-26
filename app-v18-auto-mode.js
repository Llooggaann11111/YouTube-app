function autoModeClean(value){return String(value||'').trim().replace(/\s+/g,' ')}
function autoModeLower(value){return autoModeClean(value).toLowerCase()}
function autoModeScene(subject,fact){
  const text=autoModeLower(subject+' '+(fact||''));
  const rules=[
    [/titanic|ship|boat|ocean liner|iceberg|sinking/, 'ship ocean iceberg historical water waves'],
    [/bieber|singer|music|concert|artist|rapper|song|album|stage|performance/, 'singer microphone stage concert crowd performance lights'],
    [/court|trial|lawsuit|judge|legal|crime|criminal|lawyer|prison/, 'courtroom judge lawyer courthouse hearing legal documents'],
    [/speech|civil rights|president|leader|politician|protest|march/, 'speech podium microphone crowd audience protest march'],
    [/volcano|eruption|lava/, 'volcano lava eruption smoke mountain'],
    [/earthquake|storm|hurricane|tornado|weather/, 'storm clouds rain lightning weather disaster'],
    [/space|rocket|planet|astronaut|moon|mars|nasa/, 'space rocket planet astronaut launch galaxy'],
    [/money|business|finance|bank|stock|rich|billionaire/, 'money cash bank finance coins business office'],
    [/school|student|study|college|teacher|classroom/, 'students classroom books studying school hallway'],
    [/fitness|sports|athlete|basketball|football|soccer|training/, 'athlete training gym sports stadium movement'],
    [/technology|phone|computer|ai|robot|software|internet/, 'computer phone technology screen circuit robot'],
    [/animal|wildlife|lion|tiger|shark|whale|dog|cat/, 'wild animals wildlife nature close up habitat'],
    [/food|restaurant|cooking|chef|kitchen/, 'food cooking kitchen chef restaurant close up'],
    [/car|vehicle|plane|train|travel/, 'cars road traffic vehicle travel motion'],
    [/war|military|soldier|battle|army/, 'military soldiers battlefield memorial historic footage'],
    [/hospital|doctor|health|medical|disease/, 'hospital doctor patient medical health emergency'],
    [/building|skyscraper|architecture|tower|city/, 'skyscraper city building architecture glass workers']
  ];
  for(const [regex,scene] of rules){if(regex.test(text))return scene;}
  return autoModeClean(subject).split(/\s+/).filter(Boolean).slice(0,5).join(' ')+' b roll footage';
}
function autoModeSearchMode(subject){
  const text=autoModeLower(subject);
  if(/titanic|war|ancient|history|public domain|speech|court|trial|volcano|space|animal|weather|technology|school|money|sports|food|building/.test(text))return 'related';
  if(/bieber|celebrity|singer|rapper|artist|actor|movie|show|song|album|nba|nfl|player/.test(text))return 'related';
  return 'related';
}
function autoModeFill(searchNow=false,many=false){
  let subject=autoModeClean(document.querySelector('#subject')?.value||app.subject||'');
  if(!subject){toast('Type a subject first.');return;}
  const fact=app.fact||'';
  const sceneText=autoModeScene(subject,fact);
  app.subject=subject;
  app.scene=sceneText;
  app.mode=autoModeSearchMode(subject);
  const subjectInput=document.querySelector('#subject');
  const sceneInput=document.querySelector('#scene');
  const modeInput=document.querySelector('#mode');
  if(subjectInput)subjectInput.value=subject;
  if(sceneInput)sceneInput.value=sceneText;
  if(modeInput)modeInput.value=app.mode;
  if(typeof save==='function')save();
  if(typeof plan==='function')plan();
  toast('Auto filled scene and search mode.');
  if(searchNow&&typeof search==='function')search(many);
}
function autoModeBind(){
  const autoFill=document.querySelector('#autoFillClips');
  const autoSearch=document.querySelector('#autoSearchClips');
  const subject=document.querySelector('#subject');
  if(autoFill)autoFill.onclick=()=>autoModeFill(false,false);
  if(autoSearch)autoSearch.onclick=()=>autoModeFill(true,false);
  if(subject&&!subject.dataset.autoModeBound){
    subject.dataset.autoModeBound='1';
    subject.addEventListener('change',()=>autoModeFill(false,false));
  }
  const sceneInput=document.querySelector('#scene');
  if(sceneInput&&sceneInput.placeholder)sceneInput.placeholder='Auto fills from subject, example: ship ocean iceberg historical';
}
window.addEventListener('DOMContentLoaded',autoModeBind);
setTimeout(autoModeBind,300);
