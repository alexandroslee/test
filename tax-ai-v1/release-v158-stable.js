(function(){
  if(window.__taxAiRelease158Stable)return;window.__taxAiRelease158Stable=true;
  const $=id=>document.getElementById(id);
  function apply(){
    document.title='AI 超簡易營業稅申報 V1.5.8｜穩定重整版';
    const sub=document.querySelector('.top .muted');if(sub)sub.textContent='V1.5.8｜穩定優先：QR／本地 OCR／課稅別／金額先完成；Gemma 4 E4B 改為選用加強，不阻塞主流程；保留媒體申報與 401／403 預檢。';
    const hero=document.querySelector('.hero');if(hero)hero.innerHTML='<b>V1.5.8 穩定重整版：</b>新發票先完成 QR／本地 OCR／課稅別與金額交叉驗證，不再等待 ZeroGPU。Gemma 4 E4B 保留為選用加強辨識；即使排隊或失敗，也不會卡住主流程。';
    const hfTitle=$('hfZeroGpuCard')?.querySelector('h2');if(hfTitle)hfTitle.textContent='☁️ V1.5.8 Frontend｜Hugging Face ZeroGPU V1.5.2 Backend｜Gemma 4 E4B（選用加強）';
    const hfSub=$('hfZeroGpuCard')?.querySelector('.muted');if(hfSub)hfSub.textContent='V1.5.8 穩定模式：主辨識不依賴 ZeroGPU；Gemma 4 E4B 僅在需要時補強手寫欄位。';
    const mediaTitle=$('v156Media')?.querySelector('h2');if(mediaTitle)mediaTitle.textContent='💾 5. 營業稅媒體申報資料建立';
  }
  apply();setTimeout(apply,200);setTimeout(apply,900);setInterval(apply,1200);
  window.__taxAiRelease158StableApi={apply};
})();