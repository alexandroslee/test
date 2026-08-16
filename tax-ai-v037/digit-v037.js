// V0.37 - MNIST CNN per-cell handwritten digit recognition.
// Keeps V0.35/V0.36 UI. Uses browser-handwritten-digit-recognition (MIT),
// backed by MNIST-8 CNN. It runs only after V0.36 has perspective-corrected
// and split the buyer BAN into eight cells.
(function(){
  const $=id=>document.getElementById(id);
  const p36=$('perspectiveV036Panel');
  if(!p36)return;

  const subtitle=document.querySelector('.top .muted');
  if(subtitle)subtitle.textContent='V0.37｜V0.35 介面＋8格透視拉正＋MNIST CNN逐格手寫辨識';
  const hero=document.querySelector('.hero');
  if(hero)hero.innerHTML='<b>V0.37 辨識策略：</b>完整保留 V0.35 介面；手開三聯式先做版面定位 → V0.36 將「買受人統編」8 格透視拉正 → <b>每格去邊框／正規化 → MNIST CNN 逐格判斷 0～9＋信心值</b> → 組成 8 碼 → 統編檢查碼＋申報單位比對 → 人工確認後套用。';
  const scanBtn=$('scan');
  if(scanBtn)scanBtn.textContent='✨ 執行 V0.37 版面解析＋透視拉正＋逐格辨識';

  const panel=document.createElement('div');
  panel.className='card section';
  panel.id='digitV037Panel';
  panel.innerHTML=`
    <div class="section-title"><div><h2>🧠 8. 8 格逐格手寫數字辨識</h2>
      <div class="muted">V0.36 拉正後的 8 個格子 → 去除格線邊緣 → 單格正規化 → MNIST-8 CNN → 每格數字＋信心值。低信心不自動覆寫報稅欄位。</div></div>
      <span id="d37Badge" class="pill">等待 8 格</span>
    </div>
    <div id="d37Status" class="info">請先在上方 V0.36 完成「透視拉正」，產生 8 個格子。</div>
    <div class="actions" style="margin-top:10px">
      <button id="d37Run" class="btn primary">🧠 逐格 MNIST 辨識</button>
      <button id="d37Rerun" class="btn ghost">重新辨識</button>
    </div>
    <div id="d37Cells" class="d37-cells" style="margin-top:12px"></div>
    <div class="two" style="margin-top:14px">
      <div>
        <div class="row"><span>8 格組合結果</span><b id="d37Candidate">—</b></div>
        <div class="row"><span>平均信心</span><b id="d37Mean">—</b></div>
        <div class="row"><span>最低單格信心</span><b id="d37Min">—</b></div>
        <div class="row"><span>統編檢查</span><b id="d37Checksum">—</b></div>
        <div class="row"><span>申報單位比對</span><b id="d37Company">—</b></div>
      </div>
      <div>
        <div id="d37Review" class="warn">尚未辨識。</div>
        <div class="actions" style="margin-top:10px"><button id="d37Apply" class="btn secondary" disabled>✓ 人工確認後套用為買方統編</button></div>
        <div class="muted small" style="margin-top:8px">模型來源：browser-handwritten-digit-recognition / MNIST-8 CNN（MIT）。本版為技術雛型；發票真實筆跡與 MNIST 有 domain gap，低信心必須人工確認。</div>
      </div>
    </div>`;
  p36.insertAdjacentElement('afterend',panel);

  const style=document.createElement('style');
  style.textContent=`
    .d37-cells{display:grid;grid-template-columns:repeat(8,minmax(72px,1fr));gap:7px;overflow-x:auto}
    .d37-cell{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:6px;text-align:center;min-width:76px}
    .d37-cell canvas{width:100%;aspect-ratio:1/1;background:#fff;border:1px solid #e5e7eb;border-radius:7px;display:block}
    .d37-cell input{width:100%;text-align:center;margin-top:6px;font-size:22px;font-weight:900;padding:6px 2px;border:1px solid #cbd5e1;border-radius:8px}
    .d37-cell small{display:block;margin-top:4px;color:#64748b;font-size:11px}
    .d37-cell.low{border-color:#f59e0b;background:#fffaf0}.d37-cell.high{border-color:#22c55e;background:#f0fdf4}
    @media(max-width:860px){.d37-cells{grid-template-columns:repeat(4,minmax(76px,1fr))}}
  `;
  document.head.appendChild(style);

  const badge=$('d37Badge'),status=$('d37Status'),cellsOut=$('d37Cells');
  const candidateEl=$('d37Candidate'),meanEl=$('d37Mean'),minEl=$('d37Min'),checkEl=$('d37Checksum'),companyEl=$('d37Company'),reviewEl=$('d37Review'),applyBtn=$('d37Apply');
  let recognizer=null,last=[];

  function setStatus(cls,text){status.className=cls;status.textContent=text}
  function getGridCanvases(){return [...document.querySelectorAll('#p36Cells .p36-cell canvas')].slice(0,8)}
  function validBanLocal(v){
    if(typeof window.validBan==='function')return window.validBan(v);
    if(!/^\d{8}$/.test(v))return false;
    const w=[1,2,1,2,1,2,4,1],s=v.split('').reduce((a,n,i)=>{const p=+n*w[i];return a+Math.floor(p/10)+p%10},0);
    if(s%5===0)return true;
    if(v[6]==='7')return (s+1)%5===0;
    return false;
  }
  function companyBan(){const el=$('companyBan');return String(el?.value||'').replace(/\D/g,'').slice(0,8)}
  function normalizeCell(src){
    const W=src.width,H=src.height;
    const crop=document.createElement('canvas');crop.width=140;crop.height=140;
    const ctx=crop.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#fff';ctx.fillRect(0,0,140,140);
    const mx=Math.max(5,Math.round(W*.13)),my=Math.max(5,Math.round(H*.11));
    ctx.drawImage(src,mx,my,Math.max(1,W-mx*2),Math.max(1,H-my*2),8,8,124,124);
    const im=ctx.getImageData(0,0,140,140),d=im.data;
    let bg=0,n=0;for(let y=0;y<140;y+=8)for(let x=0;x<140;x+=8){if(x<18||x>121||y<18||y>121){const i=(y*140+x)*4;bg+=(d[i]+d[i+1]+d[i+2])/3;n++}}
    bg/=Math.max(1,n);const thr=Math.max(95,Math.min(215,bg*.78));
    for(let i=0;i<d.length;i+=4){const g=.299*d[i]+.587*d[i+1]+.114*d[i+2];const v=g<thr?0:255;d[i]=d[i+1]=d[i+2]=v;d[i+3]=255}
    const edge=7;for(let y=0;y<140;y++)for(let x=0;x<140;x++){if(x<edge||x>=140-edge||y<edge||y>=140-edge){const i=(y*140+x)*4;d[i]=d[i+1]=d[i+2]=255}}
    ctx.putImageData(im,0,0);return crop;
  }
  async function loadRecognizer(){
    if(recognizer)return recognizer;
    badge.textContent='載入模型';setStatus('info','正在載入 MNIST-8 CNN 手寫數字引擎…');
    const mod=await import('https://cdn.jsdelivr.net/npm/browser-handwritten-digit-recognition@1.0.2/index.js');
    if(typeof mod.recognizeDigit!=='function')throw new Error('MNIST recognizer module unavailable');
    recognizer=mod.recognizeDigit;return recognizer;
  }
  function currentDigits(){return [...cellsOut.querySelectorAll('input[data-digit]')].map(x=>x.value.replace(/\D/g,'').slice(0,1)).join('')}
  function refreshSummary(){
    const digits=currentDigits();candidateEl.textContent=digits||'—';
    const confs=last.map(x=>x.confidence||0);const mean=confs.length?confs.reduce((a,b)=>a+b,0)/confs.length:0,min=confs.length?Math.min(...confs):0;
    meanEl.textContent=confs.length?(mean*100).toFixed(1)+'%':'—';minEl.textContent=confs.length?(min*100).toFixed(1)+'%':'—';
    const valid=digits.length===8&&validBanLocal(digits);checkEl.textContent=digits.length===8?(valid?'✅ 通過':'❌ 未通過'):'尚未 8 碼';
    const c=companyBan();companyEl.textContent=!c?'未設定申報單位':digits===c?'✅ 等於申報單位統編':'不相同';
    const low=confs.some(v=>v<.70),medium=confs.some(v=>v<.82);
    applyBtn.disabled=digits.length!==8||!valid;
    if(digits.length!==8){reviewEl.className='warn';reviewEl.textContent='⚠ 尚未取得完整 8 碼，請逐格人工修正。'}
    else if(!valid){reviewEl.className='warn';reviewEl.textContent='⚠ 8 碼未通過統編檢查，請逐格核對；系統不會為了湊成合法統編自行改數字。'}
    else if(low){reviewEl.className='warn';reviewEl.textContent='⚠ 統編合法，但至少一格 CNN 信心低於 70%，必須人工核對。'}
    else if(medium){reviewEl.className='warn';reviewEl.textContent='⚠ 統編合法，但仍有中等信心格，建議人工確認後再套用。'}
    else{reviewEl.className='ok';reviewEl.textContent='✓ 8 格皆具較高信心且統編檢查通過；仍需人工確認後才能套用。'}
  }
  function renderResults(results){
    cellsOut.innerHTML='';last=results;
    results.forEach((r,i)=>{
      const box=document.createElement('div');box.className='d37-cell '+(r.confidence>=.82?'high':r.confidence<.70?'low':'');
      box.appendChild(r.canvas);
      const inp=document.createElement('input');inp.dataset.digit='1';inp.inputMode='numeric';inp.maxLength=1;inp.value=r.digit==null?'':String(r.digit);
      inp.addEventListener('input',()=>{inp.value=inp.value.replace(/\D/g,'').slice(0,1);refreshSummary()});
      const sm=document.createElement('small');sm.textContent=`第 ${i+1} 格｜CNN ${(r.confidence*100).toFixed(1)}%`;
      box.appendChild(inp);box.appendChild(sm);cellsOut.appendChild(box);
    });
    refreshSummary();
  }
  async function runRecognition(){
    const src=getGridCanvases();
    if(src.length!==8){badge.textContent='等待 8 格';setStatus('warn','尚未找到 V0.36 的 8 個切割格。請先按上方「📐 透視拉正」。');return}
    try{
      const recognize=await loadRecognizer();badge.textContent='辨識中';setStatus('info','正在逐格執行 MNIST CNN…');
      const results=[];
      for(let i=0;i<8;i++){
        setStatus('info',`正在辨識第 ${i+1} / 8 格…`);
        const clean=normalizeCell(src[i]);
        const pred=await recognize(clean);
        results.push({canvas:clean,digit:pred?.digit??null,confidence:Number(pred?.confidence)||0});
      }
      renderResults(results);badge.textContent='已辨識';setStatus('ok','✓ 已完成 8 格逐格 CNN 辨識。請檢查每格數字與信心值，再人工確認。');
    }catch(e){badge.textContent='模型失敗';setStatus('warn','MNIST CNN 載入或辨識失敗：'+(e.message||e)+'。可保留 V0.36 的人工逐格流程。')}
  }
  $('d37Run').onclick=runRecognition;$('d37Rerun').onclick=runRecognition;
  applyBtn.onclick=()=>{
    const d=currentDigits();if(d.length!==8||!validBanLocal(d)){reviewEl.className='warn';reviewEl.textContent='⚠ 請先人工修正到完整且通過統編檢查的 8 碼。';return}
    const buyer=$('buyer');if(buyer){buyer.value=d;if(typeof window.setSource==='function')window.setSource('buyer','人工確認：V0.37 8格 MNIST CNN');}
    if(typeof window.addCandidate==='function')window.addCandidate('buyer',d,'人工確認：V0.37 8格 MNIST CNN',130);
    try{if(typeof window.chooseFields==='function')window.chooseFields();if(typeof window.validateRecognition==='function')window.validateRecognition();if(typeof window.renderSourceDetail==='function')window.renderSourceDetail()}catch{}
    reviewEl.className='ok';reviewEl.textContent=`✓ 已人工確認並套用買受人統編 ${d}。`;
  };
  const p36Cells=$('p36Cells');
  if(p36Cells){new MutationObserver(()=>{if(getGridCanvases().length===8){badge.textContent='8格已就緒';setStatus('info','V0.36 已產生 8 格，可以執行 MNIST CNN 逐格辨識。')}}).observe(p36Cells,{childList:true,subtree:true})}
})();
