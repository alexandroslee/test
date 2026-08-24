(function(){
  if(window.__taxAiAutoTax152)return;
  window.__taxAiAutoTax152=true;

  const SPACE='https://alexandroslee-tax-ai-zerogpu-v152.hf.space';
  const SPACE_PAGE='https://huggingface.co/spaces/AlexandrosLee/tax-ai-zerogpu-v152';
  const ALLOWED=['應稅','零稅率','免稅','待確認'];
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const $=id=>document.getElementById(id);

  function patchSpace(){
    const input=$('hfSpaceUrl');
    if(input && input.value!==SPACE) input.value=SPACE;
    const card=$('hfZeroGpuCard');
    const link=card?.querySelector('a.btn.ghost');
    if(link) link.href=SPACE_PAGE;
  }

  function parseSse(text){
    let last=null,complete=null,event='';
    for(const line of String(text||'').split(/\r?\n/)){
      if(line.startsWith('event:')) event=line.slice(6).trim();
      else if(line.startsWith('data:')){
        try{
          const j=JSON.parse(line.slice(5).trim());
          last=j;
          if(event==='complete') complete=j;
        }catch{}
      }
    }
    const v=complete??last;
    return Array.isArray(v)?v[0]:v;
  }

  async function callTaxApi(image){
    const ctl=new AbortController();
    const timer=setTimeout(()=>ctl.abort(),150000);
    try{
      const submit=await fetch(`${SPACE}/gradio_api/call/tax_category_api`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({data:[image]}),
        signal:ctl.signal
      });
      if(!submit.ok) throw new Error(`submit HTTP ${submit.status}`);
      const sj=await submit.json();
      if(!sj.event_id) throw new Error('沒有 event_id');
      const result=await fetch(`${SPACE}/gradio_api/call/tax_category_api/${sj.event_id}`,{signal:ctl.signal});
      if(!result.ok) throw new Error(`result HTTP ${result.status}`);
      return parseSse(await result.text());
    }finally{
      clearTimeout(timer);
    }
  }

  function fullPreviewDataUrl(){
    const img=$('preview');
    if(!img?.complete)return '';
    const W=img.naturalWidth||img.width,H=img.naturalHeight||img.height;
    if(W<100||H<100)return '';
    const scale=Math.min(1.6,1800/Math.max(W,H));
    const c=document.createElement('canvas');
    c.width=Math.max(1,Math.round(W*scale));
    c.height=Math.max(1,Math.round(H*scale));
    c.getContext('2d').drawImage(img,0,0,c.width,c.height);
    return c.toDataURL('image/jpeg',0.92);
  }

  function currentTax(){
    const s=String($('tax')?.value||'').replace(/[,，\s元]/g,'');
    const n=Number(s);
    return Number.isFinite(n)?n:NaN;
  }

  function show(cls,text,source){
    const panel=$('taxCategoryEvidence'),body=$('taxCategoryEvidenceBody'),src=$('sTaxCategory');
    if(panel)panel.className=cls;
    if(body)body.textContent=text;
    if(src)src.textContent=source||'—';
  }

  function applyVisual(j,source='Gemma 自動票面勾選'){
    const cat=ALLOWED.includes(j?.category)?j.category:'待確認';
    if(cat==='待確認')return false;
    const sel=$('taxCategory');
    if(!sel)return false;
    const tax=currentTax();
    if(Number.isFinite(tax)&&tax>0&&(cat==='零稅率'||cat==='免稅')){
      show('warn',`票面視覺判「${cat}」，但稅額 ${Math.round(tax)} > 0；保留應稅／要求人工核對。`,'來源衝突');
      return false;
    }
    if(sel.dataset.humanEdited==='1'&&sel.value!==cat){
      show('warn',`自動辨識「${cat}」與人工「${sel.value}」不同；保留人工值。`,'人工確認');
      return false;
    }
    sel.value=cat;
    sel.dataset.aiSource=source;
    const confidence=Math.round((Number(j?.confidence)||0)*100);
    show('ok',`✓ 課稅別：${cat}｜${j?.evidence||'票面勾選位置已辨識'}；confidence ${confidence}%`,source);
    return true;
  }

  async function autoTaxCategory(){
    patchSpace();
    const api=window.__taxAiCore152Api;
    if(!api)return null;

    try{api.structuralTaxCategory?.()}catch{}

    let roi=null;
    try{roi=await api.gemmaTaxCategory?.()}catch{}
    if(roi && ALLOWED.includes(roi.category) && roi.category!=='待確認') return {source:'gemma-roi',result:roi};

    const full=fullPreviewDataUrl();
    if(!full)return null;
    show('info','正在自動定位票面「應稅／零稅率／免稅」勾選位置…','Gemma 全票面課稅別');
    try{
      const j=await callTaxApi(full);
      applyVisual(j,'Gemma 全票面自動勾選');
      return {source:'gemma-full',result:j};
    }catch(e){
      const current=$('taxCategory')?.value;
      if(current && current!=='待確認'){
        show('ok',`✓ 課稅別：${current}｜已由本地／金額結構完成判讀；全票面視覺補驗未完成。`,'自動判讀');
      }else{
        show('warn','課稅別自動視覺辨識未完成：'+(e?.message||e),'自動課稅別');
      }
      return null;
    }
  }

  function patchScan(){
    const scan=$('scan');
    if(!scan||scan.dataset.autoTax152==='1')return;
    const base=scan.onclick;
    scan.dataset.autoTax152='1';
    scan.textContent='✨ V1.5.2：自動辨識發票＋課稅別';
    scan.onclick=async function(...args){
      const r=typeof base==='function'?await base.apply(this,args):undefined;
      await sleep(120);
      await autoTaxCategory();
      return r;
    };
  }

  function patch(){patchSpace();patchScan()}
  patch();
  setTimeout(patch,50);
  setTimeout(patch,500);
  setTimeout(patch,1200);
  window.__taxAiAutoTax152Api={autoTaxCategory,applyVisual,patchSpace};
  console.info('[TaxAI] V1.5.2 automatic tax-category recognition enabled');
})();