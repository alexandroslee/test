(function(){
  if(window.__taxAiHandGemmaAuto157)return;
  window.__taxAiHandGemmaAuto157=true;
  const $=id=>document.getElementById(id);
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const BUILD='20260826-v157-hand-gemma-buyer-auto-r6';

  function digits(v){return String(v??'').replace(/\D/g,'')}
  function validBan(v){
    v=digits(v);if(!/^\d{8}$/.test(v))return false;
    const w=[1,2,1,2,1,2,4,1];let sum=0;
    for(let i=0;i<8;i++){const p=Number(v[i])*w[i];sum+=Math.floor(p/10)+(p%10)}
    return sum%5===0 || (v[6]==='7'&&(sum+1)%5===0);
  }
  function hasQr(){
    try{if(window.__taxAiQr152)return true}catch{}
    try{if(typeof state!=='undefined'&&Array.isArray(state.qr)&&state.qr.length)return true}catch{}
    return false;
  }
  function quality(){const n=Number($('qualityScore')?.textContent);return Number.isFinite(n)?n:0}
  function incomplete(){
    const req=['date','track','number','seller','net','tax','gross'];
    return req.some(id=>!String($(id)?.value||'').trim());
  }
  function isHandLike(){
    const t=String($('invoiceType')?.value||'auto');
    if(t==='hand')return true;
    if(t==='electronic')return false;
    return !hasQr();
  }
  function show(text,cls='info'){
    const s=$('status');if(s){s.className=cls;s.textContent=text}
    let p=$('v157HandGemmaStatus');
    if(!p){p=document.createElement('div');p.id='v157HandGemmaStatus';p.className='info';p.style.marginTop='10px';const sum=$('scanSummary');if(sum)sum.insertAdjacentElement('afterend',p)}
    if(p){p.className=cls;p.textContent=text}
  }
  function buyerShow(text,cls='info'){
    let p=$('v157BuyerGemmaStatus');
    if(!p){p=document.createElement('div');p.id='v157BuyerGemmaStatus';p.className='info';p.style.marginTop='10px';const gf=$('gridFirstV0374');if(gf)gf.appendChild(p);else $('v157HandGemmaStatus')?.insertAdjacentElement('afterend',p)}
    if(p){p.className=cls;p.textContent=text}
  }
  function buyerNeedsGemma(){
    if(!isHandLike())return false;
    const el=$('buyer');if(!el||el.dataset.humanEdited==='1')return false;
    const b=digits(el.value),company=digits($('companyBan')?.value),src=String($('sBuyer')?.textContent||el.dataset.aiSource||'');
    if(!validBan(b))return true;
    if(company&&b!==company&&/待|OCR|未辨識|候選|格線|V0\.37/i.test(src))return true;
    return quality()<90&&!/QR|Gemma 8格|人工確認/i.test(src);
  }
  function publishBuyer(ban,confidence){
    const el=$('buyer');if(!el||el.dataset.humanEdited==='1'||!validBan(ban))return false;
    const conf=Math.max(0,Math.min(100,Math.round((Number(confidence)||0)*100)));
    el.value=ban;el.dataset.aiSource='Gemma 4 E4B：買受人 8 格自動辨識';el.dataset.gemmaBuyerConfidence=String(conf);
    try{if(typeof addCandidate==='function')addCandidate('buyer',ban,'Gemma 4 E4B：買受人 8 格自動辨識',520)}catch{}
    try{if(typeof setSource==='function')setSource('buyer',`Gemma 4 E4B：買受人 8 格 ${conf}%`)}catch{}
    try{el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}catch{}
    try{if(typeof validateRecognition==='function')validateRecognition()}catch{}
    try{if(typeof renderSourceDetail==='function')renderSourceDetail()}catch{}
    try{window.__taxAiConfidenceScore154Api?.render?.()}catch{}
    const company=digits($('companyBan')?.value),match=company&&company===ban;
    buyerShow(`${conf>=85?'✓':'⚠'} Gemma 4 E4B 買受人 8 格辨識：${ban}｜信心 ${conf}%${match?'｜與申報單位統編一致 → 進項證據成立':'｜請人工核對'}`,conf>=85&&(!company||match)?'ok':'warn');
    return true;
  }
  async function runBuyerGemmaIfNeeded({force=false}={}){
    if(!isHandLike())return {ran:false,reason:'not-hand'};
    const buyer=$('buyer');if(buyer?.dataset.humanEdited==='1')return {ran:false,reason:'human-edited'};
    if(!force&&!buyerNeedsGemma())return {ran:false,reason:'buyer-sufficient'};

    // Grid-first runs earlier in the scan chain. Give it a short grace period.
    for(let i=0;i<8&&document.querySelectorAll('#gfCells canvas').length!==8;i++)await sleep(120);
    const cells=[...document.querySelectorAll('#gfCells canvas')];
    if(cells.length!==8){buyerShow('⚠ 尚未取得完整 8 格買受人統編裁切，Gemma 8 格辨識暫不執行。','warn');return {ran:false,reason:'no-8-cells',cells:cells.length}}

    const btn=$('hfBuyer');
    if(!btn||typeof btn.onclick!=='function'){buyerShow('⚠ Gemma 買受人 8 格 API 尚未載入。','warn');return {ran:false,reason:'api-unavailable'}}
    if(btn.disabled){try{await window.__taxAiCore152Api?.verifyBackend?.()}catch{}}
    if(btn.disabled){buyerShow('⚠ Gemma 4 E4B Backend 尚未驗證，保留本地 8 格結果。','warn');return {ran:false,reason:'backend-locked'}}

    buyerShow('🎯 正在自動啟用 Gemma 4 E4B 專看買受人 8 格…','info');
    let result=null;
    try{result=await btn.onclick.call(btn)}catch(e){buyerShow('⚠ Gemma 8 格辨識失敗：'+(e.message||e),'warn');return {ran:true,ok:false,error:String(e)}}
    const ban=digits(result?.buyer_tax_id),confidence=Number(result?.confidence)||0;
    if(validBan(ban)){
      publishBuyer(ban,confidence);
      return {ran:true,ok:true,buyer_tax_id:ban,confidence,result};
    }
    buyerShow('⚠ Gemma 4 E4B 未能從完整 8 格取得可靠買受人統編；保留本地結果並請人工核對。','warn');
    return {ran:true,ok:false,result};
  }
  async function runIfNeeded(){
    const api=window.__taxAiCore152Api;
    if(!api?.runInvoiceGemma)return {ran:false,reason:'api-unavailable'};
    const hand=isHandLike(),q=quality(),needWhole=hand&&(incomplete()||q<90);
    let whole=null;
    if(needWhole){
      show('🤖 手開／無 QR 發票：自動啟用 Gemma 4 E4B 整張交叉辨識…','info');
      whole=await api.runInvoiceGemma();
      if(!whole)show('⚠ Gemma 4 E4B 整張辨識未取得結果；繼續嘗試買受人 8 格專用辨識。','warn');
    }

    // Buyer 8-cell Gemma is a separate, mandatory fallback for handwritten invoices.
    const buyerResult=await runBuyerGemmaIfNeeded();
    try{await window.__taxAiAutoTax152Api?.autoTaxCategory?.()}catch{}
    try{window.__taxAiConfidenceScore154Api?.render?.()}catch{}
    try{if(typeof validateRecognition==='function')validateRecognition()}catch{}
    try{if(typeof renderSourceDetail==='function')renderSourceDetail()}catch{}
    const q2=quality();
    if(whole||buyerResult?.ok){show(`✓ Gemma 4 E4B 已完成手寫發票交叉辨識${buyerResult?.ok?`；買受人 ${buyerResult.buyer_tax_id}`:''}；最新綜合信心 ${q2}/100。請核對後再入帳。`,q2>=70?'ok':'warn')}
    return {ran:!!whole||!!buyerResult?.ran,ok:!!whole||!!buyerResult?.ok,quality:q2,whole,buyer:buyerResult};
  }
  function patch(){
    const scan=$('scan');if(!scan||scan.dataset.handGemmaAuto157==='1')return;
    const old=scan.onclick;scan.dataset.handGemmaAuto157='1';
    scan.onclick=async function(...args){
      const r=typeof old==='function'?await old.apply(this,args):undefined;
      await sleep(180);
      await runIfNeeded();
      return r;
    };
  }
  patch();setTimeout(patch,100);setTimeout(patch,700);setInterval(patch,1500);
  window.__taxAiHandGemmaAuto157Api={BUILD,runIfNeeded,runBuyerGemmaIfNeeded,buyerNeedsGemma,isHandLike,hasQr,incomplete,quality,validBan};
  console.info('[TaxAI] V1.5.7 handwritten Gemma + buyer 8-cell auto-run active',BUILD);
})();