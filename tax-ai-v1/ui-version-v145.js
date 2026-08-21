(function(){
  const d=document;
  const subtitle=d.querySelector('.top .muted');
  if(subtitle)subtitle.textContent='V1.4.7｜ZeroGPU＋Gemma 4 E4B＋Queue 自動重試＋票面金額語義';
  const hero=d.querySelector('.hero');
  if(hero)hero.innerHTML='<b>V1.4.7：</b>電子發票／三聯式發票使用 Hugging Face ZeroGPU → Gemma 4 E4B；若 Gradio 事件串流因冷啟動／排隊沒有完成事件，會先救回最後有效資料，仍失敗就用同一張圖片自動重新排 ZeroGPU queue，最多再試 2 次，不必重新上傳。票面「銷售額」優先作為未稅金額，「稅額」作為營業稅額，「總計／合計／總額」作為含稅總額；只有票面缺值時才使用 5% 反算。';
  const scan=d.getElementById('scan');
  if(scan)scan.textContent='✨ V1.4.7：本地辨識＋ZeroGPU Gemma 4 E4B';
  const h2=d.querySelector('#hfZeroGpuCard h2');
  if(h2)h2.textContent='☁️ 1.4.7 Hugging Face ZeroGPU｜Gemma 4 E4B';
})();
