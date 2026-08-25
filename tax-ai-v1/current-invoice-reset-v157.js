(function(){
  if(window.__taxAiCurrentInvoiceReset157)return;
  window.__taxAiCurrentInvoiceReset157=true;
  const $=id=>document.getElementById(id);
  const BUILD='20260826-v157-clear-before-scan-r4';
  const FIELD_IDS=['date','track','number','seller','buyer','net','tax','gross','sellerName','sellerAddress','sellerPhone','raw','stampRaw'];
  const SOURCE_IDS=['sDate','sTrack','sNumber','sSeller','sBuyer','sNet','sTax','sGross','sTaxCategory'];
  const DATA_KEYS=['humanEdited','qrAuthority','aiSource','autoDerived','lastAiTaxCategory','lastAiTaxCategoryAt','v154Confidence','v154Evidence'];

  function clearField(id){
    const el=$(id);if(!el)return;
    if('value' in el)el.value='';
    for(const k of DATA_KEYS)delete el.dataset[k];
  }
  function setText(id,text,cls){const el=$(id);if(!el)return;el.textContent=text;if(cls)el.className=cls}
  function clearImage(id,{hide=false}={}){const el=$(id);if(!el)return;el.removeAttribute('src');if(hide)el.style.display='none'}

  function resetCoreState(){
    try{
      if(typeof state!=='undefined'&&state){
        // Keep state.file, state.mode and state.items: the newly selected image and
        // already-confirmed period ledger must survive. Only recognition evidence resets.
        state.sources={};state.candidates={};state.qr=[];state.barcodes=[];state.ocrTexts=[];
        state.qrBuyerAbsent=false;state.ocrConfidence=0;
      }
    }catch{}
    try{window.__taxAiQr152=null}catch{}
    try{window.__taxAiV154Decision=null}catch{}
    try{window.__taxAiCompositeConfidence154=null}catch{}
    try{window.__taxAiCurrentInvoiceResetAt=Date.now()}catch{}
  }

  function resetCurrentInvoice(){
    resetCoreState();
    FIELD_IDS.forEach(clearField);
    SOURCE_IDS.forEach(id=>setText(id,'—'));

    const direction=$('direction');if(direction){direction.value='unknown';direction.disabled=true;for(const k of DATA_KEYS)delete direction.dataset[k]}
    const ded=$('ded');if(ded){ded.value='review';for(const k of DATA_KEYS)delete ded.dataset[k]}
    const taxCategory=$('taxCategory');if(taxCategory){taxCategory.value='待確認';for(const k of DATA_KEYS)delete taxCategory.dataset[k]}

    setText('qualityScore','0');
    setText('ocrConfidence','OCR 尚未執行');
    setText('checks','');
    setText('filingDecision','尚未判斷。','warn');
    setText('conflicts','⚠ 新發票尚未辨識。','warn');
    setText('sourceDetail','');
    setText('scanSummary','正在辨識新發票；上一張辨識結果已清除。','info');
    setText('status','正在辨識新發票…','muted');

    setText('stampStatus','尚未執行本張發票章 OCR。','info');
    clearImage('stampPreview');
    clearImage('taxCategoryRoiPreview',{hide:true});
    const evidence=$('taxCategoryEvidence');if(evidence)evidence.className='info';
    setText('taxCategoryEvidenceBody','等待本張發票課稅別辨識。');

    const qrPanel=$('qrAuthority152');if(qrPanel)qrPanel.className='info';
    setText('qrAuthority152Body','等待本張電子發票 QR。');

    const decision=$('v154Decision');if(decision)decision.className='info';
    setText('v154DecisionBody','等待本張發票辨識。');
    const scoreBreakdown=$('v154ScoreBreakdown');if(scoreBreakdown){scoreBreakdown.className='info';scoreBreakdown.textContent='等待本張發票完成辨識後重新計算綜合信心。'}

    for(const id of ['autoTaxQualityCheck','v154TaxDecisionCheck','v154AmountDecisionCheck'])$(id)?.remove();

    // Media-filing history and 401 period totals intentionally remain untouched.
    try{window.__taxAiMedia156Api?.renderAll?.()}catch{}
    return true;
  }

  function bind(){
    const scan=$('scan');if(!scan||scan.dataset.clearCurrent157==='1')return;
    scan.dataset.clearCurrent157='1';
    // Capture phase guarantees reset happens before the legacy scan onclick chain.
    scan.addEventListener('click',()=>resetCurrentInvoice(),{capture:true});
  }
  function patch(){bind()}
  patch();setTimeout(patch,100);setTimeout(patch,700);setInterval(patch,1500);
  window.__taxAiCurrentInvoiceReset157Api={BUILD,resetCurrentInvoice,bind};
  console.info('[TaxAI] V1.5.7 clear-before-scan active',BUILD);
})();