// V0.37.3 GRID-FIRST - Taiwan manual invoice buyer BAN recognition.
// Rule: detect the 8 printed boxes FIRST; only if a complete 8-cell grid is found,
// crop/clean each cell and then perform digit recognition. Checksum validates only.
(function(){
  const $=id=>document.getElementById(id);
  const scanBtn=$('scan'), handPanel=$('handBuyerPanel');
  if(!scanBtn||!handPanel)return;

  const subtitle=document.querySelector('.top .muted');
  if(subtitle)subtitle.textContent='V0.37.3｜V0.35 介面＋格線先行：先切正確 8 格，再做手寫數字辨識';
  const hero=document.querySelector('.hero');
  if(hero)hero.innerHTML='<b>V0.37.3 核心規則：</b>手寫買受人統編不再先猜數字。先從左上「統一編號」ROI偵測<b>9條垂直格線邊界＋上下格線</b> → 精準取得8格 → 去除格線、買受人名稱與外部文字 → 每格只留下手寫數字 → 最後才做 MNIST CNN／單字元 OCR。<b>找不到完整8格就停止，不產生統編候選。</b>';
  if(scanBtn)scanBtn.textContent='✨ 執行 V0.37.3：先抓8格 → 清理 → 數字辨識';

  handPanel.innerHTML=`
    <div class="section-title"><div><h2>✍️ 5. 手寫買受人統編：格線先行辨識</h2>
      <div class="muted">①找8格格線 → ②只取8格內部 → ③去掉格線與其餘內容 → ④逐格辨識0～9。完整格線是必要條件。</div></div>
      <span id="gfBadge" class="pill">等待發票</span>
    </div>
    <div id="gfStatus" class="info">請先上傳手開／三聯式發票。</div>
    <div class="gf-two" style="margin-top:12px">
      <div>
        <h3 style="margin:0 0 8px">A. 8格格線偵測</h3>
        <canvas id="gfGridCanvas" width="900" height="240"></canvas>
        <div class="actions" style="margin-top:10px"><button id="gfRun" class="btn primary">▦ 重新抓8格並辨識</button></div>
        <div class="muted small" style="margin-top:6px">紅線＝9條垂直邊界；綠線＝上下格線。必須完整找到後才進行數字辨識。</div>
      </div>
      <div>
        <h3 style="margin:0 0 8px">B. 去除其餘內容後的8格</h3>
        <div id="gfCells" class="gf-cells"></div>
      </div>
    </div>
    <div class="two" style="margin-top:14px"><div>
      <div class="row"><span>格線狀態</span><b id="gfGridState">—</b></div>
      <div class="row"><span>CNN讀值</span><b id="gfCandidate">—</b></div>
      <div class="row"><span>統編檢查</span><b id="gfChecksum">—</b></div>
      <div class="row"><span>申報單位比對</span><b id="gfCompany">—</b></div>
    </div><div>
      <div id="gfReview" class="warn">尚未辨識。</div>
      <div class="actions" style="margin-top:10px"><button id="gfApply" class="btn secondary" disabled>✓ 人工確認後套用為買方統編</button></div>
      <div class="muted small" style="margin-top:8px">統編檢查碼只做驗證，不會反推、改寫或湊出另一組數字。</div>
    </div></div>`;

  const style=document.createElement('style');
  style.textContent=`
    .gf-two{display:grid;grid-template-columns:.9fr 1.1fr;gap:14px}.gf-cells{display:grid;grid-template-columns:repeat(4,minmax(82px,1fr));gap:8px}
    #gfGridCanvas{display:block;width:100%;background:#fff;border:1px solid #e2e8f0;border-radius:12px}
    .gf-cell{border:1px solid #e2e8f0;border-radius:10px;padding:6px;background:#f8fafc;text-align:center}.gf-cell.good{border-color:#22c55e;background:#f0fdf4}.gf-cell.low{border-color:#f59e0b;background:#fffaf0}
    .gf-cell canvas{display:block;width:100%;aspect-ratio:1/1;background:#fff;border:1px solid #e5e7eb;border-radius:7px}.gf-cell input{width:100%;text-align:center;font-size:23px;font-weight:900;padding:5px 2px;margin-top:5px;border:1px solid #cbd5e1;border-radius:7px}
    .gf-cell small{display:block;color:#64748b;font-size:10px;margin-top:3px}@media(max-width:850px){.gf-two{grid-template-columns:1fr}.gf-cells{grid-template-columns:repeat(4,minmax(72px,1fr))}}
  `;document.head.appendChild(style);

  const badge=$('gfBadge'),status=$('gfStatus'),gridCanvas=$('gfGridCanvas'),cellsBox=$('gfCells'),gridState=$('gfGridState'),candidate=$('gfCandidate'),checksum=$('gfChecksum'),companyEl=$('gfCompany'),review=$('gfReview'),apply=$('gfApply');
  let recognizer=null,lastResults=[],lastGrid=null;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const onlyDigits=s=>String(s||'').replace(/\D/g,'');

  function validBanLocal(v){
    if(typeof validBan==='function')return validBan(v);
    if(!/^\d{8}$/.test(v))return false;const w=[1,2,1,2,1,2,4,1];let s=0;for(let i=0;i<8;i++){const p=+v[i]*w[i];s+=Math.floor(p/10)+(p%10)}return s%5===0||(v[6]==='7'&&(s+1)%5===0);
  }
  function companyBan(){return onlyDigits($('companyBan')?.value).slice(0,8)}
  function setStatus(cls,text){status.className=cls;status.textContent=text}

  async function getCV(){
    if(window.cv){if(typeof window.cv.then==='function')return await window.cv;if(window.cv.Mat)return window.cv}
    let s=document.querySelector('script[data-gf-opencv]');if(!s){s=document.createElement('script');s.dataset.gfOpencv='1';s.src='https://docs.opencv.org/4.x/opencv.js';s.async=true;document.head.appendChild(s)}
    for(let i=0;i<160;i++){if(window.cv){if(typeof window.cv.then==='function'){try{return await window.cv}catch{}}else if(window.cv.Mat)return window.cv}await sleep(200)}throw new Error('OpenCV.js 載入逾時');
  }
  async function loadRecognizer(){
    if(recognizer)return recognizer;badge.textContent='載入數字模型';const mod=await import('https://cdn.jsdelivr.net/npm/browser-handwritten-digit-recognition@1.0.2/index.js');if(typeof mod.recognizeDigit!=='function')throw new Error('MNIST模型無法載入');recognizer=mod.recognizeDigit;return recognizer;
  }
  function canvasFromImage(img){
    if(!img||!img.src)return null;const c=document.createElement('canvas'),w=img.naturalWidth||img.width,h=img.naturalHeight||img.height;if(w<10||h<10)return null;c.width=w;c.height=h;c.getContext('2d',{willReadFrequently:true}).drawImage(img,0,0,w,h);return c;
  }
  function groupPeaks(vals,thr){
    const out=[];let s=-1;for(let i=0;i<=vals.length;i++){const on=i<vals.length&&vals[i]>=thr;if(on&&s<0)s=i;if(!on&&s>=0){let best=s,bv=-1,sw=0,sx=0;for(let k=s;k<i;k++){const v=vals[k];if(v>bv){bv=v;best=k}sw+=v;sx+=k*v}out.push({x:sw?Math.round(sx/sw):best,strength:bv,a:s,b:i-1});s=-1}}return out;
  }
  function selectNine(cands,W){
    if(cands.length<9)return null;let best=null;
    for(let si=0;si<cands.length-8;si++)for(let ei=si+8;ei<cands.length;ei++){
      const start=cands[si].x,end=cands[ei].x,span=end-start;if(span<W*.25)continue;const sp=span/8;if(sp<7)continue;let chosen=[],last=-1,err=0,ok=true;
      for(let k=0;k<9;k++){const target=start+k*sp;let bj=-1,bd=1e9;for(let j=last+1;j<cands.length;j++){const d=Math.abs(cands[j].x-target);if(d<bd&&d<=sp*.34){bd=d;bj=j}}if(bj<0){ok=false;break}chosen.push(cands[bj]);last=bj;err+=(bd/sp)*(bd/sp)}
      if(!ok)continue;const ds=[];for(let i=0;i<8;i++)ds.push(chosen[i+1].x-chosen[i].x);const av=ds.reduce((a,b)=>a+b,0)/8,variance=ds.reduce((a,b)=>a+(b-av)*(b-av),0)/8,score=err+2*Math.sqrt(variance)/av;
      if(!best||score<best.score)best={score,lines:chosen};
    }return best;
  }
  function longestRun(bits){let best=null,s=-1;for(let i=0;i<=bits.length;i++){const on=i<bits.length&&bits[i];if(on&&s<0)s=i;if(!on&&s>=0){if(!best||i-1-s>best[1]-best[0])best=[s,i-1];s=-1}}return best}
  function median(a){const b=a.slice().sort((x,y)=>x-y),n=b.length;return n?b[Math.floor(n/2)]:0}

  async function detectGrid(src){
    const cv=await getCV(),mat=cv.imread(src),gray=new cv.Mat(),bw=new cv.Mat(),hor=new cv.Mat(),ver=new cv.Mat();
    try{
      cv.cvtColor(mat,gray,cv.COLOR_RGBA2GRAY,0);cv.adaptiveThreshold(gray,bw,255,cv.ADAPTIVE_THRESH_GAUSSIAN_C,cv.THRESH_BINARY_INV,31,12);
      const hk=cv.getStructuringElement(cv.MORPH_RECT,new cv.Size(Math.max(25,Math.round(src.width*.09)),1));const vk=cv.getStructuringElement(cv.MORPH_RECT,new cv.Size(1,Math.max(10,Math.round(src.height*.18))));
      cv.morphologyEx(bw,hor,cv.MORPH_OPEN,hk);cv.morphologyEx(bw,ver,cv.MORPH_OPEN,vk);hk.delete();vk.delete();
      const vp=new Array(ver.cols).fill(0);for(let y=0;y<ver.rows;y++){const off=y*ver.cols;for(let x=0;x<ver.cols;x++)if(ver.data[off+x]>0)vp[x]++}
      const vmax=Math.max(...vp,1),vc=groupPeaks(vp,Math.max(3,vmax*.30)),sel=selectNine(vc,ver.cols);if(!sel)return {ok:false,reason:`只找到 ${vc.length} 個直線候選，未形成完整8格`};
      const xs=sel.lines.map(v=>v.x),runs=[],r=Math.max(2,Math.round(src.width*.0025));
      for(const x of xs){const bits=new Array(ver.rows).fill(false);for(let y=0;y<ver.rows;y++){const off=y*ver.cols;for(let xx=Math.max(0,x-r);xx<=Math.min(ver.cols-1,x+r);xx++){if(ver.data[off+xx]>0){bits[y]=true;break}}}const run=longestRun(bits);if(run&&run[1]-run[0]>ver.rows*.12)runs.push(run)}
      if(runs.length<5)return {ok:false,reason:'9條垂直邊界已找到，但上下格線範圍不完整'};const top=median(runs.map(r=>r[0])),bottom=median(runs.map(r=>r[1]));if(bottom-top<src.height*.12)return {ok:false,reason:'8格高度不足，拒絕進行數字辨識'};
      return {ok:true,xs,top,bottom,score:sel.score};
    }finally{mat.delete();gray.delete();bw.delete();hor.delete();ver.delete()}
  }

  function otsuThreshold(gray){const hist=new Array(256).fill(0);for(const g of gray)hist[g]++;let total=gray.length,sum=0;for(let i=0;i<256;i++)sum+=i*hist[i];let wb=0,sb=0,best=-1,thr=150;for(let t=0;t<256;t++){wb+=hist[t];if(!wb)continue;const wf=total-wb;if(!wf)break;sb+=t*hist[t];const mb=sb/wb,mf=(sum-sb)/wf,v=wb*wf*(mb-mf)*(mb-mf);if(v>best){best=v;thr=t}}return thr}
  function cleanCell(src,left,right,top,bottom){
    const px=Math.max(2,Math.round((right-left)*.10)),py=Math.max(2,Math.round((bottom-top)*.10)),sx=left+px,sy=top+py,sw=Math.max(2,right-left-px*2),sh=Math.max(2,bottom-top-py*2);
    const raw=document.createElement('canvas');raw.width=112;raw.height=112;const ctx=raw.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#fff';ctx.fillRect(0,0,112,112);ctx.drawImage(src,sx,sy,sw,sh,5,5,102,102);
    const im=ctx.getImageData(0,0,112,112),d=im.data,gr=new Uint8Array(112*112);for(let i=0;i<gr.length;i++)gr[i]=Math.round(.299*d[i*4]+.587*d[i*4+1]+.114*d[i*4+2]);const th=otsuThreshold(gr),ink=new Uint8Array(gr.length);for(let i=0;i<gr.length;i++)ink[i]=gr[i]<th?1:0;
    for(let y=0;y<112;y++)for(let x=0;x<112;x++)if(x<7||x>=105||y<7||y>=105)ink[y*112+x]=0;
    const seen=new Uint8Array(ink.length),labels=[],Q=new Int32Array(ink.length);for(let y=7;y<105;y++)for(let x=7;x<105;x++){const idx=y*112+x;if(!ink[idx]||seen[idx])continue;let qs=0,qe=0,area=0,minX=x,maxX=x,minY=y,maxY=y;Q[qe++]=idx;seen[idx]=1;const pts=[];while(qs<qe){const q=Q[qs++],cy=Math.floor(q/112),cx=q%112;pts.push(q);area++;if(cx<minX)minX=cx;if(cx>maxX)maxX=cx;if(cy<minY)minY=cy;if(cy>maxY)maxY=cy;const ns=[q-1,q+1,q-112,q+112];for(const ni of ns){if(ni<0||ni>=ink.length||seen[ni]||!ink[ni])continue;const ny=Math.floor(ni/112),nx=ni%112;if(nx<7||nx>=105||ny<7||ny>=105)continue;seen[ni]=1;Q[qe++]=ni}}
      const w=maxX-minX+1,h=maxY-minY+1,cx=(minX+maxX)/2;const thinLine=(w>112*.55&&h<112*.12)||(h>112*.70&&w<112*.07),tiny=area<10,edgeFrag=(minY<9&&h<26)||(maxY>102&&h<26);if(!tiny&&!thinLine&&!edgeFrag&&!(cx<10||cx>102))labels.push({area,pts});}
    labels.sort((a,b)=>b.area-a.area);const keep=new Uint8Array(ink.length);for(const c of labels.slice(0,5))for(const p of c.pts)keep[p]=1;
    const out=document.createElement('canvas');out.width=112;out.height=112;const oc=out.getContext('2d'),oi=oc.createImageData(112,112);for(let i=0;i<keep.length;i++){const v=keep[i]?0:255;oi.data[i*4]=oi.data[i*4+1]=oi.data[i*4+2]=v;oi.data[i*4+3]=255}oc.putImageData(oi,0,0);return out;
  }
  function drawGrid(src,g){gridCanvas.width=src.width;gridCanvas.height=src.height;const c=gridCanvas.getContext('2d');c.drawImage(src,0,0);c.lineWidth=Math.max(2,src.width/350);c.strokeStyle='#e11d48';for(const x of g.xs){c.beginPath();c.moveTo(x,g.top);c.lineTo(x,g.bottom);c.stroke()}c.strokeStyle='#16a34a';for(const y of [g.top,g.bottom]){c.beginPath();c.moveTo(g.xs[0],y);c.lineTo(g.xs[8],y);c.stroke()}}
  function currentDigits(){return [...cellsBox.querySelectorAll('input[data-gf]')].map(x=>x.value.replace(/\D/g,'').slice(0,1)).join('')}
  function refresh(){const d=currentDigits(),valid=d.length===8&&validBanLocal(d),company=companyBan(),match=!!company&&d===company;candidate.textContent=d||'—';checksum.textContent=d.length===8?(valid?'✅ 通過（只驗證）':'❌ 未通過'):'尚未8碼';companyEl.textContent=!company?'未設定申報單位':match?'✅ 相同':'不相同';apply.disabled=!(d.length===8&&valid);if(d.length!==8){review.className='warn';review.textContent='⚠ 尚未取得完整8碼。'}else if(!valid){review.className='warn';review.textContent='⚠ 逐格讀值未通過統編檢查；請看8個乾淨格子逐格修正。'}else if(company&&!match){review.className='warn';review.textContent='⚠ 讀值與申報單位不同，不自動列為進項。'}else{review.className='ok';review.textContent='✓ 8格讀值完整；仍需人工確認後套用。'}}

  async function recognizeCleanCells(clean){
    const rec=await loadRecognizer(),results=[];let worker=null;try{if(window.Tesseract)worker=await Tesseract.createWorker('eng',1)}catch{}
    for(let i=0;i<8;i++){
      badge.textContent=`辨識 ${i+1}/8`;let mn=null,tx=null;try{mn=await rec(clean[i])}catch{}if(worker){try{await worker.setParameters({tessedit_char_whitelist:'0123456789',tessedit_pageseg_mode:'10'});const r=await worker.recognize(clean[i]);const s=onlyDigits(r.data.text);if(s)tx={digit:+s[0],confidence:(Number(r.data.confidence)||0)/100}}catch{}}
      let digit=mn?.digit??tx?.digit??null,confidence=Number(mn?.confidence)||0,source='MNIST';if(mn&&tx&&mn.digit===tx.digit){confidence=Math.max(confidence,tx.confidence);source='MNIST＋OCR一致'}else if(!mn&&tx){confidence=tx.confidence;source='單格OCR'}results.push({digit,confidence,source,canvas:clean[i],ocr:tx?.digit});
    }try{await worker?.terminate()}catch{}return results;
  }
  function renderResults(res){lastResults=res;cellsBox.innerHTML='';res.forEach((r,i)=>{const box=document.createElement('div');box.className='gf-cell '+(r.confidence>=.75?'good':r.confidence<.45?'low':'');box.appendChild(r.canvas);const inp=document.createElement('input');inp.dataset.gf='1';inp.inputMode='numeric';inp.maxLength=1;inp.value=r.digit==null?'':String(r.digit);inp.oninput=()=>{inp.value=inp.value.replace(/\D/g,'').slice(0,1);refresh()};const sm=document.createElement('small');sm.textContent=`第${i+1}格｜${r.source} ${(r.confidence*100).toFixed(0)}%`;box.appendChild(inp);box.appendChild(sm);cellsBox.appendChild(box)});refresh()}
  function clearLegacyBuyer(){
    try{if(state?.candidates?.buyer)state.candidates.buyer=state.candidates.buyer.filter(c=>!/手寫買受人統編|V0\.35 8格框線|V0\.37/i.test(c.source||''));if(!state.qrBuyerAbsent){$('buyer').value='';setSource('buyer','V0.37.3：等待8格人工確認')}chooseFields();}catch{}
  }
  async function run(){
    const img=$('roiBuyerBan');if(!img||!img.src){badge.textContent='無ROI';setStatus('warn','尚未產生「③ 買受人統編8格」ROI，請先執行一次發票辨識。');return}
    if(!img.complete)await new Promise(r=>{img.onload=r;img.onerror=r});const src=canvasFromImage(img);if(!src){setStatus('warn','買受人統編ROI載入失敗。');return}
    clearLegacyBuyer();badge.textContent='抓格線';setStatus('info','正在以印刷直線幾何找9條垂直邊界與上下格線…');cellsBox.innerHTML='';candidate.textContent='—';apply.disabled=true;
    try{const g=await detectGrid(src);lastGrid=g;if(!g.ok){gridState.textContent='❌ 未形成完整8格';badge.textContent='格線失敗';setStatus('warn','⚠ '+g.reason+'。依規則停止：不進行數字辨識。');review.className='warn';review.textContent='請調整照片或ROI；系統不會在格線不完整時猜統編。';return}drawGrid(src,g);gridState.textContent='✅ 9條垂直＋上下格線';badge.textContent='8格已取出';
      const clean=[];for(let i=0;i<8;i++)clean.push(cleanCell(src,g.xs[i],g.xs[i+1],g.top,g.bottom));setStatus('info','✓ 已精準取出8格並去除格線／外部文字；現在才開始數字辨識…');const res=await recognizeCleanCells(clean);renderResults(res);badge.textContent='辨識完成';setStatus('ok','✓ 流程完成：先格線→8格→去其餘內容→逐格數字辨識。請人工核對8格。');
    }catch(e){badge.textContent='處理失敗';setStatus('warn','格線／數字處理失敗：'+(e.message||e))}
  }

  $('gfRun').onclick=run;apply.onclick=()=>{const d=currentDigits();if(d.length!==8||!validBanLocal(d)){review.className='warn';review.textContent='⚠ 請先逐格修正為完整且通過檢查的8碼。';return}try{addCandidate('buyer',d,'人工確認：V0.37.3 格線先行8格辨識',180);$('buyer').value=d;setSource('buyer','人工確認：V0.37.3 格線先行8格辨識');chooseFields();validateRecognition();renderSourceDetail();review.className='ok';review.textContent=`✓ 已人工確認並套用買受人統編 ${d}。`}catch(e){review.className='warn';review.textContent='套用失敗：'+(e.message||e)}};

  const prevScan=scanBtn.onclick;scanBtn.onclick=async function(){await prevScan.call(scanBtn);const type=$('invoiceType')?.value||'auto';if(type==='electronic'||state.qr.length)return;await sleep(100);await run()};
})();
