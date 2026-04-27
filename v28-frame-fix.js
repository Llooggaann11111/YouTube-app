(function(){
  function $(x){return document.querySelector(x)}
  function safeDoc(id){try{return $('#'+id).contentDocument}catch(e){return null}}
  function replaceText(root,from,to){
    if(!root)return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(n=>{if(n.nodeValue&&n.nodeValue.includes(from))n.nodeValue=n.nodeValue.split(from).join(to)});
  }
  function cleanFrame(doc,type){
    if(!doc||!doc.body)return;
    const pairs=[
      ['FactPulse Clips v25','FactPulse Clips v28'],['FactPulse Clips v22','FactPulse Clips v28'],['FactPulse Clips v18','FactPulse Clips v28'],
      ['Clips v25','Clips v28'],['Clips v22','Clips v28'],['Clips v18','Clips v28'],
      ['Render v25','Render v28'],['Render v18','Render v28'],['Render styled video','Render v28'],
      ['Go to Render v25','Go to Render v28'],['Go to Render v18','Go to Render v28'],
      ['Stable billions search','Locked v28 search'],['STABLE BILLIONS SEARCH','LOCKED V28 SEARCH'],
      ['REAL TIMELINE RENDER','LOCKED V28 RENDER'],['quota + render reference','locked v28 clips'],['captions render','locked v28 render']
    ];
    pairs.forEach(p=>replaceText(doc.body,p[0],p[1]));
    doc.querySelectorAll('a[href]').forEach(a=>{
      const t=(a.textContent||'').trim();
      if(t==='Studio'){a.textContent='V28 Hub';a.setAttribute('href','app-v28.html')}
      let h=a.getAttribute('href')||'';
      h=h.replace('clips-v25.html','clips-v28.html').replace('clips-v22.html','clips-v28.html').replace('clips-v18.html','clips-v28.html');
      h=h.replace('render-v25.html','render-v28.html').replace('render-v18.html','render-v28.html');
      h=h.replace('app-v25.html','app-v28.html').replace('source-hub-v26.html','core-render-apis-v28.html');
      a.setAttribute('href',h);
    });
    doc.querySelectorAll('button').forEach(b=>{
      if(b.textContent)b.textContent=b.textContent.replaceAll('v25','v28').replaceAll('v22','v28').replaceAll('v18','v28');
    });
    const renderBtn=doc.querySelector('#renderBtn');
    if(renderBtn&&type==='clips')renderBtn.onclick=function(e){try{e.preventDefault();doc.defaultView.location.href='render-v28.html'}catch(err){}};
  }
  function fixAll(){
    cleanFrame(safeDoc('clipsFrame'),'clips');
    cleanFrame(safeDoc('renderFrame'),'render');
    cleanFrame(safeDoc('coreFrame'),'core');
  }
  window.addEventListener('load',()=>{
    ['clipsFrame','renderFrame','coreFrame'].forEach(id=>{const f=$('#'+id);if(f)f.addEventListener('load',()=>setTimeout(fixAll,80))});
    setInterval(fixAll,1000);
    setTimeout(fixAll,200);
  });
})();