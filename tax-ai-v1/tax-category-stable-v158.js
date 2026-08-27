(function(){
  if(window.__taxAiTaxStable158)return;
  window.__taxAiTaxStable158=true;
  const BUILD='20260828-v158-local-tax-r1';
  const CATS=['應稅','零稅率','免稅'];
  const $=id=>document.getElementById(id);
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const money=id=>{const s=String($(id)?.value||'').replace(/[,，\s元$NTnt]/g,'');const n=Number(s);return Number.isFinite(n)?n:NaN};

  function writeAmount(id,v,source){
    const e=$(id);if(!e||!Number.isFinite(v))return false;
    if(e.dataset.humanEdited==='1'&&String(e.value||'').trim())return false;
    e.value=String(Math.round(v));e.dataset.aiSource=source;e.dataset.autoDerived='1';
    try{if(typeof state!=='undefined'&&state?.candidates)state.candidates[id]=[{value:e.value,source,score:180}]}catch{}
    try{if(typeof setSource==='function')setSource(id,source)}catch{}
    try{e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))}catch{}
    return true;
  }
  function derive(cat){
    let net=money('net'),tax=money('tax'),gross=money('gross');
    if(cat==='應稅'){
      if(Number.isFinite(gross)&&gross>0){const t=Math.round(gross-gross/1.05),n=Math.round(gross-t);if(!Number.isFinite(net)||Math.round(net+tax)!==Math.round(gross))writeAmount('net',n,'V1.5.8 應稅 5% 反推');if(!Number.isFinite(tax)||Math.round(net+tax)!==Math.round(gross))writeAmount('tax',t,'V1.5.8 應稅 5% 反推')}
      else if(Number.isFinite(net)&&net>=0){const t=Math.round(net*.05);writeAmount('tax',t,'V1.5.8 應稅 5% 計算');writeAmount('gross',net+t,'V1.5.8 應稅 5% 計算')}
    }else if(cat==='零稅率'||cat==='免稅'){
      writeAmount('tax',0,'V1.5.8 非應稅稅額');
      if(Number.isFinite(gross)&&gross>=0)writeAmount('net',gross,'V1.5.8 非應稅金額');
      else if(Number.isFinite(net)&&net>=0)writeAmount('gross',net,'V1.5.8 非應稅金額');
    }
  }
  function setCategory(cat,source,evidence='',confidence=95){
    if(!CATS.includes(cat))return false;const s=$('taxCategory');if(!s)return false;
    if(s.dataset.humanEdited==='1'&&s.value!==cat)return false;
    s.value=cat;s.dataset.aiSource=source;s.dataset.v154Confidence=String(confidence);s.dataset.v158Confidence=String(confidence);
    derive(cat);
    const p=$('taxCategoryEvidence'),b=$('taxCategoryEvidenceBody'),src=$('sTaxCategory');
    if(p)p.className=confidence>=90?'ok':'info';if(b)b.textContent=`✓ V1.5.8 本地課稅別：${cat}｜${evidence||'票面／金額結構'}｜confidence ${Math.round(confidence)}%`;if(src)src.textContent=source;
    try{s.dispatchEvent(new Event('input',{bubbles:true}));s.dispatchEvent(new Event('change',{bubbles:true}))}catch{}
    try{if(typeof validateRecognition==='function')validateRecognition()}catch{}
    try{if(typeof renderSourceDetail==='function')renderSourceDetail()}catch{}
    try{window.__taxAiConfidenceScore154Api?.render?.()}catch{}
    return true;
  }
  async function runLocalTax(){
    const api=window.__taxAiCore152Api;if(!api)return null;
    const current=$('taxCategory')?.value||'';if(CATS.includes(current))return {category:current,source:'existing'};
    try{const structural=api.structuralTaxCategory?.();if(CATS.includes(structural)){setCategory(structural,'V1.5.8 金額結構','稅額／總額結構確認',100);return {category:structural,source:'structural'}}}catch{}
    try{const local=await api.localTaxCategory?.();if(CATS.includes(local?.cat)){setCategory(local.cat,'V1.5.8 本地票面 V',String(local.text||'').trim().slice(0,120),95);return {category:local.cat,source:'local-roi',local}}}catch{}
    const p=$('taxCategoryEvidence'),b=$('taxCategoryEvidenceBody');if(p)p.className='warn';if(b)b.textContent='⚠ V1.5.8 本地課稅別尚未確定；主流程不等待 Gemma。需要時可按「Gemma 課稅別補驗（選用）」。';
    return {category:'待確認',source:'unresolved'};
  }
  function patchScan(){
    const scan=$('scan');if(!scan||scan.dataset.v158TaxBound==='1')return;
    scan.dataset.v158TaxBound='1';const old=scan.onclick;
    scan.onclick=async function(...args){const r=typeof old==='function'?await old.apply(this,args):undefined;await sleep(80);await runLocalTax();try{window.__taxAiConfidenceScore154Api?.render?.()}catch{}return r};
  }
  function patch(){patchScan()}
  patch();setTimeout(patch,100);setTimeout(patch,700);
  window.__taxAiTaxStable158Api={BUILD,runLocalTax,setCategory,derive};
  console.info('[TaxAI] V1.5.8 local-first tax category active',BUILD);
})();