(function(){
  if(window.__taxAiTaxVisionFallback152)return;
  window.__taxAiTaxVisionFallback152=true;
  const $=id=>document.getElementById(id);
  const CATS=['應稅','零稅率','免稅'];

  function canvasFromImage(img){
    if(!img||!img.complete)return null;
    const W=img.naturalWidth||img.width,H=img.naturalHeight||img.height;
    if(W<80||H<60)return null;
    const c=document.createElement('canvas');c.width=W;c.height=H;
    c.getContext('2d',{willReadFrequently:true}).drawImage(img,0,0,W,H);return c;
  }

  function cropTaxRoiFromPreview(){
    const img=$('preview');if(!img?.complete)return null;
    const W=img.naturalWidth||img.width,H=img.naturalHeight||img.height;if(W<100||H<100)return null;
    const sx=Math.round(W*.30),sy=Math.round(H*.46),sw=Math.round(W*.40),sh=Math.round(H*.25);
    const c=document.createElement('canvas');c.width=Math.max(1,sw);c.height=Math.max(1,sh);
    c.getContext('2d',{willReadFrequently:true}).drawImage(img,sx,sy,sw,sh,0,0,c.width,c.height);return c;
  }

  function getRoiCanvas(){
    const roi=$('taxCategoryRoiPreview');
    return canvasFromImage(roi)||cropTaxRoiFromPreview();
  }

  function darkRatio(data,W,H,x1,x2,y1,y2,thr){
    const xa=Math.max(0,Math.floor(x1*W)),xb=Math.min(W,Math.ceil(x2*W));
    const ya=Math.max(0,Math.floor(y1*H)),yb=Math.min(H,Math.ceil(y2*H));
    let dark=0,n=0;
    for(let y=ya;y<yb;y++)for(let x=xa;x<xb;x++){
      const i=(y*W+x)*4,g=.299*data[i]+.587*data[i+1]+.114*data[i+2];
      if(g<thr)dark++;n++;
    }
    return n?dark/n:0;
  }

  function detectFromCanvas(c){
    if(!c)return {category:'待確認',confidence:0,evidence:'沒有課稅別影像'};
    const ctx=c.getContext('2d',{willReadFrequently:true}),im=ctx.getImageData(0,0,c.width,c.height),d=im.data;
    let sum=0,n=0;
    for(let i=0;i<d.length;i+=16){sum+=(d[i]+d[i+1]+d[i+2])/3;n++}
    const mean=sum/Math.max(1,n),thr=Math.max(95,Math.min(185,mean-25));
    // 標準台灣三聯式課稅列：每個標籤右側／底線上方是 V/✓ 標記區。
    // 只掃底線上方，避免把空白欄位的水平底線誤當成勾選。
    const xs=[[.225,.305],[.485,.585],[.705,.815]];
    const ys=[[.385,.515],[.405,.535],[.425,.545]];
    const scores=xs.map(([x1,x2])=>Math.max(...ys.map(([y1,y2])=>darkRatio(d,c.width,c.height,x1,x2,y1,y2,thr))));
    const ranked=scores.map((score,i)=>({i,score})).sort((a,b)=>b.score-a.score),best=ranked[0],second=ranked[1];
    const absolute=best.score>=.055,dominant=best.score>=second.score*1.55+.008;
    if(!absolute||!dominant){
      return {category:'待確認',confidence:Math.max(0,Math.min(.79,best.score*5)),scores,threshold:thr,evidence:`票面幾何未形成唯一標記：${scores.map(x=>(x*100).toFixed(1)+'%').join('/')}`};
    }
    const confidence=Math.max(.88,Math.min(.99,.88+(best.score-second.score)*1.2));
    return {category:CATS[best.i],confidence,scores,threshold:thr,evidence:`票面幾何：${CATS[best.i]}標記區有明顯 V/勾選筆畫；三區暗像素 ${scores.map(x=>(x*100).toFixed(1)+'%').join('/')}`};
  }

  function writeAmount(id,value,source){
    const el=$(id);if(!el||!Number.isFinite(value))return false;
    if(el.dataset.humanEdited==='1'&&String(el.value||'').trim()!=='')return false;
    const v=String(Math.round(value));el.value=v;el.dataset.aiSource=source;el.dataset.autoDerived='1';
    try{if(typeof state!=='undefined'&&state?.candidates)state.candidates[id]=[{value:v,source,score:135}]}catch{}
    try{if(typeof setSource==='function')setSource(id,source)}catch{}
    try{el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}catch{}
    return true;
  }

  function parseAmountTriplet(text){
    const nums=(String(text||'').match(/\d{1,9}/g)||[]).map(Number).filter(Number.isFinite);
    for(let i=nums.length-3;i>=0;i--){
      const a=nums[i],b=nums[i+1],c=nums[i+2];
      if(a>=0&&b>=0&&c>0&&a+b===c&&b<=Math.max(1,Math.round(a*.2)))return {net:a,tax:b,gross:c};
    }
    return null;
  }

  async function ocrAmountsFromRoi(c){
    if(!c||!window.Tesseract?.createWorker)return null;
    const lower=document.createElement('canvas');
    const sy=Math.round(c.height*.58),sh=Math.max(1,c.height-sy);
    lower.width=c.width;lower.height=sh;
    lower.getContext('2d',{willReadFrequently:true}).drawImage(c,0,sy,c.width,sh,0,0,lower.width,lower.height);
    let w=null;
    try{
      w=await Tesseract.createWorker('eng',1);
      try{await w.setParameters({tessedit_pageseg_mode:'6',tessedit_char_whitelist:'0123456789 '})}catch{}
      const r=await w.recognize(lower),triplet=parseAmountTriplet(r?.data?.text||'');
      return triplet?{...triplet,text:r.data.text||''}:null;
    }catch{return null}finally{try{await w?.terminate()}catch{}}
  }

  function currentMoney(id){const n=Number(String($(id)?.value||'').replace(/[,，\s元$NTnt]/g,''));return Number.isFinite(n)?n:NaN}

  function publishCategory(result,source='本地票面 V 幾何辨識'){
    if(!CATS.includes(result?.category))return false;
    const sel=$('taxCategory');if(!sel)return false;
    sel.value=result.category;sel.dataset.aiSource=source;sel.dataset.lastAiTaxCategory=result.category;
    try{sel.dispatchEvent(new Event('input',{bubbles:true}));sel.dispatchEvent(new Event('change',{bubbles:true}))}catch{}
    const api=window.__taxAiAutoTax152Api;
    try{api?.setConcreteCategory?.(result.category,source,result.evidence,(Number(result.confidence)||0)*100)}catch{}
    return true;
  }

  async function rescue(){
    const c=getRoiCanvas(),result=detectFromCanvas(c);
    if(!CATS.includes(result.category))return result;
    publishCategory(result);

    let net=currentMoney('net'),tax=currentMoney('tax'),gross=currentMoney('gross');
    let amountOk=Number.isFinite(net)&&Number.isFinite(tax)&&Number.isFinite(gross)&&net+tax===gross&&gross>0;
    if(!amountOk){
      const a=await ocrAmountsFromRoi(c);
      if(a){writeAmount('net',a.net,'課稅列本地 OCR');writeAmount('tax',a.tax,'課稅列本地 OCR');writeAmount('gross',a.gross,'課稅列本地 OCR');net=a.net;tax=a.tax;gross=a.gross;amountOk=true}
    }
    if(result.category==='應稅'&&!amountOk&&Number.isFinite(gross)&&gross>0){
      try{window.__taxAiAutoTax152Api?.autoReverseTaxable?.('應稅 5% 自動反推')}catch{}
    }
    try{window.__taxAiAutoTax152Api?.refreshRecognitionState?.({cat:result.category,confidence:(Number(result.confidence)||0)*100,source:'本地票面 V 幾何辨識',evidence:result.evidence})}catch{}
    const body=$('taxCategoryEvidenceBody'),panel=$('taxCategoryEvidence'),src=$('sTaxCategory');
    if(panel)panel.className='ok';if(src)src.textContent='本地票面 V 幾何辨識';
    if(body){
      net=currentMoney('net');tax=currentMoney('tax');gross=currentMoney('gross');
      const amounts=Number.isFinite(net)&&Number.isFinite(tax)&&Number.isFinite(gross)&&net+tax===gross?`；金額 ${Math.round(net)}＋${Math.round(tax)}＝${Math.round(gross)}`:'';
      body.textContent=`✓ 課稅別已辨識：${result.category}｜${result.evidence}；confidence ${Math.round(result.confidence*100)}%${amounts}`;
    }
    return result;
  }

  function patchScan(){
    const scan=$('scan');if(!scan||scan.dataset.taxVisionFallback152==='1')return;
    const old=scan.onclick;scan.dataset.taxVisionFallback152='1';
    scan.onclick=async function(...args){const r=typeof old==='function'?await old.apply(this,args):undefined;await rescue();return r};
  }
  function patchButtons(){
    for(const id of ['taxCategoryLocal','taxCategoryGemma']){
      const b=$(id);if(!b||b.dataset.taxVisionFallback152==='1')continue;
      const old=b.onclick;b.dataset.taxVisionFallback152='1';
      b.onclick=async function(...args){const r=typeof old==='function'?await old.apply(this,args):undefined;await rescue();return r};
    }
  }
  function patch(){patchScan();patchButtons()}
  patch();setTimeout(patch,100);setTimeout(patch,700);setTimeout(patch,1500);
  window.__taxAiTaxVisionFallback152Api={detectFromCanvas,getRoiCanvas,rescue,parseAmountTriplet};
  console.info('[TaxAI] deterministic tax-category visual fallback V1.5.2 enabled');
})();