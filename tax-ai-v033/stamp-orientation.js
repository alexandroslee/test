// V0.33 - Orientation-first + manual invoice stamp OCR
// Loaded after V0.31 app.js. It overrides the scan pipeline and reuses V0.31 QR/OCR/validation logic.
(function(){
  const scanBtn=document.getElementById('scan');
  if(!scanBtn)return;

  const panel=document.createElement('div');
  panel.className='info';
  panel.style.marginTop='10px';
  panel.innerHTML='<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b>🧭 影像方向</b><span id="orientationResult">尚未分析</span><select id="orientationOverride" style="padding:7px;border:1px solid #d8e0ea;border-radius:8px"><option value="auto">自動判斷</option><option value="0">不旋轉</option><option value="90">右轉 90°</option><option value="180">旋轉 180°</option><option value="270">左轉 90°</option></select></div><div id="orientationDetail" class="muted small" style="margin-top:6px">OCR 前先比較 0°／90°／180°／270°。</div>';
  document.getElementById('scanSummary')?.insertAdjacentElement('afterend',panel);

  const orientationResult=document.getElementById('orientationResult');
  const orientationDetail=document.getElementById('orientationDetail');
  const orientationOverride=document.getElementById('orientationOverride');
  const invoiceType=document.getElementById('invoiceType');
  const stampPreview=document.getElementById('stampPreview');
  const stampStatus=document.getElementById('stampStatus');
  const stampRaw=document.getElementById('stampRaw');

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
    const keywords=['電子發票','統一發票','發票','賣方','買方','銷售人','買受人','總計','合計','稅額','銷售額','統一編號'];
    for(const k of keywords)if(t.includes(k))score+=k==='發票'?10:5;
    if(/[A-Z]{2}\s*-?\s*[0-9OQDISBLZ|]{8}/i.test(t))score+=18;
    if(/(?:賣方|銷售人|買方|買受人)[^0-9]{0,18}[0-9OQDISBLZ|]{8}/i.test(t))score+=16;
    if(/\d{2,3}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日/.test(t))score+=12;
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
        results.push({angle,score,confidence});
      }
    }finally{await worker.terminate();}
    results.sort((a,b)=>b.score-a.score);
    const best=results[0],second=results[1],zero=results.find(x=>x.angle===0);
    if(best&&zero&&best.angle!==0&&best.score<35&&best.score-zero.score<4)return {angle:0,manual:false,results,weak:true};
    return {angle:best?.angle||0,manual:false,results,weak:!!(best&&second&&best.score-second.score<3)};
  }
  function renderOrientation(o){
    const angle=o?.angle||0,label=angle===0?'正向，不需旋轉':angle===90?'右轉 90°':angle===180?'倒置，旋轉 180°':'左轉 90°';
    orientationResult.textContent=(o?.manual?'人工指定：':'自動判斷：')+label+(o?.weak?'（信心較低）':'');
    orientationDetail.innerHTML=o?.results?.length?o.results.slice().sort((a,b)=>a.angle-b.angle).map(x=>`${x.angle}°：${x.score} 分／OCR ${Math.round(x.confidence)}%`).join('　'):'已依人工指定方向校正。';
  }

  function cropScale(src,xRatio,yRatio,wRatio,hRatio,scale=2.5){
    const sx=Math.max(0,Math.floor(src.width*xRatio)),sy=Math.max(0,Math.floor(src.height*yRatio));
    const sw=Math.min(src.width-sx,Math.floor(src.width*wRatio)),sh=Math.min(src.height-sy,Math.floor(src.height*hRatio));
    const c=document.createElement('canvas');c.width=Math.max(1,Math.round(sw*scale));c.height=Math.max(1,Math.round(sh*scale));
    c.getContext('2d',{willReadFrequently:true}).drawImage(src,sx,sy,sw,sh,0,0,c.width,c.height);return c;
  }
  function grayContrast(src){
    const c=document.createElement('canvas');c.width=src.width;c.height=src.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(src,0,0);
    const im=ctx.getImageData(0,0,c.width,c.height),d=im.data;for(let i=0;i<d.length;i+=4){const g=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];const v=g<185?0:255;d[i]=d[i+1]=d[i+2]=v;}ctx.putImageData(im,0,0);return c;
  }
  function redInkContrast(src){
    const c=document.createElement('canvas');c.width=src.width;c.height=src.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(src,0,0);
    const im=ctx.getImageData(0,0,c.width,c.height),d=im.data;for(let i=0;i<d.length;i+=4){const r=d[i],g=d[i+1],b=d[i+2];const red=r-((g+b)/2);const dark=(r+g+b)/3<150;const ink=red>18||dark;const v=ink?0:255;d[i]=d[i+1]=d[i+2]=v;}ctx.putImageData(im,0,0);return c;
  }
  function cleanText(s){return String(s||'').replace(/[：]/g,':').replace(/\u3000/g,' ').replace(/[\t ]+/g,' ').trim();}
  function parseStampOCR(text,source,base=92){
    const lines=String(text||'').split(/\r?\n/).map(cleanText).filter(Boolean);
    let name='',address='',phone='';
    for(const line of lines){
      let m=line.match(/(?:統一編號|統編|營業人統編|銷售人統編|賣方統編)\s*:?\s*([0-9OQDISBLZ|]{8})/i);
      if(m){const b=fixDigits(m[1]);if(validBan(b))addCandidate('seller',b,source+'：發票章統編',base+8);}
      m=line.match(/(?:銷售人|賣方|營業人)\s*:?\s*(.{2,32})/i);
      if(m&&!name){const v=m[1].trim();if(v&&!/^\d+$/.test(v))name=v;}
      if(!name&&/(有限公司|股份有限公司|企業社|商行|實業|企業|公司|商店|行號)/.test(line)&&line.length<=36)name=line.replace(/^(銷售人|賣方|營業人)\s*:?\s*/,'').trim();
      m=line.match(/(?:地址|營業地址|址)\s*:?\s*(.+)/i);if(m&&!address)address=m[1].trim();
      if(!address&&/(?:市|縣).*(?:區|鄉|鎮|市).*(?:路|街|巷|號)/.test(line)&&line.length<=60)address=line;
      m=line.match(/(?:電話|TEL|Tel|tel)\s*:?\s*([0-9()\- ]{7,20})/);if(m&&!phone)phone=m[1].trim();
    }
    for(const m of String(text||'').matchAll(/(?:^|\D)([0-9OQDISBLZ|]{8})(?=\D|$)/gi)){
      const b=fixDigits(m[1]);if(validBan(b))addCandidate('seller',b,source+'：發票章8碼候選',base-7);
    }
    return {name,address,phone,lines};
  }
  async function runStampOCR(canvas){
    stampStatus.className='info';stampStatus.textContent='正在放大右下角發票章區域…';stampRaw.value='';
    const regions=[cropScale(canvas,.43,.48,.57,.52,2.7),cropScale(canvas,.34,.42,.66,.58,2.2)];
    try{stampPreview.src=regions[0].toDataURL('image/jpeg',.94);stampPreview.style.display='block';}catch{}
    const variants=[];for(const r of regions){variants.push(r,grayContrast(r),redInkContrast(r));}
    const worker=await Tesseract.createWorker('chi_tra+eng',1,{logger:m=>{if(m.progress!=null){bar.style.width=(34+Math.round(m.progress*17))+'%';status.textContent=`🟥 發票章 OCR ${Math.round(m.progress*100)}%`;}}});
    const texts=[],infos=[];
    try{
      try{await worker.setParameters({tessedit_pageseg_mode:'6',preserve_interword_spaces:'1'});}catch{}
      for(let i=0;i<variants.length;i++){
        const r=await worker.recognize(variants[i]);const txt=r.data.text||'';if(txt.trim()){texts.push(txt);infos.push(parseStampOCR(txt,`OCR 發票章${i+1}`,90+(i%3===2?3:0)));}
        const s=best('seller');if(s&&s.score>=96)break;
      }
    }finally{await worker.terminate();}
    stampRaw.value=texts.join('\n\n--- 發票章 OCR PASS ---\n\n');
    const merged={name:'',address:'',phone:''};for(const x of infos){if(!merged.name&&x.name)merged.name=x.name;if(!merged.address&&x.address)merged.address=x.address;if(!merged.phone&&x.phone)merged.phone=x.phone;}
    if(document.getElementById('sellerName'))sellerName.value=merged.name;
    if(document.getElementById('sellerAddress'))sellerAddress.value=merged.address;
    if(document.getElementById('sellerPhone'))sellerPhone.value=merged.phone;
    const s=best('seller');stampStatus.className=s?'ok':'warn';stampStatus.textContent=s?`✓ 發票章辨識完成；賣方統編候選 ${s.value}。`:'⚠ 已掃描右下角發票章，但尚未取得可靠賣方統編，請人工確認。';
  }

  scanBtn.textContent='✨ 先校正方向，再做 QR／OCR／發票章辨識';
  scanBtn.onclick=async()=>{
    if(!state.file)return;
    scanBtn.disabled=true;state.sources={};state.candidates={};state.qr=[];state.barcodes=[];state.ocrTexts=[];state.qrBuyerAbsent=false;raw.value='';
    ['date','track','number','seller','buyer','net','tax','gross'].forEach(k=>{$(k).value='';setSource(k,'—')});
    ['sellerName','sellerAddress','sellerPhone'].forEach(k=>{const e=document.getElementById(k);if(e)e.value='';});
    if(stampRaw)stampRaw.value='';direction.value='unknown';direction.disabled=true;bar.style.width='3%';status.textContent='載入影像…';orientationResult.textContent='分析中…';
    try{
      const original=await imageToCanvas(state.file);bar.style.width='6%';status.textContent='🧭 判斷發票方向…';
      const ori=await detectOrientation(original,p=>{bar.style.width=(6+Math.round((p||0)*17))+'%';});
      const canvas=rotateCanvas(original,ori.angle);renderOrientation(ori);try{preview.src=canvas.toDataURL('image/jpeg',.92);preview.style.display='block';}catch{}
      bar.style.width='25%';status.textContent='方向已校正，掃描 QR Code…';state.qr=scanQRCodes(canvas);for(const q of state.qr)addQR(q);
      bar.style.width='30%';status.textContent='掃描一維條碼…';state.barcodes=await scanBarcodes(canvas);for(const b of state.barcodes)addBarcode(b);chooseFields();
      const type=invoiceType?.value||'auto';const shouldStamp=type==='hand'||(type==='auto'&&state.qr.length===0);
      if(shouldStamp){bar.style.width='34%';await runStampOCR(canvas);chooseFields();}else if(stampStatus){stampStatus.className='info';stampStatus.textContent='電子發票模式：已略過發票章專用 OCR。';}
      bar.style.width='53%';status.textContent='啟動整張發票 OCR…';await runOCR(canvas);chooseFields();
      raw.value=state.ocrTexts.join('\n\n--- OCR PASS ---\n\n');ocrConfidence.textContent=`OCR 最佳信心 ${Math.round(state.ocrConfidence)}%`;
      const v=validateRecognition();renderSourceDetail();
      scanSummary.className=state.qr.length?'ok':'info';scanSummary.textContent=state.qr.length?`✓ 方向已校正；讀到 ${state.qr.length} 個 QR Code，並完成 OCR 交叉驗證。`:`方向已校正；未讀到 QR，已執行整張 OCR${shouldStamp?'＋右下角發票章專用 OCR':''}。`;
      bar.style.width='100%';status.textContent=`辨識完成：方向 ${ori.angle}°、品質 ${v.score}/100，請人工核對。`;
    }catch(e){status.textContent='辨識失敗：'+(e.message||e);bar.style.width='0';orientationResult.textContent='方向／辨識失敗';}
    finally{scanBtn.disabled=false;}
  };
})();
