(function(){
  const d=document;
  const subtitle=d.querySelector('.top .muted');
  if(subtitle)subtitle.textContent='V1.4.5｜ZeroGPU＋Gemma 4 E4B＋Gradio 自動容錯＋票面金額語義';
  const hero=d.querySelector('.hero');
  if(hero)hero.innerHTML='<b>V1.4.5：</b>電子發票／三聯式發票使用 Hugging Face ZeroGPU → Gemma 4 E4B；新增 Gradio 事件串流自動容錯與 /run 備援。票面「銷售額」優先作為未稅金額，「稅額」作為營業稅額，「總計／合計／總額」作為含稅總額；只有票面缺值時才使用 5% 反算。';
  const scan=d.getElementById('scan');
  if(scan)scan.textContent='✨ V1.4.5：本地辨識＋ZeroGPU Gemma 4 E4B';
  const h2=d.querySelector('#hfZeroGpuCard h2');
  if(h2)h2.textContent='☁️ 1.4.5 Hugging Face ZeroGPU｜Gemma 4 E4B';
})();
