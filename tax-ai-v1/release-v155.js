(function(){
  if(window.__taxAiRelease155)return;
  window.__taxAiRelease155=true;
  const VERSION='1.5.5';
  const BUILD='20260824-v155-public-test';
  const $=id=>document.getElementById(id);

  function replaceText(node){
    if(!node)return;
    if(node.childNodes?.length){for(const c of node.childNodes){if(c.nodeType===3)c.nodeValue=String(c.nodeValue||'').replace(/V1\.5\.4/g,'V1.5.5');else replaceText(c)}}
  }
  function applyUi(){
    document.title='AI 超簡易營業稅申報 V1.5.5｜Public Test';
    const subtitle=document.querySelector('.top .muted');if(subtitle)subtitle.textContent='V1.5.5 公開測試版｜自動課稅別＋自動算稅＋綜合信心評分＋人工覆寫';
    const hero=document.querySelector('.hero');if(hero)hero.innerHTML='<b>V1.5.5 公開測試版：</b>AI 先自動辨識發票與課稅別、先寫入結果並自動計算稅額，再以綜合信心分數決定是否提示人工核對；使用者可直接修改，人工修改優先。';
    const scan=$('scan');if(scan)scan.textContent='✨ V1.5.5：自動辨識＋課稅別＋自動算稅';
    const card=$('hfZeroGpuCard');if(card){const h=card.querySelector('h2');if(h)h.textContent='☁️ V1.5.5 前端公開測試｜Hugging Face ZeroGPU V1.5.2 Backend'}
    const release=$('releaseContract152Body');if(release&&!/Frontend V1\.5\.5/.test(release.innerHTML))release.insertAdjacentHTML('beforeend','<br><b>Frontend V1.5.5 public test layer active</b>');
    replaceText($('v154Decision'));replaceText($('v154ScoreBreakdown'));
    const pill=$('ocrConfidence');if(pill&&/OCR 最佳信心/.test(pill.textContent||''))pill.textContent=String(pill.textContent||'').replace('OCR 最佳信心','初始 OCR 信心');
    try{if(window.__taxAiV154Decision)window.__taxAiV154Decision.version=VERSION}catch{}
    try{if(window.__taxAiCompositeConfidence154)window.__taxAiCompositeConfidence154.version=VERSION}catch{}
  }
  function observe(){
    for(const id of ['v154Decision','v154ScoreBreakdown','ocrConfidence','qualityScore']){
      const e=$(id);if(e&&!e.dataset.v155Observed){e.dataset.v155Observed='1';new MutationObserver(()=>setTimeout(applyUi,0)).observe(e,{childList:true,characterData:true,subtree:true})}
    }
  }
  function patch(){applyUi();observe()}
  patch();setTimeout(patch,100);setTimeout(patch,700);setTimeout(patch,1600);setInterval(patch,1500);
  window.__taxAiRelease155Api={VERSION,BUILD,applyUi};
  console.info('[TaxAI] V1.5.5 public test release active',BUILD);
})();
