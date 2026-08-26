(function(){
  if(window.__taxAiGemmaReconcile157)return;
  window.__taxAiGemmaReconcile157=true;
  const $=id=>document.getElementById(id);
  const BUILD='20260826-v157-gemma-reconcile-r7';
  const digits=v=>String(v??'').replace(/\D/g,'');
  const num=v=>{const n=Number(String(v??'').replace(/[,，\s$NTnt元]/g,''));return Number.isFinite(n)?n:NaN};
  const snap=()=>({buyer:$('buyer')?.value||'',net:$('net')?.value||'',tax:$('tax')?.value||'',gross:$('gross')?.value||'',sBuyer:$('sBuyer')?.textContent||'—',sNet:$('sNet')?.textContent||'—',sTax:$('sTax')?.textContent||'—',sGross:$('sGross')?.textContent||'—'});
  function restoreField(id,value,source){const el=$(id);if(!el)return;el.value=value||'';try{if(typeof setSource==='function')setSource(id,source||'—')}catch{}}
  function filterCandidate(id,pred){try{if(typeof state!=='undefined'&&state?.candidates?.[id])state.candidates[id]=state.candidates[id].filter(x=>!pred(x))}catch{}}
  function handLike(d){const t=String($('invoiceType')?.value||'auto');return t==='hand'||/三聯|二聯|手開/.test(String(d?.invoice_type||''))||(t==='auto'&&!window.__taxAiQr152)}
  function amountSanity(d){
    const sales=num(d?.sales_amount),tax=num(d?.tax_amount),total=num(d?.total_amount),cat=String(d?.tax_category||$('taxCategory')?.value||'');
    if(!Number.isFinite(sales)||!Number.isFinite(tax)||!Number.isFinite(total)||sales<0||tax<0||total<=0)return {ok:false,reason:'金額欄位不完整'};
    if(Math.round(sales+tax)!==Math.round(total))return {ok:false,reason:`${sales}+${tax}≠${total}`};
    if(cat==='應稅'){
      const expected=Math.round(sales*.05),tol=Math.max(2,Math.round(sales*.002));
      if(Math.abs(tax-expected)>tol)return {ok:false,reason:`應稅 5% 不合理：sales=${sales}, tax=${tax}, expected≈${expected}`};
    }
    if((cat==='零稅率'||cat==='免稅')&&tax!==0)return {ok:false,reason:`${cat} 稅額應為 0，但為 ${tax}`};
    return {ok:true,sales,tax,total};
  }
  function ensurePanel(){
    let p=$('v157GemmaReconcile');
    if(!p){p=document.createElement('div');p.id='v157GemmaReconcile';p.className='info';p.style.marginTop='10px';const s=$('v157HandGemmaStatus')||$('scanSummary');if(s)s.insertAdjacentElement('afterend',p)}
    return p;
  }
  function show(text,cls='info'){const p=ensurePanel();if(p){p.className=cls;p.textContent=text}}
  function applyGuard(resp,before){
    const first=resp?.results?.[0],d=first?.data||{};const issues=[];const isHand=handLike(d);
    const seller=digits(d.seller_tax_id),buyer=digits(d.buyer_tax_id);
    if(isHand&&seller&&buyer&&seller===buyer){
      restoreField('buyer',before.buyer,before.sBuyer);
      filterCandidate('buyer',x=>/HF-ZeroGPU|Gemma4E4B|Gemma 整張/i.test(String(x?.source||''))&&digits(x?.value)===seller);
      issues.push(`整張 Gemma 把賣方章統編 ${seller} 同時當成買方，已拒絕該買方值`);
    }
    const a=amountSanity(d);
    if(isHand&&!a.ok){
      restoreField('net',before.net,before.sNet);restoreField('tax',before.tax,before.sTax);restoreField('gross',before.gross,before.sGross);
      for(const id of ['net','tax','gross'])filterCandidate(id,x=>/HF-ZeroGPU|Gemma4E4B|Gemma 整張/i.test(String(x?.source||'')));
      issues.push(`整張 Gemma 金額未通過稅務結構檢核（${a.reason}），已保留原辨識值`);
    }
    try{if(typeof validateRecognition==='function')validateRecognition()}catch{}
    try{if(typeof renderSourceDetail==='function')renderSourceDetail()}catch{}
    try{window.__taxAiConfidenceScore154Api?.render?.()}catch{}
    if(issues.length)show('⚠ Gemma 對賬保護：'+issues.join('；')+'。接續使用專區辨識／8格 Gemma。','warn');
    else show('✓ Gemma 整張結果通過角色與金額結構對賬。','ok');
    window.__taxAiGemmaReconcile157Last={issues,data:d,at:new Date().toISOString()};
    return {issues,data:d,amount:a};
  }
  function patch(){
    const api=window.__taxAiCore152Api;if(!api||api.__reconcile157)return;
    const old=api.runInvoiceGemma;if(typeof old!=='function')return;
    api.__reconcile157=true;
    api.runInvoiceGemma=async function(...args){const before=snap();const r=await old.apply(this,args);if(r)applyGuard(r,before);return r};
  }
  patch();setTimeout(patch,100);setTimeout(patch,700);setInterval(patch,1500);
  window.__taxAiGemmaReconcile157Api={BUILD,applyGuard,amountSanity,handLike,patch};
  console.info('[TaxAI] V1.5.7 Gemma reconcile guard active',BUILD);
})();
