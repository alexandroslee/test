(function(){
  if(window.__taxAiHandGemmaAuto157)return;
  window.__taxAiHandGemmaAuto157=true;
  const $=id=>document.getElementById(id);
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const BUILD='20260826-v157-hand-gemma-auto-r5';

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
  async function runIfNeeded(){
    const api=window.__taxAiCore152Api;
    if(!api?.runInvoiceGemma)return {ran:false,reason:'api-unavailable'};
    const hand=isHandLike(),q=quality(),need=hand&&(incomplete()||q<90);
    if(!need)return {ran:false,reason:hand?'local-sufficient':'electronic-or-qr',quality:q};

    show('🤖 手開／無 QR 發票：自動啟用 Gemma 4 E4B 整張交叉辨識…','info');
    const result=await api.runInvoiceGemma();
    if(result){
      try{await window.__taxAiAutoTax152Api?.autoTaxCategory?.()}catch{}
      try{window.__taxAiConfidenceScore154Api?.render?.()}catch{}
      try{if(typeof validateRecognition==='function')validateRecognition()}catch{}
      try{if(typeof renderSourceDetail==='function')renderSourceDetail()}catch{}
      const q2=quality();
      show(`✓ Gemma 4 E4B 已自動完成手寫發票交叉辨識；最新綜合信心 ${q2}/100。請核對後再入帳。`,q2>=70?'ok':'warn');
      return {ran:true,ok:true,quality:q2,result};
    }
    show('⚠ Gemma 4 E4B 自動交叉辨識未取得結果；已保留本地 OCR 結果，請人工核對。','warn');
    return {ran:true,ok:false,quality:quality()};
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
  window.__taxAiHandGemmaAuto157Api={BUILD,runIfNeeded,isHandLike,hasQr,incomplete,quality};
  console.info('[TaxAI] V1.5.7 handwritten Gemma auto-run active',BUILD);
})();