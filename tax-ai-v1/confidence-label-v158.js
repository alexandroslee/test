(function(){
  if(window.__taxAiConfidenceLabel158)return;window.__taxAiConfidenceLabel158=true;
  function apply(){
    const e=document.getElementById('v154ScoreBreakdown');
    if(e)e.textContent=String(e.textContent||'').replace(/V1\.5\.4/g,'V1.5.8');
    const p=document.getElementById('ocrConfidence');
    if(p)p.title=String(p.title||'').replace(/V1\.5\.4/g,'V1.5.8').replace(/V1\.5\.7/g,'V1.5.8');
  }
  apply();setInterval(apply,600);
})();