(function(){
  if(window.__taxAiPolicy154)return;
  window.__taxAiPolicy154=true;

  const VERSION='1.5.4';
  const BUILD='20260824-v154-confidence-policy';
  const CONCRETE=['應稅','零稅率','免稅'];
  const $=id=>document.getElementById(id);
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

  function money(id){
    const s=String($(id)?.value??'').replace(/[,，\s元$NTnt]/g,'');
    if(s==='')return NaN;
    const n=Number(s);return Number.isFinite(n)?n:NaN;
  }
  function humanEdited(id){return $(id)?.dataset?.humanEdited==='1'}
  function publishCandidate(id,value,source,score=145){
    try{if(typeof state!=='undefined'&&state?.candidates)state.candidates[id]=[{value:String(value),source,score}]}catch{}
    try{if(typeof setSource==='function')setSource(id,source)}catch{}
  }
  function writeAi(id,value,source,{force=false}={}){
    const el=$(id);if(!el||value===null||value===undefined||!Number.isFinite(Number(value)))return false;
    if(!force&&humanEdited(id)&&String(el.value||'').trim()!=='')return false;
    const v=String(Math.round(Number(value)));if(el.value!==v)el.value=v;
    el.dataset.aiSource=source;el.dataset.autoDerived='1';publishCandidate(id,v,source);
    try{el.dispatchEvent(new Event('input',{bubbles:true}))}catch{}
    try{el.dispatchEvent(new Event('change',{bubbles:true}))}catch{}
    return true;
  }
  function coherent(){
    const net=money('net'),tax=money('tax'),gross=money('gross');
    return Number.isFinite(net)&&Number.isFinite(tax)&&Number.isFinite(gross)&&gross>0&&Math.round(net+tax)===Math.round(gross);
  }
  function deriveAmounts(cat){
    let net=money('net'),tax=money('tax'),gross=money('gross');
    const source=cat==='應稅'?'V1.5.4 應稅 5% 自動計算':'V1.5.4 非應稅自動計算';
    const changes=[];
    if(cat==='應稅'){
      if(Number.isFinite(gross)&&gross>0){
        const calcTax=Math.round(gross-(gross/1.05)),calcNet=Math.round(gross-calcTax);
        if(!humanEdited('net')&&(!Number.isFinite(net)||Math.round(net)!==calcNet)){writeAi('net',calcNet,source);changes.push('net');net=calcNet}
        if(!humanEdited('tax')&&(!Number.isFinite(tax)||Math.round(tax)!==calcTax)){writeAi('tax',calcTax,source);changes.push('tax');tax=calcTax}
      }else if(Number.isFinite(net)&&net>=0){
        const calcTax=Math.round(net*.05),calcGross=Math.round(net+calcTax);
        if(!humanEdited('tax')&&(!Number.isFinite(tax)||Math.round(tax)!==calcTax)){writeAi('tax',calcTax,source);changes.push('tax');tax=calcTax}
        if(!humanEdited('gross')&&(!Number.isFinite(gross)||Math.round(gross)!==calcGross)){writeAi('gross',calcGross,source);changes.push('gross');gross=calcGross}
      }else if(Number.isFinite(gross)&&Number.isFinite(tax)&&gross>=tax){
        const calcNet=Math.round(gross-tax);
        if(!humanEdited('net')&&(!Number.isFinite(net)||Math.round(net)!==calcNet)){writeAi('net',calcNet,source);changes.push('net');net=calcNet}
      }
    }else if(cat==='零稅率'||cat==='免稅'){
      if(!humanEdited('tax')&&(!Number.isFinite(tax)||Math.round(tax)!==0)){writeAi('tax',0,source);changes.push('tax');tax=0}
      if(Number.isFinite(gross)&&gross>=0&&!Number.isFinite(net)&&!humanEdited('net')){writeAi('net',gross,source);changes.push('net');net=gross}
      if(Number.isFinite(net)&&net>=0&&!Number.isFinite(gross)&&!humanEdited('gross')){writeAi('gross',net,source);changes.push('gross');gross=net}
    }
    try{if(typeof validateRecognition==='function')validateRecognition()}catch{}
    try{if(typeof renderSourceDetail==='function')renderSourceDetail()}catch{}
    return {net:money('net'),tax:money('tax'),gross:money('gross'),coherent:coherent(),changes,source};
  }
  function parseConfidenceText(){
    const txt=String($('taxCategoryEvidenceBody')?.textContent||'');
    const m=txt.match(/confidence\s*(\d{1,3})%/i)||txt.match(/信心(?:度)?\s*(\d{1,3})%/);
    return m?Math.max(0,Math.min(100,Number(m[1]))):NaN;
  }
  function confidenceBand(conf){
    if(!Number.isFinite(conf))return {key:'unknown',cls:'warn',label:'信心度未取得',action:'已先寫入；請人工核對'};
    if(conf>=90)return {key:'high',cls:'ok',label:'高信心',action:'已自動採用；使用者仍可修改'};
    if(conf>=70)return {key:'medium',cls:'warn',label:'中等信心',action:'已先寫入；建議人工核對'};
    return {key:'low',cls:'warn',label:'低信心',action:'已先寫入；需要人工核對'};
  }
  function ensureDecisionPanel(){
    let p=$('v154Decision');if(p)return p;
    p=document.createElement('div');p.id='v154Decision';p.className='info';p.style.marginTop='10px';
    p.innerHTML='<b>🧠 V1.5.4 自動判斷</b><div id="v154DecisionBody" style="margin-top:6px">等待辨識。</div>';
    const evidence=$('taxCategoryEvidence');if(evidence)evidence.insertAdjacentElement('afterend',p);else $('conflicts')?.insertAdjacentElement('afterend',p);
    return p;
  }
  function updateChecklist(cat,conf,band,amounts){
    const checks=$('checks');if(!checks)return;
    let row=$('v154TaxDecisionCheck');if(!row){row=document.createElement('div');row.id='v154TaxDecisionCheck';row.className='check';checks.prepend(row)}
    const confText=Number.isFinite(conf)?`${Math.round(conf)}%`:'未取得',status=band.key==='high'?'PASS':'REVIEW',icon=band.key==='high'?'✅':'⚠️';
    row.innerHTML=`<span>${icon} 課稅別：${cat}｜信心度 ${confText}｜${band.action}</span><b>${status}</b>`;
    let amountRow=$('v154AmountDecisionCheck');if(!amountRow){amountRow=document.createElement('div');amountRow.id='v154AmountDecisionCheck';amountRow.className='check';checks.prepend(amountRow)}
    amountRow.innerHTML=amounts?.coherent?`<span>✅ 金額自動驗證：${Math.round(amounts.net)}＋${Math.round(amounts.tax)}＝${Math.round(amounts.gross)}</span><b>PASS</b>`:'<span>⚠️ 金額仍需核對</span><b>REVIEW</b>';
  }
  function annotate(cat,conf,source,evidence,amounts,{human=false}={}){
    const p=ensureDecisionPanel(),body=$('v154DecisionBody');
    const band=human?{key:'human',cls:'ok',label:'人工確認',action:'以使用者修改值為準'}:confidenceBand(conf);
    if(p)p.className=band.cls;
    const confText=Number.isFinite(conf)?`${Math.round(conf)}%`:'未取得',amountText=amounts?.coherent?`；未稅 ${Math.round(amounts.net)}／稅額 ${Math.round(amounts.tax)}／含稅 ${Math.round(amounts.gross)}`:'';
    if(body)body.textContent=`${human?'✓':'AI'} 課稅別：${cat}｜${band.label} ${confText}｜${band.action}${amountText}${evidence?`｜${evidence}`:''}`;
    updateChecklist(cat,conf,band,amounts);
    window.__taxAiV154Decision={version:VERSION,category:cat,confidence:Number.isFinite(conf)?conf:null,band:band.key,source,evidence,amounts,human,at:new Date().toISOString()};
  }
  function setCategory(cat,source,conf,evidence){
    if(!CONCRETE.includes(cat))return false;
    const sel=$('taxCategory');if(!sel)return false;
    if(humanEdited('taxCategory')&&sel.value!==cat)return false;
    sel.value=cat;sel.dataset.aiSource=source;sel.dataset.v154Confidence=Number.isFinite(conf)?String(conf):'';sel.dataset.v154Evidence=evidence||'';
    try{sel.dispatchEvent(new Event('input',{bubbles:true}));sel.dispatchEvent(new Event('change',{bubbles:true}))}catch{}
    return true;
  }
  function inferFromCurrent(){
    const sel=$('taxCategory'),cat=sel?.value||'';
    if(CONCRETE.includes(cat)){
      let conf=Number(sel.dataset.v154Confidence);if(!Number.isFinite(conf)||conf<=0)conf=parseConfidenceText();
      if(!Number.isFinite(conf)){const src=String(sel.dataset.aiSource||'');conf=/幾何|Gemma|ROI|票面/.test(src)?88:75}
      return {category:cat,confidence:conf,source:String(sel.dataset.aiSource||'既有自動判讀'),evidence:String(sel.dataset.v154Evidence||$('taxCategoryEvidenceBody')?.textContent||'')};
    }
    const net=money('net'),tax=money('tax'),gross=money('gross');
    if(Number.isFinite(tax)&&tax>0&&Number.isFinite(net)&&Number.isFinite(gross)&&Math.round(net+tax)===Math.round(gross))return {category:'應稅',confidence:86,source:'金額結構交叉判定',evidence:`${Math.round(net)}＋${Math.round(tax)}＝${Math.round(gross)}，且稅額 > 0`};
    return null;
  }
  async function finalise(){
    const manualCat=$('taxCategory')?.value||'';
    if(humanEdited('taxCategory')&&CONCRETE.includes(manualCat)){
      const amounts=deriveAmounts(manualCat);annotate(manualCat,100,'人工修改','使用者手動修改課稅別',amounts,{human:true});
      return {category:manualCat,confidence:100,source:'人工修改',amounts,human:true};
    }
    let decision=null;
    try{const r=await window.__taxAiTaxVisionFallback152Api?.rescue?.();if(CONCRETE.includes(r?.category))decision={category:r.category,confidence:(Number(r.confidence)||0)*100,source:'本地票面 V 幾何辨識',evidence:r.evidence||''}}catch{}
    if(!decision){try{await window.__taxAiAutoTax152Api?.autoTaxCategory?.()}catch{}decision=inferFromCurrent()}
    if(!decision){const p=ensureDecisionPanel(),body=$('v154DecisionBody');if(p)p.className='warn';if(body)body.textContent='⚠ 尚未取得可寫入的課稅別，請人工確認。';return null}
    setCategory(decision.category,decision.source,decision.confidence,decision.evidence);
    const amounts=deriveAmounts(decision.category);annotate(decision.category,decision.confidence,decision.source,decision.evidence,amounts);
    try{window.__taxAiAutoTax152Api?.refreshRecognitionState?.({cat:decision.category,confidence:decision.confidence,source:decision.source,evidence:decision.evidence})}catch{}
    return {...decision,amounts};
  }
  function bindManualOverride(){
    const sel=$('taxCategory');if(sel&&!sel.dataset.v154ManualBound){sel.dataset.v154ManualBound='1';sel.addEventListener('change',e=>{if(!e.isTrusted)return;sel.dataset.humanEdited='1';const cat=sel.value;if(!CONCRETE.includes(cat))return;const amounts=deriveAmounts(cat);annotate(cat,100,'人工修改','使用者手動修改課稅別',amounts,{human:true})})}
    for(const id of ['net','tax','gross']){const el=$(id);if(el&&!el.dataset.v154ManualBound){el.dataset.v154ManualBound='1';el.addEventListener('input',e=>{if(e.isTrusted)el.dataset.humanEdited='1'})}}
  }
  function resetForNewInvoice(){
    for(const id of ['taxCategory','net','tax','gross']){const el=$(id);if(!el)continue;delete el.dataset.humanEdited;delete el.dataset.v154Confidence;delete el.dataset.v154Evidence;delete el.dataset.autoDerived}
    const p=$('v154Decision');if(p)p.className='info';const b=$('v154DecisionBody');if(b)b.textContent='等待新發票辨識。';
  }
  function bindNewInvoiceReset(){for(const id of ['camera','purchase','sales']){const el=$(id);if(el&&!el.dataset.v154ResetBound){el.dataset.v154ResetBound='1';el.addEventListener('change',resetForNewInvoice)}}}
  function patchScan(){
    const scan=$('scan');if(!scan||scan.dataset.v154PolicyBound==='1')return;
    const old=scan.onclick;scan.dataset.v154PolicyBound='1';scan.textContent='✨ V1.5.4：自動辨識＋課稅別＋自動算稅';
    scan.onclick=async function(...args){const r=typeof old==='function'?await old.apply(this,args):undefined;await sleep(120);await finalise();return r};
  }
  function applyVersionUi(){
    document.title='AI 超簡易營業稅申報 V1.5.4';
    const subtitle=document.querySelector('.top .muted');if(subtitle)subtitle.textContent='V1.5.4｜AI 先判斷課稅別、先寫入並自動算稅；低信心結果標示人工核對';
    const hero=document.querySelector('.hero');if(hero)hero.innerHTML='<b>V1.5.4：</b>AI 會先自動判斷「應稅／零稅率／免稅」，先填入課稅別並依規則自動計算未稅、稅額與含稅總額；高信心直接採用，中低信心仍先寫入但明確標示「建議／需要人工核對」。使用者可隨時手動修改，人工修改優先。';
    const card=$('hfZeroGpuCard');if(card){const h=card.querySelector('h2');if(h)h.textContent='☁️ V1.5.4 前端｜Hugging Face ZeroGPU V1.5.2 Backend'}
    const release=$('releaseContract152Body');if(release&&!/Frontend V1\.5\.4/.test(release.innerHTML))release.insertAdjacentHTML('beforeend','<br><b>Frontend V1.5.4 policy layer active</b>');
  }
  function patch(){ensureDecisionPanel();bindManualOverride();bindNewInvoiceReset();patchScan();applyVersionUi()}
  patch();setTimeout(patch,100);setTimeout(patch,700);setTimeout(patch,1600);
  window.__taxAiPolicy154Api={VERSION,BUILD,finalise,deriveAmounts,confidenceBand,annotate,resetForNewInvoice};
  console.info('[TaxAI] V1.5.4 confidence-first auto tax policy active',BUILD);
})();
