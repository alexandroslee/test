// V0.32 - Orientation-first invoice recognition
// Loaded after V0.31 app.js. It overrides only the scan pipeline and reuses V0.31 QR/OCR/validation logic.

(function(){
  const panel=document.createElement('div');
  panel.className='info';
  panel.style.marginTop='10px';
  panel.innerHTML='<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b>🧭 影像方向</b><span id="orientationResult">尚未分析</span><select id="orientationOverride" style="padding:7px;border:1px solid #d8e0ea;border-radius:8px"><option value="auto">自動判斷</option><option value="0">不旋轉</option><option value="90">右轉 90°</option><option value="180">旋轉 180°</option><option value="270">左轉 90°</option></select></div><div id="orientationDetail" class="muted small" style="margin-top:6px">OCR 前先判斷 0°／90°／180°／270°，選出最像正向台灣發票的方向。</div>';
  const scanSummaryEl=document.getElementById('scanSummary');
  scanSummaryEl?.insertAdjacentElement('afterend',panel);

  const orientationResult=document.getElementById('orientationResult');
  const orientationDetail=document.getElementById('orientationDetail');
  const orientationOverride=document.getElementById('orientationOverride');

  function rotateCanvas(src,deg){
    deg=((Number(deg)||0)%360+360)%360;
    if(deg===0){const c=document.createElement('canvas');c.width=src.width;c.height=src.height;c.getContext('2d',{willReadFrequently:true}).drawImage(src,0,0);return c;}
    const swap=deg===90||deg===270,c=document.createElement('canvas');
    c.width=swap?src.height:src.width;c.height=swap?src.width:src.height;
    const ctx=c.getContext('2d',{willReadFrequently:true});ctx.translate(c.width/2,c.height/2);ctx.rotate(deg*Math.PI/180);ctx.drawImage(src,-src.width/2,-src.height/2);return c;
  }
  function shrinkCanvas(src,maxDim=850){
    const scale=Math.min(1,maxDim/Math.max(src.width,src.height)),c=document.createElement('canvas');
    c.width=Math.max(1,Math.round(src.width*scale));c.height=Math.max(1,Math.round(src.height*scale));
    c.getContext('2d',{willReadFrequently:true}).drawImage(src,0,0,c.width,c.height);return c;
  }
  function orientationScore(text,confidence){
    const t=String(text||'').replace(/\s+/g,' ');let score=(Number(confidence)||0)*0.35;
    const keywords=['電子發票','統一發票','發票','賣方','買方','銷售人','買受人','總計','合計','稅額','銷售額','隨機碼','格式'];
    for(const k of keywords)if(t.includes(k))score+=k==='發票'?10:5;
    if(/[A-Z]{2}\s*-?\s*[0-9OQDISBLZ|]{8}/i.test(t))score+=18;
    if(/(?:賣方|銷售人|買方|買受人)[^0-9]{0,16}[0-9OQDISBLZ|]{8}/i.test(t))score+=16;
    if(/\d{2,3}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日/.test(t))score+=12;
    if(/(?:總計|合計|稅額|銷售額)[^0-9]{0,12}[0-9,]+/.test(t))score+=8;
    const useful=(t.match(/[\u4e00-\u9fffA-Za-z0-9]/g)||[]).length;score+=Math.min(12,useful/25);
    return Math.round(score*10)/10;
  }
  async function detectOrientation(src,onProgress){
    const manual=orientationOverride?.value||'auto';
    if(manual!=='auto')return {angle:Number(manual),manual:true,results:[]};
    const base=shrinkCanvas(src,820),angles=[0,90,180,270],results=[];
    const worker=await Tesseract.createWorker('chi_tra+eng',1,{logger:m=>{if(m.progress!=null)onProgress?.(m.progress)}});
    try{
      try{await worker.setParameters({tessedit_pageseg_mode:'6',preserve_interword_spaces:'1'});}catch{}
      for(let i=0;i<angles.length;i++){
        const angle=angles[i],test=rotateCanvas(base,angle);onProgress?.(i/angles.length);
        const r=await worker.recognize(test),confidence=Number(r.data.confidence)||0,text=r.data.text||'',score=orientationScore(text,confidence);
        results.push({angle,score,confidence,text:text.slice(0,180)});
      }
    }finally{await worker.terminate();}
    results.sort((a,b)=>b.score-a.score);
    const best=results[0],second=results[1];
    // If all probes are weak and 0° is nearly tied, avoid unnecessary rotation.
    const zero=results.find(x=>x.angle===0);
    if(best&&zero&&best.angle!==0&&best.score<35&&best.score-zero.score<4)return {angle:0,manual:false,results,weak:true};
    return {angle:best?.angle||0,manual:false,results,weak:!!(best&&second&&best.score-second.score<3)};
  }
  function renderOrientation(o){
    if(!o)return;
    const angle=o.angle||0,label=angle===0?'正向，不需旋轉':angle===90?'右轉 90°':angle===180?'倒置，旋轉 180°':'左轉 90°';
    orientationResult.textContent=(o.manual?'人工指定：':'自動判斷：')+label+(o.weak?'（信心較低）':'');
    if(o.results?.length){orientationDetail.innerHTML=o.results.slice().sort((a,b)=>a.angle-b.angle).map(x=>`${x.angle}°：方向分數 ${x.score}／OCR ${Math.round(x.confidence)}%`).join('　');}
    else orientationDetail.textContent='已依人工指定方向校正。';
  }

  // Replace V0.31 scan pipeline: orientation first, then QR/barcode/OCR.
  const scanBtn=document.getElementById('scan');
  if(!scanBtn)return;
  scanBtn.textContent='✨ 先校正方向，再執行強化辨識';
  scanBtn.onclick=async()=>{
    if(!state.file)return;
    scanBtn.disabled=true;state.sources={};state.candidates={};state.qr=[];state.barcodes=[];state.ocrTexts=[];state.qrBuyerAbsent=false;raw.value='';
    ['date','track','number','seller','buyer','net','tax','gross'].forEach(k=>{$(k).value='';setSource(k,'—')});direction.value='unknown';direction.disabled=true;
    bar.style.width='3%';status.textContent='載入影像…';orientationResult.textContent='分析中…';orientationDetail.textContent='正在比較 0°／90°／180°／270°。';
    try{
      const original=await imageToCanvas(state.file);bar.style.width='6%';status.textContent='🧭 判斷發票方向…';
      const ori=await detectOrientation(original,p=>{const pct=6+Math.round((p||0)*17);bar.style.width=pct+'%';status.textContent=`🧭 方向分析 ${Math.min(100,Math.round((p||0)*100))}%`;});
      const canvas=rotateCanvas(original,ori.angle);renderOrientation(ori);
      try{preview.src=canvas.toDataURL('image/jpeg',0.92);preview.style.display='block';}catch{}
      bar.style.width='25%';status.textContent='方向已校正，掃描 QR Code…';
      state.qr=scanQRCodes(canvas);for(const q of state.qr)addQR(q);
      bar.style.width='30%';status.textContent='掃描一維條碼…';state.barcodes=await scanBarcodes(canvas);for(const b of state.barcodes)addBarcode(b);
      chooseFields();bar.style.width='35%';status.textContent='方向校正完成，啟動 OCR…';await runOCR(canvas);chooseFields();
      raw.value=state.ocrTexts.join('\n\n--- OCR PASS ---\n\n');ocrConfidence.textContent=`OCR 最佳信心 ${Math.round(state.ocrConfidence)}%`;
      const v=validateRecognition();renderSourceDetail();scanSummary.className=state.qr.length?'ok':'info';
      scanSummary.textContent=state.qr.length?`✓ 方向已校正；讀到 ${state.qr.length} 個 QR Code，並完成 OCR 交叉驗證。`:'方向已校正；未讀到可解析 QR Code，已使用多階段 OCR。';
      bar.style.width='100%';status.textContent=`辨識完成：方向 ${ori.angle}°、品質 ${v.score}/100，請人工核對。`;
    }catch(e){status.textContent='辨識失敗：'+(e.message||e);bar.style.width='0';orientationResult.textContent='方向分析失敗';}
    finally{scanBtn.disabled=false;}
  };
})();
