(function(){
  if(window.__taxAiRelease157)return;
  window.__taxAiRelease157=true;
  const $=id=>document.getElementById(id);
  function apply(){
    document.title='AI 超簡易營業稅申報 V1.5.7｜媒體申報預檢版';
    const sub=document.querySelector('.top .muted');if(sub)sub.textContent='V1.5.7｜AI 發票辨識＋手開發票 Gemma 4 E4B 自動交叉辨識＋媒體申報資料＋401試算＋81 Bytes 欄位預檢';
    const hero=document.querySelector('.hero');if(hero)hero.innerHTML='<b>V1.5.7 媒體申報預檢：</b>電子發票優先 QR；手開／無 QR 發票會在本地 OCR 後自動啟用 Gemma 4 E4B 整張交叉辨識，再完成課稅別、稅額、人工核對、整期媒體資料與 401 試算。正式送件仍以官方檢核程式結果為準。';
    const scan=$('scan');if(scan)scan.textContent='✨ V1.5.7：自動辨識＋手寫 Gemma＋媒體申報預檢';
    const mediaTitle=$('v156Media')?.querySelector('h2');if(mediaTitle)mediaTitle.textContent='💾 5. 營業稅媒體申報資料建立';
    const hfTitle=$('hfZeroGpuCard')?.querySelector('h2');if(hfTitle)hfTitle.textContent='☁️ V1.5.7 Frontend｜Hugging Face ZeroGPU V1.5.2 Backend｜Gemma 4 E4B';
    const hfSub=$('hfZeroGpuCard')?.querySelector('.muted');if(hfSub)hfSub.textContent='電子發票 QR 優先；手開／無 QR 發票自動啟用 Gemma 4 E4B 整張交叉辨識。Backend release 維持 V1.5.2 已驗證核心。';
  }
  apply();setTimeout(apply,200);setTimeout(apply,800);setInterval(apply,1000);
  window.__taxAiRelease157Api={apply};
})();