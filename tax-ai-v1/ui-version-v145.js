(function(){
  const d=document;
  const subtitle=d.querySelector('.top .muted');
  if(subtitle)subtitle.textContent='V1.4.9｜電子發票 QR 直接解析＋ZeroGPU Gemma 4 E4B 交叉驗證';
  const hero=d.querySelector('.hero');
  if(hero)hero.innerHTML='<b>V1.4.9：</b>電子發票不再等候 AI 才顯示金額。只要標準第一個 QR 成功讀取，系統直接從 QR 原始資料解析並立即回填：發票號碼、日期、賣方／買方統編、銷售額（未稅）、稅額與含稅總額。QR 是電子發票權威來源；Gemma 4 E4B 改為交叉驗證。';
  const scan=d.getElementById('scan');
  if(scan)scan.textContent='✨ V1.4.9：QR 直接解析＋AI 交叉驗證';
  const h2=d.querySelector('#hfZeroGpuCard h2');
  if(h2)h2.textContent='☁️ 1.4.9 Hugging Face ZeroGPU｜Gemma 4 E4B';
})();
