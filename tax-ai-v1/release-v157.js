(function(){
  if(window.__taxAiRelease157)return;
  window.__taxAiRelease157=true;
  const $=id=>document.getElementById(id);
  function apply(){
    document.title='AI 超簡易營業稅申報 V1.5.7｜媒體申報預檢版';
    const sub=document.querySelector('.top .muted');if(sub)sub.textContent='V1.5.7｜AI 發票辨識＋媒體申報資料＋401試算＋81 Bytes 欄位預檢';
    const hero=document.querySelector('.hero');if(hero)hero.innerHTML='<b>V1.5.7 媒體申報預檢：</b>AI 先完成發票辨識、課稅別與稅額，再建立整期媒體資料與 401 試算；最後依財政部現行欄位規則檢查稅籍編號、流水號、資料年月、格式代號、課稅別、扣抵代號、彙加註記及重複資料。正式送件仍以官方檢核程式結果為準。';
    const scan=$('scan');if(scan)scan.textContent='✨ V1.5.7：自動辨識＋媒體申報預檢';
    const mediaTitle=$('v156Media')?.querySelector('h2');if(mediaTitle)mediaTitle.textContent='💾 5. 營業稅媒體申報資料建立';
  }
  apply();setTimeout(apply,200);setTimeout(apply,800);setInterval(apply,1000);
  window.__taxAiRelease157Api={apply};
})();