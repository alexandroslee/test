// V0.36 - Keep V0.35 UI, add perspective correction for buyer BAN 8-box grid.
(function(){
  const $=id=>document.getElementById(id);
  const scanBtn=$('scan');
  if(!scanBtn)return;

  const subtitle=document.querySelector('.top .muted');
  if(subtitle)subtitle.textContent='V0.36｜V0.35 介面＋買受人統編 8 格透視拉正';
  const hero=document.querySelector('.hero');
  if(hero)hero.innerHTML='<b>V0.36 辨識策略：</b>完整保留 V0.35 介面與版面解析；手開三聯式在找到左上「統一編號」8 格後，新增<b>四角定位 → 透視拉正 → 等寬切 8 格</b>，再交給逐格手寫數字辨識。';
  scanBtn.textContent='✨ 執行 V0.36 版面解析＋8格透視拉正';

  const panel=document.createElement('div');
  panel.className='card section';
  panel.id='perspectiveV036Panel';
  panel.innerHTML=`
    <div class="section-title"><div><h2>📐 7. 買受人統編 8 格透視拉正</h2>
      <div class="muted">沿用 V0.35 找到的「③ 買受人統編 8 格」ROI。拖曳四個藍點貼齊外框四角，系統會把斜框拉成水平長方形，再等寬切成 8 格。</div></div>
      <span id="p36Badge" class="pill">等待 V0.35 ROI</span>
    </div>
    <div class="p36-two">
      <div>
        <h3 style="margin:0 0 8px">A. 原始 8 格 ROI／四角校正</h3>
        <canvas id="p36Source" width="900" height="260"></canvas>
        <div class="actions" style="margin-top:10px">
          <button id="p36Load" class="btn ghost">從 V0.35 重新載入 ROI</button>
          <button id="p36Reset" class="btn ghost">重設四角</button>
          <button id="p36Warp" class="btn primary">📐 透視拉正</button>
        </div>
        <div id="p36Status" class="info" style="margin-top:10px">完成一次 V0.35 發票辨識後，這裡會自動載入買受人統編 8 格。</div>
      </div>
      <div>
        <h3 style="margin:0 0 8px">B. 拉正後 8 格</h3>
        <canvas id="p36Warped" width="960" height="180"></canvas>
        <div class="muted small" style="margin-top:6px">標準輸出：960 × 180；接著固定等寬切成 8 格。</div>
        <div id="p36Cells" class="p36-cells" style="margin-top:10px"></div>
      </div>
    </div>`;
  const layoutPanel=$('layoutV035Panel');
  if(layoutPanel)layoutPanel.insertAdjacentElement('afterend',panel); else document.body.appendChild(panel);

  const style=document.createElement('style');
  style.textContent=`
    .p36-two{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    #p36Source,#p36Warped{display:block;width:100%;background:#fff;border:1px solid #e2e8f0;border-radius:12px;touch-action:none}
    .p36-cells{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
    .p36-cell{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:6px;text-align:center}
    .p36-cell canvas{display:block;width:100%;aspect-ratio:1/1;background:#fff;border:1px solid #e5e7eb;border-radius:7px}
    .p36-cell b{display:block;margin-top:5px;font-size:13px}
    @media(max-width:900px){.p36-two{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  const srcCanvas=$('p36Source'),srcCtx=srcCanvas.getContext('2d');
  const warped=$('p36Warped'),cells=$('p36Cells'),badge=$('p36Badge'),status=$('p36Status');
  let roiImg=null,drawInfo=null,drag=-1;
  let pts=[{x:90,y:65},{x:810,y:58},{x:820,y:205},{x:80,y:216}];

  function setStatus(cls,text){status.className=cls;status.textContent=text}
  function resetPts(){
    if(!drawInfo)return;
    const {x,y,w,h}=drawInfo;
    pts=[{x:x+w*.04,y:y+h*.12},{x:x+w*.96,y:y+h*.10},{x:x+w*.96,y:y+h*.90},{x:x+w*.04,y:y+h*.92}];
    draw();
  }
  function draw(){
    srcCtx.clearRect(0,0,srcCanvas.width,srcCanvas.height);
    if(roiImg&&drawInfo)srcCtx.drawImage(roiImg,drawInfo.x,drawInfo.y,drawInfo.w,drawInfo.h);
    srcCtx.beginPath();srcCtx.moveTo(pts[0].x,pts[0].y);for(let i=1;i<4;i++)srcCtx.lineTo(pts[i].x,pts[i].y);srcCtx.closePath();
    srcCtx.fillStyle='rgba(225,29,72,.10)';srcCtx.fill();srcCtx.lineWidth=3;srcCtx.strokeStyle='#e11d48';srcCtx.stroke();
    pts.forEach((p,i)=>{srcCtx.beginPath();srcCtx.arc(p.x,p.y,9,0,Math.PI*2);srcCtx.fillStyle='#2563eb';srcCtx.fill();srcCtx.fillStyle='#fff';srcCtx.font='bold 11px sans-serif';srcCtx.fillText(String(i+1),p.x-3,p.y+4)});
  }
  function pos(e){const r=srcCanvas.getBoundingClientRect();return{x:(e.clientX-r.left)*srcCanvas.width/r.width,y:(e.clientY-r.top)*srcCanvas.height/r.height}}
  srcCanvas.addEventListener('pointerdown',e=>{const m=pos(e);drag=pts.findIndex(p=>Math.hypot(p.x-m.x,p.y-m.y)<20);srcCanvas.setPointerCapture?.(e.pointerId)});
  srcCanvas.addEventListener('pointermove',e=>{if(drag<0)return;const m=pos(e);pts[drag]=m;draw()});
  srcCanvas.addEventListener('pointerup',()=>drag=-1);srcCanvas.addEventListener('pointercancel',()=>drag=-1);

  function loadRoi(){
    const img=$('roiBuyerBan');
    if(!img||!img.src){badge.textContent='尚無 ROI';setStatus('warn','V0.35 尚未產生「買受人統編 8 格」ROI。請先完成一次發票辨識。');return Promise.resolve(false)}
    return new Promise(resolve=>{
      roiImg=new Image();
      roiImg.onload=()=>{
        const scale=Math.min((srcCanvas.width-30)/roiImg.width,(srcCanvas.height-24)/roiImg.height);
        const w=roiImg.width*scale,h=roiImg.height*scale,x=(srcCanvas.width-w)/2,y=(srcCanvas.height-h)/2;
        drawInfo={x,y,w,h};resetPts();badge.textContent='ROI 已載入';setStatus('ok','已從 V0.35 載入買受人統編 8 格。請確認四個藍點貼齊外框四角，再按「透視拉正」。');resolve(true)
      };
      roiImg.onerror=()=>{setStatus('warn','ROI 圖片載入失敗，請重新執行 V0.35 辨識。');resolve(false)};
      roiImg.src=img.src;
    });
  }

  async function getCV(){
    if(window.cv){ if(typeof window.cv.then==='function')return await window.cv; if(window.cv.Mat)return window.cv; }
    let script=document.querySelector('script[data-p36-opencv]');
    if(!script){script=document.createElement('script');script.dataset.p36Opencv='1';script.src='https://docs.opencv.org/4.x/opencv.js';script.async=true;document.head.appendChild(script)}
    for(let i=0;i<120;i++){
      if(window.cv){if(typeof window.cv.then==='function'){try{return await window.cv}catch{}}else if(window.cv.Mat)return window.cv}
      await new Promise(r=>setTimeout(r,250));
    }
    throw new Error('OpenCV.js 載入逾時');
  }
  function splitCells(){
    cells.innerHTML='';
    for(let i=0;i<8;i++){
      const box=document.createElement('div');box.className='p36-cell';
      const c=document.createElement('canvas');c.width=110;c.height=110;const ctx=c.getContext('2d');
      const sx=Math.round(i*warped.width/8),sw=Math.round(warped.width/8);
      ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);
      const pad=8;ctx.drawImage(warped,sx,0,sw,warped.height,pad,pad,c.width-pad*2,c.height-pad*2);
      const b=document.createElement('b');b.textContent=`第 ${i+1} 格`;
      box.appendChild(c);box.appendChild(b);cells.appendChild(box);
    }
  }
  async function warpNow(){
    if(!roiImg||!drawInfo){const ok=await loadRoi();if(!ok)return}
    try{
      badge.textContent='拉正中';setStatus('info','正在執行四角透視校正…');
      const cv=await getCV();
      const map=p=>({x:(p.x-drawInfo.x)*roiImg.width/drawInfo.w,y:(p.y-drawInfo.y)*roiImg.height/drawInfo.h});
      const q=pts.map(map);
      const raw=document.createElement('canvas');raw.width=roiImg.width;raw.height=roiImg.height;raw.getContext('2d').drawImage(roiImg,0,0);
      const src=cv.imread(raw),dst=new cv.Mat();
      const srcTri=cv.matFromArray(4,1,cv.CV_32FC2,[q[0].x,q[0].y,q[1].x,q[1].y,q[2].x,q[2].y,q[3].x,q[3].y]);
      const dstTri=cv.matFromArray(4,1,cv.CV_32FC2,[0,0,959,0,959,179,0,179]);
      const M=cv.getPerspectiveTransform(srcTri,dstTri);
      cv.warpPerspective(src,dst,M,new cv.Size(960,180),cv.INTER_LINEAR,cv.BORDER_REPLICATE,new cv.Scalar());
      cv.imshow(warped,dst);
      src.delete();dst.delete();srcTri.delete();dstTri.delete();M.delete();
      splitCells();badge.textContent='已拉正';setStatus('ok','✓ 已把買受人統編 8 格拉正並等寬切成 8 格。下一步可直接接逐格手寫數字模型。');
    }catch(e){badge.textContent='拉正失敗';setStatus('warn','透視拉正失敗：'+(e.message||e))}
  }

  $('p36Load').onclick=loadRoi;
  $('p36Reset').onclick=()=>{resetPts();setStatus('info','已重設四角點，請貼齊 8 格外框。')};
  $('p36Warp').onclick=warpNow;

  const baseScan=scanBtn.onclick;
  scanBtn.onclick=async function(){
    await baseScan.call(scanBtn);
    const type=$('invoiceType')?.value||'auto';
    if(type==='electronic'||state.qr.length){badge.textContent='電子發票略過';setStatus('info','電子發票已有 QR，不需要執行手寫 8 格透視拉正。');return}
    await new Promise(r=>setTimeout(r,100));
    await loadRoi();
  };
})();
