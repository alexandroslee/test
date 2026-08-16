// V0.35 - Taiwan manual triplicate invoice layout-aware recognition.
// Extends V0.34. Key rule: the 8 boxed digits beside/after 「統一編號」 in the upper-left buyer block ARE the buyer BAN.
(function(){
  const $=id=>document.getElementById(id);
  const scanBtn=$('scan'), preview=$('preview');
  if(!scanBtn||!preview)return;

  const subtitle=document.querySelector('.top .muted');
  if(subtitle)subtitle.textContent='V0.35｜標準三聯式版面解析＋8格買受人統編定位';
  const hero=document.querySelector('.hero');
  if(hero)hero.innerHTML='<b>V0.35 辨識策略：</b>先擺正照片 → 判斷電子／手開 → 手開三聯式採<b>版面分區</b>：左上發票號碼、左上買受人、左上「統一編號」8 格＝買受人統編、中央明細、下方稅額、右下賣方章 → 各區專用 OCR → 統編檢查碼＋申報單位比對 → 人工確認。';
  scanBtn.textContent='✨ 執行 V0.35 版面解析強化辨識';

  const panel=document.createElement('div');
  panel.className='card section';
  panel.id='layoutV035Panel';
  panel.innerHTML=`
    <div class="section-title"><div><h2>🧩 6. 三聯式發票版面解析</h2>
      <div class="muted">固定語義，不固定單一像素：先依標準版型找區塊，再在「統一編號」區內尋找 8 個方格邊界。</div></div>
      <span id="layoutBadge" class="pill">尚未解析</span>
    </div>
    <div id="layoutStatus" class="info">等待手開／三聯式發票。</div>
    <div class="layout035-grid" style="margin-top:12px">
      <div><b>① 發票號碼</b><img id="roiInvoiceNo"><small>左上：字軌＋8碼</small></div>
      <div><b>② 買受人區</b><img id="roiBuyerBlock"><small>買受人名稱＋統一編號</small></div>
      <div><b>③ 買受人統編 8 格</b><img id="roiBuyerBan"><small>此區即 Buyer BAN</small></div>
      <div><b>④ 品名／金額明細</b><img id="roiItems"><small>中央表格</small></div>
      <div><b>⑤ 銷售額／稅額／總計</b><img id="roiTotals"><small>左下金額區</small></div>
      <div><b>⑥ 賣方發票章</b><img id="roiSellerStamp"><small>右下賣方資料</small></div>
    </div>
    <div class="two" style="margin-top:14px">
      <div>
        <h3 style="margin:0 0 8px">✍️ 8 格框線偵測</h3>
        <div id="gridDetectStatus" class="info">尚未偵測。</div>
        <canvas id="buyerGridCanvas" style="display:none;max-width:100%;margin-top:10px;border:1px solid #e2e8f0;border-radius:10px"></canvas>
      </div>
      <div>
        <h3 style="margin:0 0 8px">📋 版面欄位結果</h3>
        <div class="row"><span>發票號碼 ROI</span><b id="layoutInvoiceNo">—</b></div>
        <div class="row"><span>買受人名稱 ROI</span><b id="layoutBuyerName">—</b></div>
        <div class="row"><span>買受人統編 ROI</span><b id="layoutBuyerBan">—</b></div>
        <div class="row"><span>統編檢查</span><b id="layoutBanCheck">—</b></div>
      </div>
    </div>`;
  const handPanel=$('handBuyerPanel');
  if(handPanel)handPanel.insertAdjacentElement('afterend',panel); else document.body.appendChild(panel);

  const st=document.createElement('style');
  st.textContent=`
    .layout035-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
    .layout035-grid>div{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:10px;display:grid;gap:6px}
    .layout035-grid img{display:block;width:100%;height:125px;object-fit:contain;background:#fff;border:1px solid #e5e7eb;border-radius:8px}
    .layout035-grid small{color:#64748b}
    @media(max-width:820px){.layout035-grid{grid-template-columns:1fr 1fr}}
    @media(max-width:520px){.layout035-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(st);

  const ROIS={
    invoiceNo:{x:.035,y:.075,w:.29,h:.115},
    buyerBlock:{x:.035,y:.145,w:.66,h:.145},
    buyerBanSearch:{x:.105,y:.175,w:.42,h:.12},
    items:{x:.035,y:.275,w:.59,h:.285},
    totals:{x:.035,y:.535,w:.59,h:.175},
    sellerStamp:{x:.60,y:.43,w:.29,h:.34}
  };

  function canvasFromPreview(maxDim=2600){
    const W=preview.naturalWidth||preview.width,H=preview.naturalHeight||preview.height;
    if(W<10||H<10)return null;
    const scale=Math.min(1,maxDim/Math.max(W,H)),c=document.createElement('canvas');
    c.width=Math.round(W*scale);c.height=Math.round(H*scale);
    c.getContext('2d',{willReadFrequently:true}).drawImage(preview,0,0,c.width,c.height);
    return c;
  }
  function crop(src,r,scale=2){
    const sx=Math.max(0,Math.floor(src.width*r.x)),sy=Math.max(0,Math.floor(src.height*r.y));
    const sw=Math.max(1,Math.min(src.width-sx,Math.floor(src.width*r.w))),sh=Math.max(1,Math.min(src.height-sy,Math.floor(src.height*r.h)));
    const c=document.createElement('canvas');c.width=Math.round(sw*scale);c.height=Math.round(sh*scale);
    c.getContext('2d',{willReadFrequently:true}).drawImage(src,sx,sy,sw,sh,0,0,c.width,c.height);return c;
  }
  function img(id,c){try{$(id).src=c.toDataURL('image/jpeg',.9)}catch{}}
  function gray(src){
    const c=document.createElement('canvas');c.width=src.width;c.height=src.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(src,0,0);
    const im=ctx.getImageData(0,0,c.width,c.height),d=im.data;
    let sum=0,n=0;for(let i=0;i<d.length;i+=24){sum+=(d[i]+d[i+1]+d[i+2])/3;n++}const avg=sum/Math.max(1,n),thr=Math.max(145,Math.min(220,avg*.93));
    for(let i=0;i<d.length;i+=4){const g=.299*d[i]+.587*d[i+1]+.114*d[i+2],v=g<thr?0:255;d[i]=d[i+1]=d[i+2]=v;d[i+3]=255}ctx.putImageData(im,0,0);return c;
  }
  function darkRatioCols(src){
    const ctx=src.getContext('2d',{willReadFrequently:true}),d=ctx.getImageData(0,0,src.width,src.height).data,out=[];
    for(let x=0;x<src.width;x++){let dark=0;for(let y=0;y<src.height;y++){const i=(y*src.width+x)*4;if(d[i]<80)dark++}out.push(dark/src.height)}return out;
  }
  function runsAbove(vals,thr=.42){
    const runs=[];let s=-1;for(let i=0;i<=vals.length;i++){const on=i<vals.length&&vals[i]>=thr;if(on&&s<0)s=i;if(!on&&s>=0){runs.push([s,i-1]);s=-1}}return runs.map(([a,b])=>Math.round((a+b)/2));
  }
  function findNineGridLines(src){
    const bw=gray(src),rat=darkRatioCols(bw);let pts=runsAbove(rat,.40);
    const merged=[];for(const p of pts){if(!merged.length||p-merged[merged.length-1]>Math.max(5,src.width*.012))merged.push(p);else merged[merged.length-1]=Math.round((merged[merged.length-1]+p)/2)}
    pts=merged;
    if(pts.length<9)return {lines:[],canvas:bw};
    let best=null;
    for(let i=0;i<=pts.length-9;i++)for(let j=i+8;j<pts.length;j++){
      const seq=[];for(let k=0;k<9;k++)seq.push(pts[Math.round(i+k*(j-i)/8)]);
      const ds=seq.slice(1).map((x,k)=>x-seq[k]),avg=ds.reduce((a,b)=>a+b,0)/8;
      const variance=ds.reduce((a,b)=>a+(b-avg)**2,0)/8;
      const width=seq[8]-seq[0];
      if(avg<12||width<src.width*.30)continue;
      const score=variance/(avg*avg)+Math.abs(width/src.width-.62)*.25;
      if(!best||score<best.score)best={lines:seq,score};
    }
    return {lines:best?.lines||[],canvas:bw};
  }
  function drawGrid(src,lines){
    const c=document.createElement('canvas');c.width=src.width;c.height=src.height;const ctx=c.getContext('2d');ctx.drawImage(src,0,0);
    ctx.lineWidth=Math.max(2,src.width/350);ctx.strokeStyle='#e11d48';
    for(const x of lines){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,c.height);ctx.stroke()}
    return c;
  }
  async function ocr(worker,canvas,params={}){try{await worker.setParameters(params)}catch{}const r=await worker.recognize(canvas);return {text:r.data.text||'',confidence:Number(r.data.confidence)||0}}
  function digits(s){return String(s||'').replace(/\D/g,'')}
  function parseBuyerName(text){const lines=String(text||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);for(const l of lines){const m=l.match(/買\s*受\s*人\s*[:：]?\s*(.+)/);if(m&&m[1].length>=2)return m[1].replace(/統一編號.*$/,'').trim()}return ''}
  function renderLayoutCrops(src){
    const a=crop(src,ROIS.invoiceNo,1.7),b=crop(src,ROIS.buyerBlock,1.5),c=crop(src,ROIS.buyerBanSearch,2.4),d=crop(src,ROIS.items,1.1),e=crop(src,ROIS.totals,1.3),f=crop(src,ROIS.sellerStamp,1.5);
    img('roiInvoiceNo',a);img('roiBuyerBlock',b);img('roiBuyerBan',c);img('roiItems',d);img('roiTotals',e);img('roiSellerStamp',f);
    return {invoiceNo:a,buyerBlock:b,buyerBan:c,items:d,totals:e,sellerStamp:f};
  }
  async function recognizeEightBoxes(worker,src){
    const det=findNineGridLines(src),lines=det.lines;
    const gc=$('buyerGridCanvas');if(gc){const vis=drawGrid(src,lines);gc.width=vis.width;gc.height=vis.height;gc.getContext('2d').drawImage(vis,0,0);gc.style.display='block'}
    if(lines.length!==9)return {digits:'',confs:[],lines,reason:'未找到完整 9 條框線邊界'};
    const out=[],confs=[];
    for(let i=0;i<8;i++){
      const left=lines[i],right=lines[i+1],pad=Math.max(1,Math.round((right-left)*.12));
      const x=left+pad,w=Math.max(1,right-left-pad*2),y=Math.round(src.height*.08),h=Math.round(src.height*.84);
      const cell=document.createElement('canvas');cell.width=Math.max(60,w*4);cell.height=Math.max(80,h*4);
      cell.getContext('2d',{willReadFrequently:true}).drawImage(src,x,y,w,h,0,0,cell.width,cell.height);
      const r=await ocr(worker,gray(cell),{tessedit_char_whitelist:'0123456789',tessedit_pageseg_mode:'10'}),s=digits(r.text);
      out.push(s[0]||'');confs.push(Math.round(r.confidence));
    }
    return {digits:out.join(''),confs,lines,reason:'已依 8 格框線逐格辨識'};
  }
  async function runLayoutV035(){
    const type=$('invoiceType')?.value||'auto';
    if(type==='electronic'||state.qr.length){$('layoutBadge').textContent='電子發票略過';$('layoutStatus').className='info';$('layoutStatus').textContent='電子發票已有 QR，V0.35 三聯式版面規則不介入。';return}
    const src=canvasFromPreview();if(!src)return;
    $('layoutBadge').textContent='解析中';$('layoutStatus').className='info';$('layoutStatus').textContent='正在依三聯式標準版面分區…';
    const rois=renderLayoutCrops(src),worker=await Tesseract.createWorker('chi_tra+eng',1,{logger:m=>{if(m.progress!=null)$('layoutStatus').textContent=`版面 OCR ${Math.round(m.progress*100)}%`;}});
    try{
      const inv=await ocr(worker,rois.invoiceNo,{tessedit_pageseg_mode:'6'}),im=inv.text.toUpperCase().match(/([A-Z]{2})\s*[- ]?\s*(\d{8})/);
      if(im){$('layoutInvoiceNo').textContent=im[1]+im[2];addCandidate('track',im[1],'V0.35 左上發票號碼 ROI',112);addCandidate('number',im[2],'V0.35 左上發票號碼 ROI',112)}else $('layoutInvoiceNo').textContent='未可靠辨識';
      const br=await ocr(worker,rois.buyerBlock,{tessedit_pageseg_mode:'6',preserve_interword_spaces:'1'}),bn=parseBuyerName(br.text);$('layoutBuyerName').textContent=bn||'未可靠辨識';
      const box=await recognizeEightBoxes(worker,rois.buyerBan);let ban=box.digits;
      $('gridDetectStatus').className=box.lines.length===9?'ok':'warn';$('gridDetectStatus').textContent=box.lines.length===9?`✓ 找到 8 格框線；逐格 OCR：${ban||'未完整'}。`:`⚠ ${box.reason}，改用整列數字 OCR 備援。`;
      if(ban.length!==8){const lr=await ocr(worker,gray(rois.buyerBan),{tessedit_char_whitelist:'0123456789',tessedit_pageseg_mode:'7'});const ds=digits(lr.text);if(ds.length>=8)ban=ds.slice(0,8)}
      $('layoutBuyerBan').textContent=ban||'未完整';$('layoutBanCheck').textContent=ban.length===8?(validBan(ban)?'✅ 通過':'❌ 未通過'):'尚未 8 碼';
      if(ban.length===8&&validBan(ban)){
        const company=fixDigits(companyBan.value),match=company&&ban===company;addCandidate('buyer',ban,match?'V0.35 8格框線＋申報單位比對':'V0.35 8格框線＋統編檢查碼',match?135:118);
      }
      const tr=await ocr(worker,rois.totals,{tessedit_pageseg_mode:'6',preserve_interword_spaces:'1'});parseOCR(tr.text,'V0.35 下方稅額區',88);
      chooseFields();const v=validateRecognition();renderSourceDetail();
      $('layoutBadge').textContent=ban.length===8&&validBan(ban)?'版面解析完成':'需人工確認';$('layoutStatus').className=ban.length===8&&validBan(ban)?'ok':'warn';
      $('layoutStatus').textContent=(ban.length===8&&validBan(ban)?`✓ 左上「統一編號」8 格辨識為 ${ban}；這就是買受人統編。`:'⚠ 已完成版面分區，但買受人統編仍需人工逐碼確認。')+` ${v.reason}`;
    }finally{await worker.terminate()}
  }

  const baseScan=scanBtn.onclick;
  scanBtn.onclick=async function(){
    await baseScan.call(scanBtn);
    scanBtn.disabled=true;
    try{status.textContent='🧩 V0.35：依三聯式版型定位買受人統編 8 格…';await runLayoutV035();const v=validateRecognition();status.textContent=`V0.35 完成：${v.reason}，請人工核對。`;scanSummary.textContent+=' 已加跑三聯式版面解析。';}
    catch(e){$('layoutStatus').className='warn';$('layoutStatus').textContent='V0.35 版面解析失敗：'+(e.message||e)}
    finally{scanBtn.disabled=false}
  };
})();
