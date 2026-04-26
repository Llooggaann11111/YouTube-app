(function(){
  const reasons={};
  function reasonFor(name){
    if(name==='YouTube' && !(window.s&&s.youtubeKey)) return 'missing YouTube API key';
    if(name==='Pixabay' && !(window.s&&s.pixabayKey)) return 'missing Pixabay API key';
    if(name==='Pexels' && !(window.s&&s.pexelsKey)) return 'missing Pexels API key';
    if(name==='Coverr' && !(window.s&&s.coverrKey)) return 'missing Coverr API key';
    return '';
  }
  function addReason(name,msg){reasons[name]=msg||reasons[name]||'';}
  function readableError(err){
    const m=String(err&&err.message||err||'');
    if(/abort|timeout/i.test(m))return 'timed out';
    if(/Failed to fetch|NetworkError|Load failed/i.test(m))return 'blocked by browser CORS or network';
    if(/HTTP 403|proxy 403|direct 403/i.test(m))return 'blocked, forbidden, or quota issue';
    if(/HTTP 404|proxy 404|direct 404/i.test(m))return 'endpoint not found for this query';
    if(/HTTP 429|proxy 429|direct 429/i.test(m))return 'rate limited';
    if(/HTTP 400|proxy 400|direct 400/i.test(m))return 'bad request or API key problem';
    return m||'unknown error';
  }
  const originalSetSource=window.setSource;
  window.setSource=function(name,type,count){
    if(type==='skip' && !reasons[name]){
      const r=reasonFor(name);
      if(r)reasons[name]=r;
      else if(count===0)reasons[name]='searched but found no matching usable videos';
    }
    if(type==='bad' && !reasons[name])reasons[name]='failed or blocked';
    return originalSetSource(name,type,count);
  };
  window.run=async function(name,fn,q,deep,token){
    if(token!==window.searchToken)return [];
    const pre=reasonFor(name);
    if(pre){
      reasons[name]=pre;
      window.setSource(name,'skip',0);
      return [];
    }
    try{
      const list=await fn(q,deep);
      if(token!==window.searchToken)return [];
      if(!list.length)addReason(name,'searched, but no title/description matched your subject or no playable mp4/embed was returned');
      window.setSource(name,list.length?'ok':'skip',list.length);
      return list;
    }catch(e){
      if(token!==window.searchToken)return [];
      addReason(name,readableError(e));
      window.setSource(name,'bad',0);
      return [];
    }
  };
  const originalLogLines=window.logLines;
  window.logLines=function(){
    const lines=['Search status:'];
    window.sourceNames.forEach(n=>{
      const st=(window.totals&&totals[n])||{status:'skip',count:0,queries:0};
      const label=st.status==='bad'?'failed':st.status==='ok'?'searched':'skipped';
      const why=reasons[n]?(' · '+reasons[n]):'';
      lines.push(n+': '+label+', '+st.count+' clips, '+st.queries+' checks'+why);
    });
    const log=document.querySelector('#log');
    if(log)log.textContent=lines.join('\n');
  };
  function injectHelp(){
    const box=document.querySelector('#log');
    if(!box||document.querySelector('#failureHelp'))return;
    const help=document.createElement('div');
    help.id='failureHelp';
    help.className='box';
    help.textContent='Failure guide:\nYouTube 0 usually means no YouTube API key, quota problem, or no embeddable matches.\nNational Archives and DVIDS often block browser requests. They need a small backend/proxy for reliable searching.\nPixabay, Pexels, and Coverr only run when you add keys or turn on stock background.\nInternet Archive and Wikimedia are the most reliable no-key sources in browser-only mode.';
    box.parentElement.insertBefore(help,box.nextSibling);
  }
  window.addEventListener('DOMContentLoaded',injectHelp);
  setTimeout(injectHelp,400);
})();