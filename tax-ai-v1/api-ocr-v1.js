(function(){
  const $=id=>document.getElementById(id);
  const scanBtn=$('scan'); if(!scanBtn) return;
  const GATEWAY='https://tax-ai-v1-gateway.vercel.app';
  const NOTEBOOK='https://colab.research.google.com/github/alexandroslee/test/blob/gh-pages/colab/tax-ai-gemma4-e4b-v13.ipynb';
  const FIELD_IDS=['date','track','number','seller','buyer','net','tax','gross','sellerName'];
  const touched=new Set();
  FIELD_IDS.forEach(id=>{const el=$(id); if(el) el.addEventListener('input',e=>{if(e.isTrusted)touched.add(id)});});
  const gfApply=$('gfApply'); if(gfApply) gfApply.addEventListener('click',()=>setTimeout(()=>touched.add('buyer'),0));

  const subtitle=document.querySelector('.top .muted');
  if(subtitle) subtitle.textContent='V1.3｜Colab GPU Gemma 4 E4B＋api-ocr-2025＋8格專用VLM＋自動備援';
  const hero=document.querySelector('.hero');
  if(hero) hero.innerHTML='<b>V1.3 實用版：</b>整張發票由 <b>api-ocr-2025 + Gemma 4 E4B</b> 辨識；買受人統編再用「格線先行」切出的 8 格做第二次專用 VLM 驗證。Vercel Proxy 最長等待 5 分鐘；失敗會自動改走 Colab 直連。AI 不覆寫你已人工修改的欄位。';
  scanBtn.textContent='✨ V1.3：本地＋整張 VLM＋8格專用 VLM';

  const card=document.createElement('div');
  card.className='card section'; card.id='apiOcrV13Card';
  card.innerHTML=`
    <div class="section-title"><div><h2>🧠 V1.3 GPU 辨識中心</h2>
      <div class="muted">GitHub Pages → Vercel HTTPS Proxy → Colab GPU → api-ocr-2025 → Gemma 4 E4B；Proxy 失敗時自動直連 Colab。</div></div>
      <span id="v13Badge" class="pill">等待 Colab</span></div>
    <div class="form" style="margin-top:12px">
      <div class="field full"><label>Colab Backend URL</label><input id="v13Colab" placeholder="https://xxxxx.trycloudflare.com"></div>
    </div>
    <div class="actions" style="margin-top:10px">
      <a id="v13OpenColab" class="btn secondary" target="_blank" rel="noopener">▶ 開啟 Colab V1.3</a>
      <button id="v13Save" class="btn ghost">儲存 URL</button>
      <button id="v13Health" class="btn secondary">🩺 完整健康檢查</button>
      <button id="v13Run" class="btn primary">🚀 整張發票辨識</button>
      <button id="v13Buyer" class="btn secondary">🔢 只辨識買受人 8 格</button>
    </div>
    <div id="v13Status" class="info" style="margin-top:10px">先啟動 Colab V1.3，取得 trycloudflare.com URL。</div>
    <div id="v13Timer" class="muted small" style="margin-top:8px"></div>
    <div id="v13Result" style="margin-top:10px"></div>`;
  const companyCard=$('companyName')?.closest('.card');
  if(companyCard) companyCard.insertAdjacentElement('afterend',card); else document.querySelector('.card')?.insertAdjacentElement('afterend',card);
  const colabEl=$('v13Colab'), badge=$('v13Badge'), status=$('v13Status'), timerEl=$('v13Timer'), resultBox=$('v13Result');
  let savedColab='';try{savedColab=localStorage.getItem('taxAiColabBackendUrl')||''}catch{} colabEl.value=savedColab; $('v13OpenColab').href=NOTEBOOK;
  const setStatus=(cls,text)=>{status.className=cls;status.textContent=text};
  function colabUrl(){return String(colabEl.value||'').trim().replace(/\/+$/,'')}
  function validColab(){try{const u=new URL(colabUrl());return u.protocol==='https:'&&u.hostname.endsWith('.trycloudflare.com')}catch{return false}}
  function proxyHeaders(){return {'X-Colab-Backend':colabUrl()}}
  function getFile(){try{if(typeof state!=='undefined'&&state.file)return state.file}catch{} for(const id of ['camera','purchase','sales']){const f=$(id)?.files?.[0];if(f)return f} return null}
  function startTimer(label){const t0=performance.now();timerEl.textContent=label+' 0 秒';const h=setInterval(()=>timerEl.textContent=`${label} ${Math.round((performance.now()-t0)/1000)} 秒`,1000);return ()=>{clearInterval(h);timerEl.textContent=`${label} 完成｜${Math.round((performance.now()-t0)/100)/10} 秒`;}}
  async function fetchJson(url,opts={},timeoutMs=295000){const ac=new AbortController();const id=setTimeout(()=>ac.abort(),timeoutMs);try{const r=await fetch(url,{...opts,signal:ac.signal});const text=await r.text();let j=null;try{j=text?JSON.parse(text):{}}catch{j={detail:text||('HTTP '+r.status)}};if(!r.ok){const e=new Error(j?.detail||('HTTP '+r.status));e.status=r.status;throw e}return j}finally{clearTimeout(id)}}
  async function requestWithFallback(path,opts={},timeoutMs=295000){
    let proxyError=null;
    try{return {data:await fetchJson(GATEWAY+path,{...opts,headers:{...(opts.headers||{}),...proxyHeaders()}},timeoutMs),via:'Vercel Proxy'}}catch(e){proxyError=e}
    try{return {data:await fetchJson(colabUrl()+path,opts,timeoutMs),via:'Colab 直連備援'}}catch(e){e.message=`Proxy: ${proxyError?.message||'失敗'}；Direct: ${e.message}`;throw e}
  }
  async function health(){
    if(!validColab()){badge.textContent='等待 Colab';setStatus('warn','請貼入 Colab 產生的 https://*.trycloudflare.com URL。');return false}
    badge.textContent='檢查中';setStatus('info','檢查 Vercel、api-ocr-2025 與 Gemma Vision…');
    try{
      const g=await fetchJson(GATEWAY+'/health',{},30000);
      const c=await requestWithFallback('/health/vlm',{},90000);
      const s=c.data?.status||'unknown';
      resultBox.innerHTML=`<div class="info"><b>Gateway：</b>${g.version||'—'}｜<b>Colab：</b>${c.via}｜<b>VLM：</b>${s}｜<b>模型：</b>${c.data?.model||'Gemma 4 E4B'}</div>`;
      if(s!=='ok'){badge.textContent='VLM 未完全正常';setStatus('warn','⚠ api-ocr 已連線，但 Gemma 視覺健康檢查不是 ok：'+s);return false}
      badge.textContent='GPU / VLM 正常';setStatus('ok','✓ Vercel、Colab、api-ocr-2025、Gemma 4 E4B 視覺路徑全部正常。');return true;
    }catch(e){badge.textContent='後端未就緒';setStatus('warn','⚠ 健康檢查失敗：'+(e.message||e));return false}
  }

  const clean=v=>v==null?'':String(v).trim();
  const conflicts=[];
  function markSource(id,src){try{if(typeof setSource==='function')setSource(id,src)}catch{} }
  function applySafe(id,value,src){
    value=clean(value); if(!value) return {state:'empty'};
    const el=$(id); if(!el) return {state:'missing'};
    const cur=clean(el.value);
    try{if(typeof addCandidate==='function')addCandidate(id,value,src,240)}catch{}
    if(touched.has(id)&&cur&&cur!==value){if(!conflicts.some(c=>c.id===id&&c.cur===cur&&c.value===value))conflicts.push({id,cur,value,src});return {state:'conflict',cur,value}}
    el.value=value; markSource(id,src); return {state:cur===value?'verified':'applied',value};
  }
  function renderConflicts(){
    const old=$('v13Conflicts'); if(old)old.remove();
    if(!conflicts.length)return;
    const box=document.createElement('div');box.id='v13Conflicts';box.className='warn';box.style.marginTop='10px';
    box.innerHTML='<b>人工欄位與 VLM 不同，系統沒有自動覆寫：</b>';
    conflicts.forEach(c=>{const row=document.createElement('div');row.style.marginTop='8px';row.textContent=`${c.id}: 目前 ${c.cur} / VLM ${c.value} `;const b=document.createElement('button');b.className='btn small secondary';b.textContent='套用 VLM';b.onclick=()=>{const el=$(c.id);if(el){el.value=c.value;touched.add(c.id);markSource(c.id,c.src)}row.remove();};row.appendChild(b);box.appendChild(row)});
    resultBox.appendChild(box);
  }
  function mapInvoice(result,via){
    const d=result?.data||result||{},src=`${via}:${result?.source||'api-ocr-2025'}`;
    const inv=clean(d.invoice_number).toUpperCase().replace(/\s/g,''); const m=inv.match(/^([A-Z]{2})-?(\d{8})$/);
    if(m){applySafe('track',m[1],src);applySafe('number',m[2],src)}
    applySafe('date',d.invoice_date,src);applySafe('seller',d.seller_tax_id,src);applySafe('buyer',d.buyer_tax_id,src);
    applySafe('net',d.sales_amount,src);applySafe('tax',d.tax_amount,src);applySafe('gross',d.total_amount,src);applySafe('sellerName',d.seller_name,src);
    const raw=[result?.raw_text||'',...(result?.warnings||[]).map(x=>'⚠ '+x)].filter(Boolean).join('\n');if($('raw')&&raw)$('raw').value=($('raw').value?$('raw').value+'\n\n--- V1.3 Backend ---\n':'')+raw;
    try{if(typeof validateRecognition==='function')validateRecognition()}catch{} try{if(typeof renderSourceDetail==='function')renderSourceDetail()}catch{}
    return d;
  }
  function companyBan(){return clean($('companyBan')?.value).replace(/\D/g,'').slice(0,8)}
  function localGridResult(){return clean($('gfResult')?.textContent).replace(/\D/g,'').slice(0,8)}
  function gridCanvasBlob(){
    const cvs=[...document.querySelectorAll('#gfCells canvas')]; if(cvs.length!==8)return Promise.resolve(null);
    const cell=72,pad=8,out=document.createElement('canvas');out.width=cell*8+pad*2;out.height=cell+pad*2;const x=out.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,out.width,out.height);
    cvs.forEach((c,i)=>{x.fillStyle='#fff';x.fillRect(pad+i*cell,pad,cell,cell);x.drawImage(c,pad+i*cell,pad,cell,cell)});
    return new Promise(ok=>out.toBlob(ok,'image/png',1));
  }
  async function runBuyerGrid({silent=false}={}){
    if(!validColab()){if(!silent)setStatus('warn','請先啟動 Colab。');return null}
    const blob=await gridCanvasBlob(); if(!blob){if(!silent)setStatus('warn','尚未取得完整 8 格。請先執行「格線 → 8格 → 數字」。');return null}
    const stop=startTimer('8格專用 VLM'); if(!silent){badge.textContent='8格辨識中';setStatus('info','Gemma 4 E4B 正在只看 8 個格子，逐格讀取數字…')}
    const fd=new FormData();fd.append('file',blob,'buyer-ban-grid.png');
    try{
      const r=await requestWithFallback('/v1/buyer-ban',{method:'POST',body:fd},180000);const j=r.data;const ban=clean(j.buyer_tax_id).replace(/\D/g,'');const conf=Number(j.confidence||0);
      if(!/^\d{8}$/.test(ban))throw new Error('8格 VLM 未回傳完整 8 碼');
      const company=companyBan(),local=localGridResult();
      const src=`${r.via}:Gemma4E4B-8grid`;
      const currentBuyer=clean($('buyer')?.value).replace(/\D/g,'');
      let aiConflict=false;
      if(!currentBuyer || currentBuyer===ban){
        applySafe('buyer',ban,src);
      }else if(touched.has('buyer')){
        applySafe('buyer',ban,src);
      }else{
        aiConflict=true;
      }
      const match=company&&ban===company;
      resultBox.innerHTML=`<div class="${match?'ok':'info'}"><b>8格 VLM：</b>${ban}｜信心 ${Math.round(conf*100)}%${company?'｜申報單位 '+(match?'✅相符':'⚠不相符'):''}${local?'｜本地格線 '+local:''}｜${r.via}</div>`;
      if(aiConflict){
        const c=document.createElement('div');c.className='warn';c.style.marginTop='8px';
        c.innerHTML=`<b>兩個 AI 結果不同，未自動覆寫：</b>整張辨識 ${currentBuyer} / 8格辨識 ${ban} `;
        const b=document.createElement('button');b.className='btn small secondary';b.textContent='人工確認後套用 8格結果';
        b.onclick=()=>{const el=$('buyer');if(el){el.value=ban;touched.add('buyer');markSource('buyer',src);try{if(typeof validateRecognition==='function')validateRecognition()}catch{}}c.remove();};
        c.appendChild(b);resultBox.appendChild(c);
      }
      if(!silent){badge.textContent='8格完成';setStatus(match?'ok':'warn',match?'✓ 8格 VLM 與申報單位統編一致，請人工目視確認。':'⚠ 8格 VLM 已完成，但與申報單位統編不一致，禁止自動推測或用檢查碼修字。')}
      renderConflicts(); try{if(typeof validateRecognition==='function')validateRecognition()}catch{} return j;
    }catch(e){if(!silent){badge.textContent='8格失敗';setStatus('warn','⚠ 8格專用 VLM 失敗：'+(e.message||e))}return null}finally{stop()}
  }
  async function runInvoice(){
    const file=getFile(); if(!validColab()){setStatus('warn','請先啟動 Colab 並貼入 URL。');return null} if(!file){setStatus('warn','請先拍照或上傳發票。');return null}
    conflicts.length=0;badge.textContent='整張辨識中';setStatus('info','整張發票送往 api-ocr-2025 + Gemma 4 E4B。首次 GPU 推理可能需要較久，請勿重複點擊。');const stop=startTimer('整張發票');
    const fd=new FormData();fd.append('file',file,file.name||'invoice.jpg');fd.append('engine','auto');fd.append('slim','false');fd.append('include_image','false');
    try{
      const r=await requestWithFallback('/v1/invoice',{method:'POST',body:fd},295000);const j=r.data;if(!j?.results?.length)throw new Error('api-ocr-2025 未回傳辨識結果');const first=j.results[0],d=mapInvoice(first,r.via);
      badge.textContent='整張完成';setStatus('ok',`✓ 整張辨識完成${d.buyer_tax_id?'；買方 '+d.buyer_tax_id:''}${d.seller_tax_id?'；賣方 '+d.seller_tax_id:''}。正在判斷是否需要 8 格第二次驗證。`);
      renderConflicts();
      const company=companyBan(),buyer=clean($('buyer')?.value).replace(/\D/g,''),local=localGridResult();
      if(company && (buyer!==company || (local&&local!==company))) await runBuyerGrid({silent:false});
      else if(company && document.querySelectorAll('#gfCells canvas').length===8) await runBuyerGrid({silent:true});
      return j;
    }catch(e){badge.textContent='整張失敗';setStatus('warn','⚠ 整張辨識失敗：'+(e.message||e));return null}finally{stop()}
  }

  $('v13Save').onclick=()=>{if(!validColab()){setStatus('warn','URL 必須是 https://*.trycloudflare.com');return}try{localStorage.setItem('taxAiColabBackendUrl',colabUrl())}catch{} setStatus('ok','✓ Colab URL 已儲存；Colab 重啟後請換新 URL。')};
  $('v13Health').onclick=health; $('v13Run').onclick=runInvoice; $('v13Buyer').onclick=()=>runBuyerGrid();
  const baseScan=scanBtn.onclick;
  scanBtn.onclick=async function(){if(typeof baseScan==='function')await baseScan.call(scanBtn);if(validColab())await runInvoice()};
  if(validColab())setTimeout(health,800);
})();
