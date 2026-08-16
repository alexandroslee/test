// V0.34 ROI fix - handwritten buyer BAN recognition for Taiwan manual invoices.
// Correct layout: buyer name and buyer BAN are in the UPPER-LEFT area below the invoice number.
(function(){
  const scanBtn=document.getElementById('scan');
  const invoiceType=document.getElementById('invoiceType');
  const preview=document.getElementById('preview');
  if(!scanBtn||!preview)return;

  const panel=document.createElement('div');
  panel.className='card section';
  panel.id='handBuyerPanel';
  panel.innerHTML=`
    <div class="section-title"><div><h2>✍️ 5. 手寫買受人統編強化辨識</h2>
      <div class="muted">手開／三聯式發票：優先找左上「買受人 → 統一編號」區 → 去表格線 → 數字專用 OCR → 逐碼辨識 → 統編檢查碼 → 與申報單位統編比對。</div></div>
      <span id="handBuyerBadge" class="pill">尚未辨識</span>
    </div>
    <div class="handbuyer-grid">
      <div>
        <img id="handBuyerPreview" alt="買受人統編裁切預覽" style="display:none;max-width:100%;max-height:260px;border:1px solid #e2e8f0;border-radius:12px;background:#fff">
        <div class="field" style="margin-top:10px"><label>辨識區域</label>
          <select id="handBuyerPreset">
            <option value="auto">自動比較左上多個區域</option>
            <option value="banRow">左上－統一編號 8 格（優先）</option>
            <option value="buyerBlock">左上－買受人＋統編區</option>
            <option value="buyerWide">左上－買受人寬區（備援）</option>
          </select>
        </div>
        <button id="rerunHandBuyer" class="btn ghost" style="width:100%">重新辨識手寫買受人統編</button>
        <div id="handBuyerStatus" class="info" style="margin-top:10px">等待手開發票。</div>
      </div>
      <div>
        <div class="muted small">逐碼結果（可人工修改）</div>
        <div id="digitBoxes" class="digitboxes"></div>
        <div class="row"><span>候選統編</span><b id="handBuyerCandidate">—</b></div>
        <div class="row"><span>統編檢查</span><b id="handBuyerChecksum">—</b></div>
        <div class="row"><span>申報單位比對</span><b id="handBuyerCompanyMatch">—</b></div>
        <div class="actions" style="margin-top:10px"><button id="applyHandBuyer" class="btn secondary" disabled>套用為買方統編</button></div>
      </div>
    </div>`;
  const stampSection=document.getElementById('stampRaw')?.closest('.card.section');
  if(stampSection)stampSection.insertAdjacentElement('afterend',panel);
  else document.querySelector('.card.section')?.insertAdjacentElement('afterend',panel);

  const style=document.createElement('style');
  style.textContent=`.handbuyer-grid{display:grid;grid-template-columns:minmax(260px,.9fr) 1.1fr;gap:16px}.digitboxes{display:grid;grid-template-columns:repeat(8,1fr);gap:7px;margin:10px 0 14px}.digitbox{text-align:center}.digitbox input{width:100%;min-width:0;text-align:center;font-size:24px;font-weight:800;padding:9px 2px;border:1px solid #d8e0ea;border-radius:9px}.digitbox small{display:block;margin-top:4px;color:#64748b;font-size:10px}@media(max-width:760px){.handbuyer-grid{grid-template-columns:1fr}.digitboxes{gap:4px}.digitbox input{font-size:20px}}`;
  document.head.appendChild(style);

  const badge=document.getElementById('handBuyerBadge');
  const hbPreview=document.getElementById('handBuyerPreview');
  const preset=document.getElementById('handBuyerPreset');
  const rerun=document.getElementById('rerunHandBuyer');
  const hbStatus=document.getElementById('handBuyerStatus');
  const digitBoxes=document.getElementById('digitBoxes');
  const candidateEl=document.getElementById('handBuyerCandidate');
  const checksumEl=document.getElementById('handBuyerChecksum');
  const companyMatchEl=document.getElementById('handBuyerCompanyMatch');
  const applyBtn=document.getElementById('applyHandBuyer');
  let lastResult=null,lastCorrected=null;

  const presets={
    banRow:{x:.105,y:.205,w:.315,h:.095,label:'左上統一編號8格'},
    buyerBlock:{x:.045,y:.165,w:.455,h:.135,label:'左上買受人＋統編'},
    buyerWide:{x:.035,y:.135,w:.595,h:.175,label:'左上買受人寬區'}
  };
  const confusion={
    '0':['0','6','8','9'],'1':['1','7'],'2':['2','7'],'3':['3','8'],'4':['4','9'],
    '5':['5','6','8'],'6':['6','0','5','8'],'7':['7','1','2'],'8':['8','0','3','5','6','9'],'9':['9','0','4','8']
  };

  function cloneFromImage(img,maxDim=2400){
    const W=img.naturalWidth||img.width,H=img.naturalHeight||img.height,scale=Math.min(1,maxDim/Math.max(W,H));
    const c=document.createElement('canvas');c.width=Math.max(1,Math.round(W*scale));c.height=Math.max(1,Math.round(H*scale));
    c.getContext('2d',{willReadFrequently:true}).drawImage(img,0,0,c.width,c.height);return c;
  }
  function crop(src,r,scale=3){
    const sx=Math.floor(src.width*r.x),sy=Math.floor(src.height*r.y),sw=Math.min(src.width-sx,Math.floor(src.width*r.w)),sh=Math.min(src.height-sy,Math.floor(src.height*r.h));
    const c=document.createElement('canvas');c.width=Math.max(1,Math.round(sw*scale));c.height=Math.max(1,Math.round(sh*scale));
    c.getContext('2d',{willReadFrequently:true}).drawImage(src,sx,sy,sw,sh,0,0,c.width,c.height);return c;
  }
  function preprocess(src){
    const c=document.createElement('canvas');c.width=src.width;c.height=src.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(src,0,0);
    const im=ctx.getImageData(0,0,c.width,c.height),d=im.data;let sum=0,count=0;
    for(let i=0;i<d.length;i+=20){sum+=(d[i]+d[i+1]+d[i+2])/3;count++;}
    const avg=sum/Math.max(1,count),thr=Math.max(120,Math.min(215,avg*.90));
    const dark=new Uint8Array(c.width*c.height);
    for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
      const i=(y*c.width+x)*4,g=.299*d[i]+.587*d[i+1]+.114*d[i+2],v=g<thr?1:0;dark[y*c.width+x]=v;const px=v?0:255;d[i]=d[i+1]=d[i+2]=px;d[i+3]=255;
    }
    for(let y=0;y<c.height;y++){
      let n=0;for(let x=0;x<c.width;x++)n+=dark[y*c.width+x];
      if(n/c.width>.55)for(let yy=Math.max(0,y-1);yy<=Math.min(c.height-1,y+1);yy++)for(let x=0;x<c.width;x++){const i=(yy*c.width+x)*4;d[i]=d[i+1]=d[i+2]=255;dark[yy*c.width+x]=0;}
    }
    for(let x=0;x<c.width;x++){
      let n=0;for(let y=0;y<c.height;y++)n+=dark[y*c.width+x];
      if(n/c.height>.68)for(let xx=Math.max(0,x-1);xx<=Math.min(c.width-1,x+1);xx++)for(let y=0;y<c.height;y++){const i=(y*c.width+xx)*4;d[i]=d[i+1]=d[i+2]=255;dark[y*c.width+xx]=0;}
    }
    ctx.putImageData(im,0,0);return c;
  }
  const digitString=s=>String(s||'').replace(/[^0-9]/g,'');

  function cropInk(src){
    const ctx=src.getContext('2d',{willReadFrequently:true}),im=ctx.getImageData(0,0,src.width,src.height).data;let minX=src.width,minY=src.height,maxX=-1,maxY=-1;
    for(let y=0;y<src.height;y++)for(let x=0;x<src.width;x++){const i=(y*src.width+x)*4;if(im[i]<100){if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}}
    if(maxX<0||maxY<0)return src;
    const padX=Math.round((maxX-minX+1)*.03),padY=Math.round((maxY-minY+1)*.10);
    minX=Math.max(0,minX-padX);maxX=Math.min(src.width-1,maxX+padX);minY=Math.max(0,minY-padY);maxY=Math.min(src.height-1,maxY+padY);
    const c=document.createElement('canvas');c.width=maxX-minX+1;c.height=maxY-minY+1;c.getContext('2d',{willReadFrequently:true}).drawImage(src,minX,minY,c.width,c.height,0,0,c.width,c.height);return c;
  }
  async function recognizeLine(worker,canvas){
    try{await worker.setParameters({tessedit_char_whitelist:'0123456789',tessedit_pageseg_mode:'7',preserve_interword_spaces:'0'});}catch{}
    const r=await worker.recognize(canvas);return {digits:digitString(r.data.text).slice(0,20),confidence:Number(r.data.confidence)||0,text:r.data.text||''};
  }
  function splitEight(src){
    const ink=cropInk(src),out=[],w=ink.width/8;
    for(let i=0;i<8;i++){
      const x=Math.max(0,Math.floor(i*w)-2),x2=Math.min(ink.width,Math.ceil((i+1)*w)+2),c=document.createElement('canvas');
      c.width=Math.max(1,(x2-x)*2);c.height=ink.height*2;
      c.getContext('2d',{willReadFrequently:true}).drawImage(ink,x,0,x2-x,ink.height,0,0,c.width,c.height);out.push(c);
    }return out;
  }
  async function recognizeChars(worker,src){
    const boxes=splitEight(src),digits=[],confs=[];
    try{await worker.setParameters({tessedit_char_whitelist:'0123456789',tessedit_pageseg_mode:'10'});}catch{}
    for(const b of boxes){const r=await worker.recognize(b),s=digitString(r.data.text);digits.push(s[0]||'');confs.push(Math.round(Number(r.data.confidence)||0));}
    return {digits:digits.join(''),confs};
  }
  function findEightWindows(s){
    s=digitString(s);const out=[];
    for(let i=0;i+8<=s.length;i++){const d=s.slice(i,i+8);out.push(d);}
    return [...new Set(out)];
  }
  function candidateScore(digits,conf){
    const company=fixDigits(companyBan.value);let s=Math.min(75,Number(conf)||0),d=digitString(digits);
    if(d.length===8)s+=35;if(d.length===8&&validBan(d))s+=75;if(company&&d===company)s+=90;return s;
  }
  function pickBestWindow(rawDigits,conf){
    const company=fixDigits(companyBan.value),wins=findEightWindows(rawDigits);
    if(!wins.length)return digitString(rawDigits).slice(0,8);
    wins.sort((a,b)=>candidateScore(b,conf)-candidateScore(a,conf));
    const exact=company&&wins.find(x=>x===company);return exact||wins[0];
  }
  function beamValid(primary,confs){
    if(primary.length!==8)return null;let beams=[{s:'',pen:0}];
    for(let i=0;i<8;i++){
      const p=primary[i]||'',alts=confusion[p]||[p],next=[];
      for(const b of beams)for(let j=0;j<Math.min(4,alts.length);j++)next.push({s:b.s+alts[j],pen:b.pen+(j===0?0:(100-(confs?.[i]??55))/25+j*.8)});
      next.sort((a,b)=>a.pen-b.pen);beams=next.slice(0,350);
    }
    const company=fixDigits(companyBan.value),valid=beams.filter(x=>validBan(x.s));if(!valid.length)return null;
    valid.sort((a,b)=>((company&&a.s===company)?-1000:0)+a.pen-(((company&&b.s===company)?-1000:0)+b.pen));return valid[0];
  }
  function renderDigits(digits,confs){
    const arr=Array.from({length:8},(_,i)=>digits?.[i]||'');
    digitBoxes.innerHTML=arr.map((d,i)=>`<div class="digitbox"><input inputmode="numeric" maxlength="1" data-i="${i}" value="${d}"><small>${confs?.[i]??'—'}%</small></div>`).join('');
    digitBoxes.querySelectorAll('input').forEach(inp=>inp.oninput=()=>{inp.value=inp.value.replace(/\D/g,'').slice(0,1);refreshManual();});
  }
  const currentDigits=()=>[...digitBoxes.querySelectorAll('input')].map(x=>x.value).join('');
  function refreshManual(){
    const d=currentDigits(),company=fixDigits(companyBan.value);
    candidateEl.textContent=d||'—';checksumEl.textContent=d.length===8?(validBan(d)?'✅ 通過':'❌ 未通過'):'尚未 8 碼';
    companyMatchEl.textContent=!company?'未設定申報單位':d===company?'✅ 等於申報單位統編':'不相同';
    applyBtn.disabled=d.length!==8||!validBan(d);lastResult={...(lastResult||{}),digits:d,valid:d.length===8&&validBan(d),companyMatch:!!company&&d===company};
  }
  async function runBuyerOCR(corrected,forcedPreset){
    if(!corrected)return null;
    badge.textContent='辨識中';hbStatus.className='info';hbStatus.textContent='正在辨識左上「買受人／統一編號」區…';applyBtn.disabled=true;
    const keys=forcedPreset&&forcedPreset!=='auto'?[forcedPreset]:Object.keys(presets);
    const worker=await Tesseract.createWorker('eng',1,{logger:m=>{if(m.progress!=null)hbStatus.textContent=`手寫數字 OCR ${Math.round(m.progress*100)}%`;}});
    const results=[];
    try{
      for(const k of keys){
        const rawCrop=crop(corrected,presets[k],3),pp=preprocess(rawCrop),line=await recognizeLine(worker,pp);
        const chosen=pickBestWindow(line.digits,line.confidence);
        results.push({key:k,rawCrop,pp,rawDigits:line.digits,digits:chosen,confidence:line.confidence,score:candidateScore(chosen,line.confidence)});
      }
      results.sort((a,b)=>b.score-a.score);let best=results[0];if(!best)return null;
      let charRes=null,chosen=best.digits;
      if(chosen.length!==8||!validBan(chosen)||best.confidence<80){
        charRes=await recognizeChars(worker,best.pp);
        const primary=charRes.digits.length===8?charRes.digits:chosen,confs=charRes.confs||Array(8).fill(Math.round(best.confidence));
        const alt=beamValid(primary,confs);if(alt)chosen=alt.s;else if(primary.length===8)chosen=primary;
      }
      const company=fixDigits(companyBan.value),valid=chosen.length===8&&validBan(chosen),companyMatch=!!company&&chosen===company;
      try{hbPreview.src=best.rawCrop.toDataURL('image/jpeg',.94);hbPreview.style.display='block';}catch{}
      const confs=charRes?.confs||Array(8).fill(Math.round(best.confidence));
      renderDigits(chosen,confs);lastResult={digits:chosen,valid,companyMatch,confidence:Math.round(best.confidence),preset:best.key,score:best.score,confs};refreshManual();
      badge.textContent=valid?(companyMatch?'高可信':'合法候選'):'需人工確認';hbStatus.className=valid?'ok':'warn';
      hbStatus.textContent=valid?(companyMatch?`✓ 左上買受人統編 ${chosen}，檢查碼通過且等於申報單位。`:`✓ 左上買受人統編候選 ${chosen} 通過檢查碼，但與申報單位不同，請人工確認。`):`⚠ 左上統編區尚未取得可靠 8 碼結果，請逐碼修正或切換辨識區域。`;
      if(valid){addCandidate('buyer',chosen,companyMatch?'手寫買受人統編：左上ROI＋申報單位比對':'手寫買受人統編：左上ROI＋檢查碼',companyMatch?130:112);chooseFields();validateRecognition();renderSourceDetail();}
      return lastResult;
    }finally{await worker.terminate();}
  }
  function canvasFromCorrectedPreview(){if(!preview.complete||(preview.naturalWidth||0)<10)return null;return cloneFromImage(preview);}
  applyBtn.onclick=()=>{
    const d=currentDigits();if(d.length!==8||!validBan(d)){hbStatus.className='warn';hbStatus.textContent='⚠ 請先修正為通過統編檢查碼的 8 碼數字。';return;}
    addCandidate('buyer',d,'人工確認：手寫買受人統編',140);buyer.value=d;setSource('buyer','人工確認：手寫買受人統編');
    const v=validateRecognition();renderSourceDetail();hbStatus.className='ok';hbStatus.textContent=`✓ 已人工套用買受人統編 ${d}；${v.reason}`;
  };
  rerun.onclick=async()=>{
    const c=lastCorrected||canvasFromCorrectedPreview();if(!c){hbStatus.className='warn';hbStatus.textContent='請先上傳並完成一次發票辨識。';return;}
    rerun.disabled=true;try{await runBuyerOCR(c,preset.value);}finally{rerun.disabled=false;}
  };

  const baseScan=scanBtn.onclick;
  scanBtn.onclick=async function(){
    await baseScan.call(scanBtn);
    const type=invoiceType?.value||'auto',isHand=type==='hand'||(type==='auto'&&state.qr.length===0);
    if(!isHand){badge.textContent='電子發票略過';hbStatus.className='info';hbStatus.textContent='此張已有 QR／被指定為電子發票，略過手寫買受人統編專用辨識。';return;}
    lastCorrected=canvasFromCorrectedPreview();if(!lastCorrected)return;
    scanBtn.disabled=true;
    try{
      status.textContent='✍️ 加強辨識左上手寫買受人統編…';
      await runBuyerOCR(lastCorrected,preset.value);
      const v=validateRecognition();renderSourceDetail();status.textContent=`辨識完成：${v.reason}，請人工核對。`;
      scanSummary.textContent+=' 已加跑左上買受人統編專用 OCR。';
    }catch(e){hbStatus.className='warn';hbStatus.textContent='手寫買受人統編辨識失敗：'+(e.message||e);}
    finally{scanBtn.disabled=false;}
  };
})();
