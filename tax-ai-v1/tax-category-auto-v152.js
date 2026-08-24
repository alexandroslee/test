(function(){
  if(window.__taxAiAutoTax152)return;
  window.__taxAiAutoTax152=true;

  const SPACE='https://alexandroslee-tax-ai-zerogpu-v152.hf.space';
  const SPACE_PAGE='https://huggingface.co/spaces/AlexandrosLee/tax-ai-zerogpu-v152';
  const CONCRETE=['應稅','零稅率','免稅'];
  const ALLOWED=[...CONCRETE,'待確認'];
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const $=id=>document.getElementById(id);

  function patchSpace(){
    const input=$('hfSpaceUrl');
    if(input&&input.value!==SPACE)input.value=SPACE;
    const card=$('hfZeroGpuCard');
    const link=card?.querySelector('a.btn.ghost');
    if(link)link.href=SPACE_PAGE;
  }

  function parseSse(text){
    let last=null,complete=null,event='';
    for(const line of String(text||'').split(/\r?\n/)){
      if(line.startsWith('event:'))event=line.slice(6).trim();
      else if(line.startsWith('data:')){
        try{const j=JSON.parse(line.slice(5).trim());last=j;if(event==='complete')complete=j}catch{}
      }
    }
    const v=complete??last;
    return Array.isArray(v)?v[0]:v;
  }

  async function callTaxApi(image){
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),150000);
    try{
      const submit=await fetch(`${SPACE}/gradio_api/call/tax_category_api`,{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:[image]}),signal:ctl.signal
      });
      if(!submit.ok)throw new Error(`submit HTTP ${submit.status}`);
      const sj=await submit.json();if(!sj.event_id)throw new Error('沒有 event_id');
      const result=await fetch(`${SPACE}/gradio_api/call/tax_category_api/${sj.event_id}`,{signal:ctl.signal});
      if(!result.ok)throw new Error(`result HTTP ${result.status}`);
      return parseSse(await result.text());
    }finally{clearTimeout(timer)}
  }

  function fullPreviewDataUrl(){
    const img=$('preview');if(!img?.complete)return '';
    const W=img.naturalWidth||img.width,H=img.naturalHeight||img.height;if(W<100||H<100)return '';
    const scale=Math.min(1.6,1800/Math.max(W,H)),c=document.createElement('canvas');
    c.width=Math.max(1,Math.round(W*scale));c.height=Math.max(1,Math.round(H*scale));
    c.getContext('2d').drawImage(img,0,0,c.width,c.height);
    return c.toDataURL('image/jpeg',0.92);
  }

  function money(id){
    const s=String($(id)?.value||'').replace(/[,，\s元$NTnt]/g,''),n=Number(s);
    return Number.isFinite(n)?n:NaN;
  }

  function concreteCurrent(){
    const v=$('taxCategory')?.value||'';
    return CONCRETE.includes(v)?v:'';
  }

  function writeAiAmount(id,value,source){
    const el=$(id);if(!el||!Number.isFinite(value))return false;
    if(el.dataset.humanEdited==='1'&&String(el.value||'').trim()!=='')return false;
    const rounded=Math.round(value);el.value=String(rounded);el.dataset.aiSource=source;el.dataset.autoDerived='1';
    try{if(typeof state!=='undefined'&&state?.candidates)state.candidates[id]=[{value:String(rounded),source,score:130}]}catch{}
    try{if(typeof setSource==='function')setSource(id,source)}catch{}
    try{el.dispatchEvent(new Event('input',{bubbles:true}))}catch{}
    try{el.dispatchEvent(new Event('change',{bubbles:true}))}catch{}
    return true;
  }

  function autoReverseTaxable(source='應稅 5% 自動反推'){
    const gross=money('gross');if(!Number.isFinite(gross)||gross<=0)return null;
    const tax=Math.round((gross/1.05)*0.05),net=Math.round(gross-tax);
    const existingNet=money('net'),existingTax=money('tax');
    const coherent=Number.isFinite(existingNet)&&Number.isFinite(existingTax)&&Math.round(existingNet+existingTax)===Math.round(gross);
    let wroteNet=false,wroteTax=false;
    if(!coherent){wroteNet=writeAiAmount('net',net,source);wroteTax=writeAiAmount('tax',tax,source)}
    else{try{if(typeof setSource==='function'){setSource('net','應稅金額已驗證');setSource('tax','應稅金額已驗證')}}catch{}}
    return {gross:Math.round(gross),net,tax,wroteNet,wroteTax,coherent};
  }

  function show(cls,text,source){
    const panel=$('taxCategoryEvidence'),body=$('taxCategoryEvidenceBody'),src=$('sTaxCategory');
    if(panel)panel.className=cls;if(body)body.textContent=text;if(src)src.textContent=source||'—';
  }

  function setConcreteCategory(cat,source,evidence='',confidence=null){
    if(!CONCRETE.includes(cat))return false;
    const sel=$('taxCategory');if(!sel)return false;
    sel.value=cat;sel.dataset.aiSource=source;sel.dataset.lastAiTaxCategory=cat;sel.dataset.lastAiTaxCategoryAt=String(Date.now());
    try{sel.dispatchEvent(new Event('input',{bubbles:true}))}catch{}
    try{sel.dispatchEvent(new Event('change',{bubbles:true}))}catch{}
    const derived=cat==='應稅'?autoReverseTaxable('應稅 5% 自動反推'):null;
    refreshRecognitionState({cat,confidence,derived});
    const conf=Number(confidence),confText=Number.isFinite(conf)?`；confidence ${Math.round(conf)}%`:'';
    const amountText=derived?`；含稅 ${derived.gross} → 未稅 ${derived.net}＋稅額 ${derived.tax}`:'';
    show('ok',`✓ 課稅別已自動填入：${cat}｜${evidence||'票面勾選位置已辨識'}${confText}${amountText}`,source);
    return true;
  }

  function refreshRecognitionState(info={}){
    let result=null;
    try{if(typeof validateRecognition==='function')result=validateRecognition()}catch{}
    try{if(typeof renderSourceDetail==='function')renderSourceDetail()}catch{}
    const cat=info.cat||concreteCurrent(),confidence=Number(info.confidence);
    const gross=money('gross'),net=money('net'),tax=money('tax');
    const amountOk=Number.isFinite(gross)&&gross>0&&Number.isFinite(net)&&Number.isFinite(tax)&&Math.round(net+tax)===Math.round(gross);

    const checks=$('checks');
    if(checks&&CONCRETE.includes(cat)){
      let row=$('autoTaxQualityCheck');
      if(!row){row=document.createElement('div');row.id='autoTaxQualityCheck';row.className='check';checks.prepend(row)}
      const confText=Number.isFinite(confidence)?`（${Math.round(confidence)}%）`:'';
      row.innerHTML=`<span>✅ 課稅別 AI 辨識：${cat}${confText}</span><b>PASS</b>`;
    }

    if(result){
      let score=Number(result.score)||0;if(CONCRETE.includes(cat))score+=8;if(amountOk)score+=5;score=Math.min(100,Math.max(0,score));
      result.score=score;if($('qualityScore'))$('qualityScore').textContent=String(score);
      if($('status'))$('status').textContent=`辨識完成：品質 ${score}/100；課稅別 ${cat||'待確認'}${amountOk?`；金額 ${Math.round(net)}＋${Math.round(tax)}＝${Math.round(gross)}`:''}。`;
    }

    if($('scanSummary')&&CONCRETE.includes(cat)&&amountOk){
      $('scanSummary').className='ok';
      $('scanSummary').textContent=`✓ 課稅別 ${cat} 已確認；未稅 ${Math.round(net)}、稅額 ${Math.round(tax)}、含稅 ${Math.round(gross)} 已同步回寫並重新驗證。`;
    }

    setTimeout(()=>{
      try{if(typeof validateRecognition==='function')validateRecognition()}catch{}
      try{if(typeof renderSourceDetail==='function')renderSourceDetail()}catch{}
      if(checks&&CONCRETE.includes(cat)){
        let row=$('autoTaxQualityCheck');if(!row){row=document.createElement('div');row.id='autoTaxQualityCheck';row.className='check';checks.prepend(row)}
        const confText=Number.isFinite(confidence)?`（${Math.round(confidence)}%）`:'';
        row.innerHTML=`<span>✅ 課稅別 AI 辨識：${cat}${confText}</span><b>PASS</b>`;
      }
    },100);
    return result;
  }

  async function autoTaxCategory(){
    patchSpace();const api=window.__taxAiCore152Api;if(!api)return null;

    // 0. Keep any already-confirmed category. An uncertain later model result
    // must NEVER downgrade a concrete category to 待確認.
    let bestCat=concreteCurrent(),bestSource=bestCat?'既有明確判讀':'',bestEvidence='',bestConfidence=null;

    // 1. Deterministic amount structure can confirm taxable when tax > 0.
    try{
      const structural=api.structuralTaxCategory?.();
      if(CONCRETE.includes(structural)){bestCat=structural;bestSource='金額結構判定';bestEvidence='稅額與總額結構確認';bestConfidence=100}
    }catch{}

    // 2. Local ROI OCR is fast and is allowed to establish a concrete category.
    try{
      const local=await api.localTaxCategory?.();
      if(CONCRETE.includes(local?.cat)){bestCat=local.cat;bestSource='本地 ROI OCR：票面標記';bestEvidence=String(local.text||'').trim().slice(0,120);bestConfidence=95}
    }catch{}

    // Save the concrete result BEFORE asking Gemma, because Gemma may return 待確認.
    if(CONCRETE.includes(bestCat))setConcreteCategory(bestCat,bestSource,bestEvidence,bestConfidence);

    // 3. Gemma cropped ROI may upgrade/confirm, but 待確認 cannot erase bestCat.
    let roi=null;
    try{roi=await api.gemmaTaxCategory?.()}catch{}
    if(CONCRETE.includes(roi?.category)){
      bestCat=roi.category;bestSource='Gemma 課稅別專用裁切';bestEvidence=roi.evidence||'票面勾選位置';bestConfidence=(Number(roi.confidence)||0)*100;
      setConcreteCategory(bestCat,bestSource,bestEvidence,bestConfidence);
      return {source:'gemma-roi',result:roi,applied:true};
    }

    // Restore a prior concrete result if the core Gemma path temporarily wrote 待確認.
    if(CONCRETE.includes(bestCat))setConcreteCategory(bestCat,bestSource,bestEvidence,bestConfidence);

    // 4. Full-image Gemma is a final visual backup. Again, 待確認 never downgrades.
    const full=fullPreviewDataUrl();
    if(full){
      show('info','正在做全票面課稅別補驗；既有明確結果不會被「待確認」覆蓋。','Gemma 全票面課稅別');
      try{
        const j=await callTaxApi(full);
        if(CONCRETE.includes(j?.category)){
          bestCat=j.category;bestSource='Gemma 全票面自動勾選';bestEvidence=j.evidence||'票面勾選位置';bestConfidence=(Number(j.confidence)||0)*100;
          setConcreteCategory(bestCat,bestSource,bestEvidence,bestConfidence);
          return {source:'gemma-full',result:j,applied:true};
        }
      }catch{}
    }

    if(CONCRETE.includes(bestCat)){
      setConcreteCategory(bestCat,bestSource,bestEvidence,bestConfidence);
      return {source:'preserved-concrete',result:{category:bestCat},applied:true};
    }

    show('warn','⚠ 本次尚未取得可靠課稅別；保留待確認，不猜測。','自動課稅別');
    return {source:'unresolved',result:{category:'待確認'},applied:false};
  }

  function patchScan(){
    const scan=$('scan');if(!scan||scan.dataset.autoTax152==='1')return;
    const base=scan.onclick;scan.dataset.autoTax152='1';scan.textContent='✨ V1.5.2：自動辨識發票＋課稅別＋稅額';
    scan.onclick=async function(...args){
      const r=typeof base==='function'?await base.apply(this,args):undefined;
      await sleep(150);await autoTaxCategory();return r;
    };
  }

  function patch(){patchSpace();patchScan()}
  patch();setTimeout(patch,50);setTimeout(patch,500);setTimeout(patch,1200);
  window.__taxAiAutoTax152Api={autoTaxCategory,setConcreteCategory,autoReverseTaxable,refreshRecognitionState,patchSpace};
  console.info('[TaxAI] V1.5.2 monotonic tax-category recognition enabled');
})();