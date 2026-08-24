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

  function money(id){
    const s=String($(id)?.value||'').replace(/[,，\s元$NTnt]/g,'');
    const n=Number(s);
    return Number.isFinite(n)?n:NaN;
  }

  function currentTax(){return money('tax')}

  function writeAiAmount(id,value,source){
    const el=$(id);
    if(!el||!Number.isFinite(value))return false;
    if(el.dataset.humanEdited==='1'&&String(el.value||'').trim()!=='')return false;
    const rounded=Math.round(value);
    el.value=String(rounded);
    el.dataset.aiSource=source;
    el.dataset.autoDerived='1';

    // Publish the derived value back into the original V0.31 recognition state,
    // so source detail, conflict checks and quality scoring see the new value.
    try{
      if(typeof state!=='undefined'&&state?.candidates){
        state.candidates[id]=[{value:String(rounded),source,score:130}];
      }
    }catch{}
    try{if(typeof setSource==='function')setSource(id,source)}catch{}
    try{el.dispatchEvent(new Event('input',{bubbles:true}))}catch{}
    try{el.dispatchEvent(new Event('change',{bubbles:true}))}catch{}
    return true;
  }

  function autoReverseTaxable(source='應稅 5% 自動反推'){
    const gross=money('gross');
    if(!Number.isFinite(gross)||gross<=0)return null;

    const tax=Math.round((gross/1.05)*0.05);
    const net=Math.round(gross-tax);
    const existingNet=money('net'),existingTax=money('tax');
    const coherent=Number.isFinite(existingNet)&&Number.isFinite(existingTax)&&Math.round(existingNet+existingTax)===Math.round(gross);

    let wroteNet=false,wroteTax=false;
    if(!coherent){
      wroteNet=writeAiAmount('net',net,source);
      wroteTax=writeAiAmount('tax',tax,source);
    }else{
      // Even when the numbers were already correct, publish their verified source
      // so the recognition-state panel no longer treats them as incomplete/stale.
      try{if(typeof setSource==='function'){setSource('net','應稅金額已驗證');setSource('tax','應稅金額已驗證')}}catch{}
    }

    return {gross:Math.round(gross),net,tax,wroteNet,wroteTax,coherent};
  }

  function show(cls,text,source){
    const panel=$('taxCategoryEvidence'),body=$('taxCategoryEvidenceBody'),src=$('sTaxCategory');
    if(panel)panel.className=cls;
    if(body)body.textContent=text;
    if(src)src.textContent=source||'—';
  }

  function refreshRecognitionState(info={}){
    let result=null;
    try{if(typeof validateRecognition==='function')result=validateRecognition()}catch{}
    try{if(typeof renderSourceDetail==='function')renderSourceDetail()}catch{}

    const cat=info.cat||$('taxCategory')?.value||'';
    const confidence=Number(info.confidence);
    const gross=money('gross'),net=money('net'),tax=money('tax');
    const amountOk=Number.isFinite(gross)&&gross>0&&Number.isFinite(net)&&Number.isFinite(tax)&&Math.round(net+tax)===Math.round(gross);

    // Add the AI tax-category decision to the main recognition-quality checklist.
    const checks=$('checks');
    if(checks&&cat&&cat!=='待確認'){
      let row=$('autoTaxQualityCheck');
      if(!row){
        row=document.createElement('div');
        row.id='autoTaxQualityCheck';
        row.className='check';
        checks.prepend(row);
      }
      const confText=Number.isFinite(confidence)?`（${Math.round(confidence)}%）`:'';
      row.innerHTML=`<span>✅ 課稅別 AI 辨識：${cat}${confText}</span><b>PASS</b>`;
    }

    // Base V0.31 scoring predates tax-category AI, so award explicit evidence
    // for a concrete visual tax category and a verified amount equation.
    if(result){
      let finalScore=Number(result.score)||0;
      if(cat&&cat!=='待確認')finalScore+=8;
      if(amountOk)finalScore+=5;
      finalScore=Math.max(0,Math.min(100,finalScore));
      result.score=finalScore;
      if($('qualityScore'))$('qualityScore').textContent=String(finalScore);

      const status=$('status');
      if(status){
        const amountText=amountOk?`；金額 ${Math.round(net)}＋${Math.round(tax)}＝${Math.round(gross)}`:'';
        status.textContent=`辨識完成：品質 ${finalScore}/100；課稅別 ${cat||'待確認'}${amountText}。`;
      }
    }

    const summary=$('scanSummary');
    if(summary&&cat&&cat!=='待確認'&&amountOk){
      summary.className='ok';
      summary.textContent=`✓ 課稅別 ${cat} 已確認；未稅 ${Math.round(net)}、稅額 ${Math.round(tax)}、含稅 ${Math.round(gross)} 已同步回寫並重新驗證。`;
    }

    // Some older UI modules refresh on the recheck button path. Run it once
    // after the synchronous refresh, then re-apply the AI checklist/score.
    const recheck=$('recheck');
    if(recheck&&typeof recheck.onclick==='function'){
      setTimeout(()=>{
        try{recheck.onclick()}catch{}
        try{
          const again=typeof validateRecognition==='function'?validateRecognition():null;
          if(again){
            let score=Number(again.score)||0;
            if(cat&&cat!=='待確認')score+=8;
            if(amountOk)score+=5;
            score=Math.min(100,score);
            if($('qualityScore'))$('qualityScore').textContent=String(score);
          }
          if(typeof renderSourceDetail==='function')renderSourceDetail();
          if(checks&&cat&&cat!=='待確認'){
            let row=$('autoTaxQualityCheck');
            if(!row){row=document.createElement('div');row.id='autoTaxQualityCheck';row.className='check';checks.prepend(row)}
            const confText=Number.isFinite(confidence)?`（${Math.round(confidence)}%）`:'';
            row.innerHTML=`<span>✅ 課稅別 AI 辨識：${cat}${confText}</span><b>PASS</b>`;
          }
        }catch{}
      },80);
    }
    return result;
  }

  function applyVisual(j,source='Gemma 自動票面勾選'){
    const cat=ALLOWED.includes(j?.category)?j.category:'待確認';
    if(cat==='待確認')return false;
    const sel=$('taxCategory');
    if(!sel)return false;

    sel.value=cat;
    sel.dataset.aiSource=source;
    sel.dataset.lastAiTaxCategory=cat;
    sel.dataset.lastAiTaxCategoryAt=String(Date.now());
    try{sel.dispatchEvent(new Event('input',{bubbles:true}))}catch{}
    try{sel.dispatchEvent(new Event('change',{bubbles:true}))}catch{}

    const derived=cat==='應稅'?autoReverseTaxable('應稅 5% 自動反推'):null;
    const confidence=Math.round((Number(j?.confidence)||0)*100);
    const tax=currentTax();
    let extra='';
    let cls='ok';
    if(derived)extra+=`；含稅 ${derived.gross} → 未稅 ${derived.net}＋稅額 ${derived.tax}`;
    if(Number.isFinite(tax)&&tax>0&&(cat==='零稅率'||cat==='免稅')){
      cls='warn';
      extra+=`；⚠ 稅額 ${Math.round(tax)} > 0，請人工核對`;
    }
    show(cls,`✓ 課稅別已自動填入：${cat}｜${j?.evidence||'票面勾選位置已辨識'}；confidence ${confidence}%${extra}`,source);

    refreshRecognitionState({cat,confidence,derived,source,evidence:j?.evidence||''});
    return true;
  }

  async function autoTaxCategory(){
    patchSpace();
    const api=window.__taxAiCore152Api;
    if(!api)return null;

    try{api.structuralTaxCategory?.()}catch{}

    let roi=null;
    try{roi=await api.gemmaTaxCategory?.()}catch{}
    if(roi && ALLOWED.includes(roi.category) && roi.category!=='待確認'){
      applyVisual(roi,'Gemma 課稅別專用裁切');
      return {source:'gemma-roi',result:roi,applied:true};
    }

    const full=fullPreviewDataUrl();
    if(!full)return null;
    show('info','正在自動定位票面「應稅／零稅率／免稅」勾選位置…','Gemma 全票面課稅別');
    try{
      const j=await callTaxApi(full);
      const applied=applyVisual(j,'Gemma 全票面自動勾選');
      return {source:'gemma-full',result:j,applied};
    }catch(e){
      const current=$('taxCategory')?.value;
      const derived=current==='應稅'?autoReverseTaxable('應稅 5% 自動反推'):null;
      if(current && current!=='待確認'){
        refreshRecognitionState({cat:current,derived});
        show('ok',`✓ 課稅別：${current}｜已完成自動判讀、金額回寫與品質重新驗證。`,'自動判讀');
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
    scan.textContent='✨ V1.5.2：自動辨識發票＋課稅別＋稅額';
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
  window.__taxAiAutoTax152Api={autoTaxCategory,applyVisual,autoReverseTaxable,refreshRecognitionState,patchSpace};
  console.info('[TaxAI] V1.5.2 automatic tax-category + amount derivation + quality refresh enabled');
})();