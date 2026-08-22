(function(){
  if(window.__taxAiLocalTaxMark150)return;
  window.__taxAiLocalTaxMark150=true;
  const $=id=>document.getElementById(id);

  function normalize(s){return String(s||'').replace(/[：:]/g,' ').replace(/[＿_]+/g,' ____ ').replace(/\u3000/g,' ').replace(/[\t ]+/g,' ').trim()}
  function detect(text){
    const t=normalize(text);
    const mark='(?:V|v|✓|√|✔|☑|勾)';
    const patterns=[
      ['應稅',new RegExp(`應\\s*稅\\s*${mark}`,'i')],
      ['零稅率',new RegExp(`零\\s*稅\\s*率\\s*${mark}`,'i')],
      ['免稅',new RegExp(`免\\s*稅\\s*${mark}`,'i')]
    ];
    const hits=patterns.filter(([,r])=>r.test(t)).map(([k])=>k);
    if(hits.length===1)return {category:hits[0],evidence:`本地 OCR 讀到「${hits[0]}」旁有 V／✓／勾選`};

    // Common Taiwan e-invoice print order: 應稅 V 零稅率____ 免稅____
    const compact=t.replace(/\s+/g,' ');
    const m=compact.match(/應\s*稅\s*(V|v|✓|√|✔|☑)\s*零\s*稅\s*率[^Vv✓√✔☑]{0,24}免\s*稅/i);
    if(m)return {category:'應稅',evidence:'本地 OCR 讀到「應稅 V／零稅率／免稅」排列，V 位於應稅'};
    return null;
  }

  function apply(result){
    if(!result)return false;
    const sel=$('taxCategory'),src=$('sTaxCategory'),panel=$('taxCategoryEvidence'),body=$('taxCategoryEvidenceBody');
    if(!sel)return false;
    const current=sel.value||'待確認';
    if(sel.dataset.humanEdited==='1'&&current!==result.category){
      if(panel)panel.className='warn';
      if(body)body.textContent=`⚠ 本地票面 OCR 判斷「${result.category}」，但人工已確認「${current}」；保留人工值。`;
      return false;
    }
    const tax=Number(String($('tax')?.value||'').replace(/\D/g,''));
    if((result.category==='零稅率'||result.category==='免稅')&&tax>0){
      if(panel)panel.className='warn';
      if(body)body.textContent=`⚠ 本地 OCR 看似勾選「${result.category}」，但稅額 ${tax} > 0；來源衝突，不自動覆寫，請人工核對。`;
      return false;
    }
    sel.value=result.category;
    sel.dataset.aiSource='本地 OCR：票面勾選';
    if(src)src.textContent='本地 OCR：票面勾選';
    if(panel)panel.className='ok';
    if(body)body.textContent=`✓ 課稅別：${result.category}｜來源：本地 OCR 票面勾選｜${result.evidence}`;
    window.__taxAiTaxCategoryState={category:result.category,source:'本地 OCR：票面勾選',evidence:result.evidence};
    return true;
  }

  function inspect(){
    const texts=[];
    if($('raw')?.value)texts.push($('raw').value);
    if($('stampRaw')?.value)texts.push($('stampRaw').value);
    const hit=detect(texts.join('\n'));
    if(hit)return apply(hit);
    return false;
  }

  const scan=$('scan');
  if(scan){
    const old=scan.onclick;
    scan.onclick=async function(){const r=typeof old==='function'?await old.call(scan):undefined;inspect();return r};
  }
  $('recheck')?.addEventListener('click',()=>setTimeout(inspect,0));
  window.__taxAiLocalTaxMark={detect,inspect};
  setTimeout(inspect,1200);
  console.info('[TaxAI] V1.5.0 local tax-category mark detector active');
})();
