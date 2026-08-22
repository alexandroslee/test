(function(){
  if(window.__taxAiTaxCategoryGate150)return;
  window.__taxAiTaxCategoryGate150=true;
  const add=document.getElementById('add');
  if(!add)return;
  add.addEventListener('click',function(e){
    const cat=document.getElementById('taxCategory')?.value||'待確認';
    if(cat==='應稅')return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const panel=document.getElementById('taxCategoryEvidence');
    const body=document.getElementById('taxCategoryEvidenceBody');
    if(panel)panel.className='warn';
    if(body)body.textContent=`⚠ 課稅別目前為「${cat}」。本版 401 MVP 僅自動納入一般應稅發票；零稅率、免稅或尚未確認的發票必須先人工審查，不會誤套 5% 計算。`;
  },true);
})();
