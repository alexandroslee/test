(function(){
  const d=document;
  const subtitle=d.querySelector('.top .muted');
  if(subtitle)subtitle.textContent='V1.4.8｜QR 權威＋方向校正後 Gemma＋Queue 自動重試＋票面金額語義';
  const hero=d.querySelector('.hero');
  if(hero)hero.innerHTML='<b>V1.4.8：</b>電子發票先以 QR 為最高權威來源；本地流程完成方向校正後，Gemma 4 E4B 會使用正向影像交叉辨識，不再直接送側轉原圖。QR 已取得的發票號碼、統編與金額不被模型覆蓋；「銷售額」＝未稅、「稅額」＝營業稅、「總計」＝含稅總額。電子發票不再執行手開發票的買受人 8 格流程。';
  const scan=d.getElementById('scan');
  if(scan)scan.textContent='✨ V1.4.8：QR＋方向校正＋ZeroGPU Gemma 4 E4B';
  const h2=d.querySelector('#hfZeroGpuCard h2');
  if(h2)h2.textContent='☁️ 1.4.8 Hugging Face ZeroGPU｜Gemma 4 E4B';
})();
