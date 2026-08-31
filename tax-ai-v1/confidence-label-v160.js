(function(){
  if(window.__taxAiConfidenceLabel160)return;
  window.__taxAiConfidenceLabel160=true;
  function normalize(el){
    if(!el)return;
    const clean=s=>String(s||'').replace(/V\d+\.\d+(?:\.\d+)?\s*/g,'').trim();
    if(el.textContent&&/綜合辨識信心|OCR/.test(el.textContent)){
      const v=clean(el.textContent);if(el.textContent!==v)el.textContent=v;
    }
    if(el.title){const v=clean(el.title);if(el.title!==v)el.title=v;}
  }
  function bind(id){
    const el=document.getElementById(id);if(!el)return;
    normalize(el);
    const mo=new MutationObserver(()=>normalize(el));
    mo.observe(el,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['title']});
  }
  bind('v154ScoreBreakdown');
  bind('ocrConfidence');
})();