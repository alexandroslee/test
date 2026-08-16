// V0.37.1 SAFE - 8-cell MNIST CNN recognition integrated into Section 5.
// Checksum is validation only; never mutates CNN/OCR digits.
(function(){
  const $=id=>document.getElementById(id);
  const p36=$('perspectiveV036Panel'); if(!p36)return;
  const scanBtn=$('scan');
  const subtitle=document.querySelector('.top .muted');
  if(subtitle)subtitle.textContent='V0.37.1｜V0.35 介面＋8格透視拉正＋MNIST逐格辨識（安全修正）';
  const hero=document.querySelector('.hero');
  if(hero)hero.innerHTML='<b>V0.37.1：</b>保留 V0.35 介面。手開三聯式：左上「統一編號」8 格 → 透視拉正 → <b>去格線／置中正規化 → MNIST CNN 逐格 0～9</b> → 組成 8 碼。<b>統編檢查碼只驗證，絕不反推或改寫辨識數字。</b>';
  if(scanBtn)scanBtn.textContent='✨ 執行 V0.37.1：8格拉正＋逐格辨識';

  const panel=document.createElement('div'); panel.className='card section'; panel.id='digitV037Panel';
  panel.innerHTML=`
    <div class="section-title"><div><h2>🧠 8. 8 格逐格手寫數字辨識</h2>
      <div class="muted">V0.36 拉正後：先去除格線與邊界殘留，只保留中央手寫筆畫；每格獨立 MNIST CNN。信心不足時不產生「合法候選」。</div></div>
      <span id="d37Badge" class="pill">等待 8 格</span>
    </div>
    <div id="d37Status" class="info">請先完成上方 V0.36「透視拉正」，或直接按第 5 區的「8格拉正＋CNN重新辨識」。</div>
    <div class="actions" style="margin-top:10px"><button id="d37Run" class="btn primary">🧠 逐格 MNIST 辨識</button><button id="d37Rerun" class="btn ghost">重新辨識</button></div>
    <div id="d37Cells" class="d37-cells" style="margin-top:12px"></div>
    <div class="two" style="margin-top:14px"><div>
      <div class="row"><span>8 格組合結果</span><b id="d37Candidate">—</b></div>
      <div class="row"><span>平均信心</span><b id="d37Mean">—</b></div>
      <div class="row"><span>最低單格信心</span><b id="d37Min">—</b></div>
      <div class="row"><span>統編檢查</span><b id="d37Checksum">—</b></div>
      <div class="row"><span>申報單位比對</span><b id="d37Company">—</b></div>
    </div><div>
      <div id="d37Review" class="warn">尚未辨識。</div>
      <div class="actions" style="margin-top:10px"><button id="d37Apply" class="btn secondary" disabled>✓ 人工確認後套用為買方統編</button></div>
      <div class="muted small" style="margin-top:8px">模型只提供候選。報稅欄位必須由人工確認；檢查碼不能把低信心辨識升級成可信資料。</div>
    </div></div>`;
  p36.insertAdjacentElement('afterend',panel);

  const style=document.createElement('style');
  style.textContent=`
    .d37-cells{display:grid;grid-template-columns:repeat(8,minmax(72px,1fr));gap:7px;overflow-x:auto}
    .d37-cell{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:6px;text-align:center;min-width:76px}
    .d37-cell canvas{width:100%;aspect-ratio:1/1;background:#000;border:1px solid #e5e7eb;border-radius:7px;display:block;image-rendering:auto}
    .d37-cell input{width:100%;text-align:center;margin-top:6px;font-size:22px;font-weight:900;padding:6px 2px;border:1px solid #cbd5e1;border-radius:8px}
    .d37-cell small{display:block;margin-top:4px;color:#64748b;font-size:11px}
    .d37-cell.low{border-color:#f59e0b;background:#fffaf0}.d37-cell.high{border-color:#22c55e;background:#f0fdf4}
    @media(max-width:860px){.d37-cells{grid-template-columns:repeat(4,minmax(76px,1fr))}}
  `; document.head.appendChild(style);

  const badge=$('d37Badge'),status=$('d37Status'),cellsOut=$('d37Cells');
  const candidateEl=$('d37Candidate'),meanEl=$('d37Mean'),minEl=$('d37Min'),checkEl=$('d37Checksum'),companyEl=$('d37Company'),reviewEl=$('d37Review'),applyBtn=$('d37Apply');
  let recognizer=null,last=[];
  const digits=s=>String(s||'').replace(/\D/g,'');
  function companyBan(){return digits($('companyBan')?.value).slice(0,8)}
  function validBanLocal(v){
    if(typeof window.validBan==='function')return window.validBan(v);
    if(!/^\d{8}$/.test(v))return false;const w=[1,2,1,2,1,2,4,1];let s=0;
    for(let i=0;i<8;i++){const p=+v[i]*w[i];s+=Math.floor(p/10)+p%10}return s%5===0||(v[6]==='7'&&(s+1)%5===0);
  }
  function setStatus(cls,text){status.className=cls;status.textContent=text}
  function getGridCanvases(){return [...document.querySelectorAll('#p36Cells .p36-cell canvas')].slice(0,8)}

  function normalizeCell(src){
    const W=src.width,H=src.height,tmp=document.createElement('canvas');tmp.width=W;tmp.height=H;
    const tctx=tmp.getContext('2d',{willReadFrequently:true});tctx.drawImage(src,0,0);
    const im=tctx.getImageData(0,0,W,H),p=im.data,gray=new Uint8Array(W*H);let hist=new Uint32Array(256),sum=0;
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4,g=Math.max(0,Math.min(255,Math.round(.299*p[i]+.587*p[i+1]+.114*p[i+2])));gray[y*W+x]=g;hist[g]++;sum+=g}
    let total=W*H,sumAll=0,wB=0,maxV=-1,thr=160;for(let i=0;i<256;i++)sumAll+=i*hist[i];let cur=0;
    for(let t=0;t<256;t++){wB+=hist[t];if(!wB)continue;const wF=total-wB;if(!wF)break;cur+=t*hist[t];const mB=cur/wB,mF=(sumAll-cur)/wF,v=wB*wF*(mB-mF)*(mB-mF);if(v>maxV){maxV=v;thr=t}}
    const bin=new Uint8Array(W*H),mx=Math.max(3,Math.round(W*.11)),my=Math.max(3,Math.round(H*.10));
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){const inside=x>=mx&&x<W-mx&&y>=my&&y<H-my;bin[y*W+x]=(inside&&gray[y*W+x]<thr)?1:0}
    const seen=new Uint8Array(W*H),comps=[],qx=new Int32Array(W*H),qy=new Int32Array(W*H);
    for(let y=my;y<H-my;y++)for(let x=mx;x<W-mx;x++){
      const idx=y*W+x;if(!bin[idx]||seen[idx])continue;let qs=0,qe=0,area=0,minX=x,maxX=x,minY=y,maxY=y;qx[qe]=x;qy[qe++]=y;seen[idx]=1;
      while(qs<qe){const cx=qx[qs],cy=qy[qs++];area++;if(cx<minX)minX=cx;if(cx>maxX)maxX=cx;if(cy<minY)minY=cy;if(cy>maxY)maxY=cy;const ns=[[cx-1,cy],[cx+1,cy],[cx,cy-1],[cx,cy+1]];for(const [nx,ny] of ns){if(nx<mx||nx>=W-mx||ny<my||ny>=H-my)continue;const ni=ny*W+nx;if(bin[ni]&&!seen[ni]){seen[ni]=1;qx[qe]=nx;qy[qe++]=ny}}}
      const cw=maxX-minX+1,ch=maxY-minY+1;if(area>=Math.max(6,W*H*.0015)&&!(cw>W*.65&&ch<5)&&!(ch>H*.65&&cw<5))comps.push({area,minX,maxX,minY,maxY});
    }
    comps.sort((a,b)=>b.area-a.area);const keep=comps.slice(0,4);let minX=W,maxX=-1,minY=H,maxY=-1;const mask=new Uint8Array(W*H);
    for(const c of keep){for(let y=c.minY;y<=c.maxY;y++)for(let x=c.minX;x<=c.maxX;x++){const i=y*W+x;if(bin[i]){mask[i]=1;if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y}}}
    const out=document.createElement('canvas');out.width=112;out.height=112;const o=out.getContext('2d',{willReadFrequently:true});o.fillStyle='#000';o.fillRect(0,0,112,112);if(maxX<0)return out;
    const bw=maxX-minX+1,bh=maxY-minY+1,scale=Math.min(78/bw,78/bh),dw=Math.max(1,Math.round(bw*scale)),dh=Math.max(1,Math.round(bh*scale));
    const glyph=document.createElement('canvas');glyph.width=bw;glyph.height=bh;const gc=glyph.getContext('2d'),gi=gc.createImageData(bw,bh);
    for(let y=0;y<bh;y++)for(let x=0;x<bw;x++){const on=mask[(minY+y)*W+(minX+x)],i=(y*bw+x)*4;gi.data[i]=gi.data[i+1]=gi.data[i+2]=on?255:0;gi.data[i+3]=255}gc.putImageData(gi,0,0);o.imageSmoothingEnabled=true;o.drawImage(glyph,0,0,bw,bh,Math.round((112-dw)/2),Math.round((112-dh)/2),dw,dh);return out;
  }

  async function loadRecognizer(){if(recognizer)return recognizer;badge.textContent='載入模型';setStatus('info','正在載入 MNIST-8 CNN…');const mod=await import('https://cdn.jsdelivr.net/npm/browser-handwritten-digit-recognition@1.0.2/index.js');if(typeof mod.recognizeDigit!=='function')throw new Error('MNIST recognizer unavailable');recognizer=mod.recognizeDigit;return recognizer}
  function currentDigits(){return [...cellsOut.querySelectorAll('input[data-digit]')].map(x=>x.value.replace(/\D/g,'').slice(0,1)).join('')}
  function confidenceStats(){const c=last.map(x=>Number(x.confidence)||0);return {c,mean:c.length?c.reduce((a,b)=>a+b,0)/c.length:0,min:c.length?Math.min(...c):0}}
  function refreshSummary(){
    const d=currentDigits(),{c,mean,min}=confidenceStats(),valid=d.length===8&&validBanLocal(d),company=companyBan(),match=!!company&&d===company;
    candidateEl.textContent=d||'—';meanEl.textContent=c.length?(mean*100).toFixed(1)+'%':'—';minEl.textContent=c.length?(min*100).toFixed(1)+'%':'—';checkEl.textContent=d.length===8?(valid?'✅ 通過（僅驗證）':'❌ 未通過'):'尚未 8 碼';companyEl.textContent=!company?'未設定申報單位':match?'✅ 等於申報單位統編':'不相同';
    const reliable=c.length===8&&min>=.60&&mean>=.72;applyBtn.disabled=!(d.length===8&&valid);
    if(d.length!==8){reviewEl.className='warn';reviewEl.textContent='⚠ 未取得完整 8 碼。'}else if(!reliable){reviewEl.className='warn';reviewEl.textContent='⚠ CNN 信心不足：即使檢查碼剛好通過，也不能視為合法候選；請逐格核對。'}else if(!valid){reviewEl.className='warn';reviewEl.textContent='⚠ CNN 結果未通過統編檢查；請逐格核對。'}else if(company&&!match){reviewEl.className='warn';reviewEl.textContent='⚠ 辨識結果與申報單位統編不同；不可自動列為本公司進項。'}else{reviewEl.className='ok';reviewEl.textContent='✓ 辨識品質較佳；仍需人工確認後才能套用。'}
    mirrorSection5(d,c,valid,match,reliable);
  }
  function renderResults(results){cellsOut.innerHTML='';last=results;results.forEach((r,i)=>{const box=document.createElement('div');box.className='d37-cell '+(r.confidence>=.82?'high':r.confidence<.60?'low':'');box.appendChild(r.canvas);const inp=document.createElement('input');inp.dataset.digit='1';inp.inputMode='numeric';inp.maxLength=1;inp.value=r.digit==null?'':String(r.digit);inp.oninput=()=>{inp.value=inp.value.replace(/\D/g,'').slice(0,1);refreshSummary()};const sm=document.createElement('small');sm.textContent=`第 ${i+1} 格｜CNN ${(r.confidence*100).toFixed(1)}%`;box.appendChild(inp);box.appendChild(sm);cellsOut.appendChild(box)});refreshSummary()}
  function mirrorSection5(d,confs,valid,match,reliable){
    const box=$('digitBoxes'),cand=$('handBuyerCandidate'),chk=$('handBuyerChecksum'),cm=$('handBuyerCompanyMatch'),hb=$('handBuyerBadge'),hs=$('handBuyerStatus'),ap=$('applyHandBuyer');if(!box)return;
    box.innerHTML=Array.from({length:8},(_,i)=>`<div class="digitbox ${(confs?.[i]??0)<.60?'low':''}"><input inputmode="numeric" maxlength="1" value="${d?.[i]||''}"><small>${confs?.[i]!=null?(confs[i]*100).toFixed(1):'—'}%</small></div>`).join('');
    const inputs=[...box.querySelectorAll('input')];inputs.forEach(inp=>inp.oninput=()=>{inp.value=inp.value.replace(/\D/g,'').slice(0,1);const v=inputs.map(x=>x.value).join('');cand.textContent=v||'—';chk.textContent=v.length===8?(validBanLocal(v)?'✅ 通過（僅驗證）':'❌ 未通過'):'尚未 8 碼';const c=companyBan();cm.textContent=!c?'未設定申報單位':v===c?'✅ 等於申報單位統編':'不相同';if(ap)ap.disabled=!(v.length===8&&validBanLocal(v))});
    if(cand)cand.textContent=d||'—';if(chk)chk.textContent=d.length===8?(valid?'✅ 通過（僅驗證）':'❌ 未通過'):'尚未 8 碼';if(cm){const c=companyBan();cm.textContent=!c?'未設定申報單位':match?'✅ 等於申報單位統編':'不相同'}if(ap)ap.disabled=!(d.length===8&&valid);
    if(hb)hb.textContent=reliable&&valid&&(match||!companyBan())?'可人工確認':'待人工確認';
    if(hs){hs.className=reliable&&valid&&(match||!companyBan())?'ok':'warn';hs.textContent=reliable&&valid?(match?`✓ 8格 CNN 辨識 ${d}，檢查碼通過且等於申報單位；請人工確認。`:`⚠ 8格 CNN 辨識 ${d}。檢查碼通過只代表格式合理，不代表內容正確；請人工確認。`):`⚠ 8格 CNN 結果 ${d||'不完整'} 信心不足或檢查未通過。系統不會利用檢查碼改寫數字。`}
  }
  async function runRecognition(){const src=getGridCanvases();if(src.length!==8){badge.textContent='等待 8 格';setStatus('warn','尚未找到 V0.36 的 8 格。請先執行透視拉正。');return false}try{const recognize=await loadRecognizer();badge.textContent='辨識中';const results=[];for(let i=0;i<8;i++){setStatus('info',`正在辨識第 ${i+1} / 8 格…`);const clean=normalizeCell(src[i]);const pred=await recognize(clean);results.push({canvas:clean,digit:pred?.digit??null,confidence:Number(pred?.confidence)||0})}renderResults(results);badge.textContent='已辨識';setStatus('ok','✓ 8 格逐格 CNN 已完成；請查看每格清理後圖像與信心值。');return true}catch(e){badge.textContent='模型失敗';setStatus('warn','MNIST CNN 載入或辨識失敗：'+(e.message||e));return false}}
  $('d37Run').onclick=runRecognition;$('d37Rerun').onclick=runRecognition;
  applyBtn.onclick=()=>{const d=currentDigits();if(d.length!==8||!validBanLocal(d)){reviewEl.className='warn';reviewEl.textContent='⚠ 請先人工修正到完整 8 碼且通過檢查。';return}const buyer=$('buyer');if(buyer)buyer.value=d;try{window.setSource?.('buyer','人工確認：V0.37.1 8格 CNN');window.addCandidate?.('buyer',d,'人工確認：V0.37.1 8格 CNN',140);window.chooseFields?.();window.validateRecognition?.();window.renderSourceDetail?.()}catch{}reviewEl.className='ok';reviewEl.textContent=`✓ 已人工確認並套用買受人統編 ${d}。`};
  function waitUntil(fn,timeout=12000){return new Promise((resolve,reject)=>{const t=Date.now(),id=setInterval(()=>{if(fn()){clearInterval(id);resolve(true)}else if(Date.now()-t>timeout){clearInterval(id);reject(new Error('等待逾時'))}},120)})}
  async function orchestrate(){const hbStatus=$('handBuyerStatus'),legacyBtn=$('rerunHandBuyer');if(legacyBtn)legacyBtn.disabled=true;if(hbStatus){hbStatus.className='info';hbStatus.textContent='正在使用 V0.37.1：8格 ROI → 透視拉正 → 去格線 → CNN 逐格辨識…'}try{if(getGridCanvases().length!==8){$('p36Load')?.click();await new Promise(r=>setTimeout(r,350));$('p36Warp')?.click();await waitUntil(()=>getGridCanvases().length===8,15000)}await runRecognition()}catch(e){if(hbStatus){hbStatus.className='warn';hbStatus.textContent='V0.37.1 自動流程失敗：'+(e.message||e)+'。可在第 7 區手動調整四角後再辨識。'}}finally{if(legacyBtn)legacyBtn.disabled=false}}
  const legacyBtn=$('rerunHandBuyer');if(legacyBtn){legacyBtn.textContent='📐 8格拉正＋🧠 CNN 重新辨識';legacyBtn.onclick=orchestrate}
  const p36Cells=$('p36Cells');if(p36Cells)new MutationObserver(()=>{if(getGridCanvases().length===8){badge.textContent='8格已就緒';setStatus('info','8 格已就緒，可執行 CNN 逐格辨識。')}}).observe(p36Cells,{childList:true,subtree:true});
})();
