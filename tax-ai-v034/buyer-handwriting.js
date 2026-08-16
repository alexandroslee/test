// V0.34.1 SAFE - handwritten buyer BAN recognition.
// IMPORTANT: checksum validates OCR/manual input; it NEVER changes OCR digits.
(function(){
  const $=id=>document.getElementById(id);
  const scanBtn=$('scan'), invoiceType=$('invoiceType'), preview=$('preview');
  if(!scanBtn||!preview)return;

  const panel=document.createElement('div');
  panel.className='card section'; panel.id='handBuyerPanel';
  panel.innerHTML=`
    <div class="section-title"><div><h2>✍️ 5. 手寫買受人統編強化辨識</h2>
      <div class="muted">手開／三聯式：左上「統一編號」8 格＝買受人統編。辨識結果只做逐格判讀；<b>統編檢查碼只驗證，不會反推或改寫任何數字。</b></div></div>
      <span id="handBuyerBadge" class="pill">尚未辨識</span>
    </div>
    <div class="handbuyer-grid">
      <div>
        <img id="handBuyerPreview" alt="買受人統編裁切預覽" style="display:none;max-width:100%;max-height:260px;border:1px solid #e2e8f0;border-radius:12px;background:#fff">
        <div class="field" style="margin-top:10px"><label>辨識區域</label>
          <select id="handBuyerPreset">
            <option value="banRow">左上－統一編號 8 格（優先）</option>
            <option value="auto">自動比較左上多個區域（備援）</option>
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
        <div class="actions" style="margin-top:10px"><button id="applyHandBuyer" class="btn secondary" disabled>人工確認後套用為買方統編</button></div>
      </div>
    </div>`;
  const stampSection=$('stampRaw')?.closest('.card.section');
  if(stampSection)stampSection.insertAdjacentElement('afterend',panel); else document.querySelector('.card.section')?.insertAdjacentElement('afterend',panel);

  const style=document.createElement('style');
  style.textContent=`.handbuyer-grid{display:grid;grid-template-columns:minmax(260px,.9fr) 1.1fr;gap:16px}.digitboxes{display:grid;grid-template-columns:repeat(8,1fr);gap:7px;margin:10px 0 14px}.digitbox{text-align:center}.digitbox input{width:100%;min-width:0;text-align:center;font-size:24px;font-weight:800;padding:9px 2px;border:1px solid #d8e0ea;border-radius:9px}.digitbox small{display:block;margin-top:4px;color:#64748b;font-size:10px}.digitbox.low input{border-color:#f59e0b;background:#fffaf0}@media(max-width:760px){.handbuyer-grid{grid-template-columns:1fr}.digitboxes{gap:4px}.digitbox input{font-size:20px}}`;
  document.head.appendChild(style);

  const badge=$('handBuyerBadge'), hbPreview=$('handBuyerPreview'), preset=$('handBuyerPreset'), rerun=$('rerunHandBuyer'), hbStatus=$('handBuyerStatus');
  const digitBoxes=$('digitBoxes'), candidateEl=$('handBuyerCandidate'), checksumEl=$('handBuyerChecksum'), companyMatchEl=$('handBuyerCompanyMatch'), applyBtn=$('applyHandBuyer');
  let lastCorrected=null;
  const presets={
    banRow:{x:.105,y:.205,w:.315,h:.095,label:'左上統一編號8格'},
    buyerBlock:{x:.045,y:.165,w:.455,h:.135,label:'左上買受人＋統編'},
    buyerWide:{x:.035,y:.135,w:.595,h:.175,label:'左上買受人寬區'}
  };

  const digits=s=>String(s||'').replace(/\D/g,'');
  function company(){return digits($('companyBan')?.value).slice(0,8)}
  function isValid(v){
    if(typeof window.validBan==='function') return window.validBan(v);
    if(!/^\d{8}$/.test(v))return false;
    const w=[1,2,1,2,1,2,4,1];let s=0;
    for(let i=0;i<8;i++){const p=Number(v[i])*w[i];s+=Math.floor(p/10)+p%10;}
    return s%5===0 || (v[6]==='7' && (s+1)%5===0);
  }
  function cloneImage(img,maxDim=2400){const W=img.naturalWidth||img.width,H=img.naturalHeight||img.height,sc=Math.min(1,maxDim/Math.max(W,H));const c=document.createElement('canvas');c.width=Math.round(W*sc);c.height=Math.round(H*sc);c.getContext('2d',{willReadFrequently:true}).drawImage(img,0,0,c.width,c.height);return c}
  function crop(src,r,scale=3){const sx=Math.floor(src.width*r.x),sy=Math.floor(src.height*r.y),sw=Math.max(1,Math.min(src.width-sx,Math.floor(src.width*r.w))),sh=Math.max(1,Math.min(src.height-sy,Math.floor(src.height*r.h)));const c=document.createElement('canvas');c.width=sw*scale;c.height=sh*scale;c.getContext('2d',{willReadFrequently:true}).drawImage(src,sx,sy,sw,sh,0,0,c.width,c.height);return c}
  function preprocess(src){
    const c=document.createElement('canvas');c.width=src.width;c.height=src.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(src,0,0);
    const im=ctx.getImageData(0,0,c.width,c.height),d=im.data;let sum=0,n=0;
    for(let i=0;i<d.length;i+=28){sum+=(d[i]+d[i+1]+d[i+2])/3;n++}const avg=sum/Math.max(1,n),thr=Math.max(120,Math.min(220,avg*.88));
    for(let i=0;i<d.length;i+=4){const g=.299*d[i]+.587*d[i+1]+.114*d[i+2],v=g<thr?0:255;d[i]=d[i+1]=d[i+2]=v;d[i+3]=255}ctx.putImageData(im,0,0);return c;
  }
  function renderDigits(v,confs){
    const arr=Array.from({length:8},(_,i)=>v?.[i]||'');
    digitBoxes.innerHTML=arr.map((d,i)=>`<div class="digitbox ${(confs?.[i]??0)<55?'low':''}"><input inputmode="numeric" maxlength="1" value="${d}"><small>${confs?.[i]??'—'}%</small></div>`).join('');
    digitBoxes.querySelectorAll('input').forEach(inp=>inp.oninput=()=>{inp.value=inp.value.replace(/\D/g,'').slice(0,1);refresh()});refresh();
  }
  function current(){return [...digitBoxes.querySelectorAll('input')].map(x=>x.value).join('')}
  function refresh(){
    const d=current(),c=company(),valid=d.length===8&&isValid(d);candidateEl.textContent=d||'—';checksumEl.textContent=d.length===8?(valid?'✅ 通過（僅驗證）':'❌ 未通過'):'尚未 8 碼';companyMatchEl.textContent=!c?'未設定申報單位':d===c?'✅ 等於申報單位統編':'不相同';
    applyBtn.disabled=!(d.length===8&&valid);
  }
  async function fallbackOCR(src,forced){
    badge.textContent='OCR 備援';hbStatus.className='info';hbStatus.textContent='正在執行舊式 OCR 備援；此結果不會因檢查碼被改寫。';
    const keys=forced&&forced!=='auto'?[forced]:['banRow','buyerBlock','buyerWide'];
    const worker=await Tesseract.createWorker('eng',1,{logger:m=>{if(m.progress!=null)hbStatus.textContent=`OCR 備援 ${Math.round(m.progress*100)}%`;}});
    let best={value:'',conf:0,crop:null};
    try{
      for(const k of keys){const cr=crop(src,presets[k],3),pp=preprocess(cr);try{await worker.setParameters({tessedit_char_whitelist:'0123456789',tessedit_pageseg_mode:'7'})}catch{}const r=await worker.recognize(pp),raw=digits(r.data.text),conf=Number(r.data.confidence)||0;const wins=[];for(let i=0;i+8<=raw.length;i++)wins.push(raw.slice(i,i+8));const exact=company()&&wins.find(x=>x===company());const value=exact||wins[0]||raw.slice(0,8);if((value.length===8?20:0)+conf>(best.value.length===8?20:0)+best.conf)best={value,conf,crop:cr};}
    }finally{await worker.terminate()}
    if(best.crop){try{hbPreview.src=best.crop.toDataURL('image/jpeg',.94);hbPreview.style.display='block'}catch{}}
    const confs=Array(8).fill(Math.round(best.conf));renderDigits(best.value,confs);
    const c=company(),valid=best.value.length===8&&isValid(best.value),match=!!c&&best.value===c,high=best.conf>=85;
    badge.textContent=match&&valid&&high?'可人工確認':'待人工確認';hbStatus.className=match&&valid&&high?'ok':'warn';
    hbStatus.textContent=match&&valid&&high?`✓ OCR 初判 ${best.value}，高信心、檢查碼通過且等於申報單位；仍需人工確認。`:`⚠ OCR 初判 ${best.value||'不完整'}（信心 ${Math.round(best.conf)}%）。檢查碼只做驗證，不會修改數字；請使用 V0.37 的 8 格透視＋CNN 或人工核對。`;
    return {digits:best.value,confidence:best.conf,valid,match};
  }
  function corrected(){return preview.complete&&(preview.naturalWidth||0)>10?cloneImage(preview):null}
  applyBtn.onclick=()=>{const d=current();if(d.length!==8||!isValid(d)){hbStatus.className='warn';hbStatus.textContent='⚠ 請人工確認 8 碼內容；檢查碼未通過時不可套用。';return}const buyer=$('buyer');if(buyer)buyer.value=d;try{window.setSource?.('buyer','人工確認：手寫買受人統編');window.addCandidate?.('buyer',d,'人工確認：手寫買受人統編',140);window.chooseFields?.();window.validateRecognition?.();window.renderSourceDetail?.()}catch{}hbStatus.className='ok';hbStatus.textContent=`✓ 已由人工確認並套用買受人統編 ${d}。`};
  rerun.onclick=async()=>{const c=lastCorrected||corrected();if(!c){hbStatus.className='warn';hbStatus.textContent='請先上傳並完成一次發票辨識。';return}rerun.disabled=true;try{await fallbackOCR(c,preset.value)}finally{rerun.disabled=false}};

  const baseScan=scanBtn.onclick;
  scanBtn.onclick=async function(){
    await baseScan.call(scanBtn);
    const type=invoiceType?.value||'auto',isHand=type==='hand'||(type==='auto'&&((window.state?.qr||[]).length===0));
    if(!isHand){badge.textContent='電子發票略過';hbStatus.className='info';hbStatus.textContent='電子發票已有 QR，略過手寫統編備援。';return}
    lastCorrected=corrected();if(!lastCorrected)return;
    try{await fallbackOCR(lastCorrected,'banRow')}catch(e){hbStatus.className='warn';hbStatus.textContent='手寫統編 OCR 備援失敗：'+(e.message||e)}
  };
})();
