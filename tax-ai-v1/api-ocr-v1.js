(function(){
  const $=id=>document.getElementById(id);
  const scanBtn=$('scan');
  if(!scanBtn) return;

  const subtitle=document.querySelector('.top .muted');
  if(subtitle) subtitle.textContent='V1.0｜台灣發票版面辨識＋api-ocr-2025 OCR Backend＋人工確認';
  const hero=document.querySelector('.hero');
  if(hero) hero.innerHTML='<b>V1.0 OCR：</b>保留既有 QR／方向校正／三聯式 8 格切割，新增 <b>adi-gov-tw/api-ocr-2025</b> Backend。手開發票可使用 <b>影像 VLM</b> 解析，再與本地 8 格、申報單位統編及人工確認交叉驗證。';
  scanBtn.textContent='✨ V1.0：本地辨識＋OCR Backend 交叉驗證';

  const card=document.createElement('div');
  card.className='card section';
  card.id='apiOcrV1Card';
  card.innerHTML=`
    <div class="section-title"><div><h2>🧠 1.0 OCR Backend｜api-ocr-2025</h2>
      <div class="muted">臺灣統一發票（二聯式／三聯式／電子發票）結構化辨識。GitHub Pages 只保存 Backend 網址；API Key 預設不保存。</div></div>
      <span id="apiOcrV1Badge" class="pill">尚未連線</span>
    </div>
    <div class="form" style="margin-top:12px">
      <div class="field full"><label>OCR Backend HTTPS URL</label><input id="apiOcrV1Url" placeholder="https://your-ocr-backend.example.com"></div>
      <div class="field"><label>辨識引擎</label><select id="apiOcrV1Engine"><option value="auto">auto（建議）</option><option value="vlm">vlm（手寫／困難影像）</option><option value="local">local（QR＋regex）</option><option value="text">text（OCR文字＋LLM）</option></select></div>
      <div class="field"><label>X-API-Key（選用，不保存）</label><input id="apiOcrV1Key" type="password" autocomplete="off" placeholder="Backend 有設定 APIOCR_API_KEY 才需填"></div>
    </div>
    <div class="actions" style="margin-top:10px"><button id="apiOcrV1Save" class="btn ghost">儲存 Backend 網址</button><button id="apiOcrV1Health" class="btn secondary">檢查 /health</button><button id="apiOcrV1Run" class="btn primary">🚀 Backend 辨識本張發票</button></div>
    <div id="apiOcrV1Status" class="info" style="margin-top:10px">尚未設定 Backend。未設定時仍可使用既有瀏覽器辨識流程。</div>
    <div id="apiOcrV1Meta" class="muted small" style="margin-top:8px"></div>`;

  const companyCard=$('companyName')?.closest('.card');
  if(companyCard) companyCard.insertAdjacentElement('afterend',card); else document.querySelector('.card')?.insertAdjacentElement('afterend',card);

  const urlEl=$('apiOcrV1Url'), keyEl=$('apiOcrV1Key'), engineEl=$('apiOcrV1Engine');
  const badge=$('apiOcrV1Badge'), st=$('apiOcrV1Status'), meta=$('apiOcrV1Meta');
  const stored=localStorage.getItem('taxAiApiOcrBackendUrl')||''; urlEl.value=stored;
  engineEl.value=localStorage.getItem('taxAiApiOcrEngine')||'auto';

  function baseUrl(){return String(urlEl.value||'').trim().replace(/\/+$/,'')}
  function setStatus(cls,text){st.className=cls;st.textContent=text}
  function getFile(){
    try{ if(typeof state!=='undefined' && state.file) return state.file; }catch{}
    for(const id of ['camera','purchase','sales']){const f=$(id)?.files?.[0];if(f)return f}
    return null;
  }
  function headers(){const h={};const k=String(keyEl.value||'').trim();if(k)h['X-API-Key']=k;return h}
  async function health(){
    const b=baseUrl(); if(!b){setStatus('warn','請先設定 OCR Backend HTTPS URL。');return false}
    badge.textContent='檢查中'; setStatus('info','正在檢查 Backend /health…');
    try{
      const r=await fetch(b+'/health',{headers:headers()}); const j=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(j.detail||('HTTP '+r.status));
      badge.textContent='Backend 正常'; setStatus('ok',`✓ api-ocr-2025 Backend 正常${j.version?'，版本 '+j.version:''}。`); return true;
    }catch(e){badge.textContent='連線失敗';setStatus('warn','⚠ Backend 無法連線：'+(e.message||e)+'。請確認 HTTPS、CORS 與服務是否啟動。');return false}
  }
  function addMapped(k,v,src,score){
    if(v===undefined||v===null||v==='')return;
    try{if(typeof addCandidate==='function')addCandidate(k,v,src,score)}catch{}
    const el=$(k);if(el)el.value=v;
    try{if(typeof setSource==='function')setSource(k,src)}catch{}
  }
  function mapInvoice(result){
    const d=result?.data||result||{}; const src=`api-ocr-2025:${result?.source||'backend'}`;
    const inv=String(d.invoice_number||'').toUpperCase().replace(/\s/g,'');
    let m=inv.match(/^([A-Z]{2})-?(\d{8})$/); if(m){addMapped('track',m[1],src,180);addMapped('number',m[2],src,180)}
    addMapped('date',d.invoice_date,src,175);
    addMapped('seller',d.seller_tax_id,src,190);
    addMapped('buyer',d.buyer_tax_id,src,190);
    addMapped('net',d.sales_amount,src,175);
    addMapped('tax',d.tax_amount,src,175);
    addMapped('gross',d.total_amount,src,175);
    if($('sellerName')&&d.seller_name)$('sellerName').value=d.seller_name;
    const raw=[result?.raw_text||'',...(result?.warnings||[]).map(x=>'⚠ '+x)].filter(Boolean).join('\n');
    if($('raw')&&raw){$('raw').value=($('raw').value?$('raw').value+'\n\n--- api-ocr-2025 ---\n':'')+raw}
    if($('ocrConfidence')&&result?.confidence!=null)$('ocrConfidence').textContent=`Backend 信心 ${Math.round(Number(result.confidence)*100)}%`;
    try{if(typeof chooseFields==='function')chooseFields()}catch{}
    try{if(typeof validateRecognition==='function')validateRecognition()}catch{}
    try{if(typeof renderSourceDetail==='function')renderSourceDetail()}catch{}
    return d;
  }
  async function runBackend(){
    const b=baseUrl(), file=getFile();
    if(!b){setStatus('warn','請先設定 OCR Backend HTTPS URL。');return null}
    if(!file){setStatus('warn','請先拍照或上傳一張發票。');return null}
    badge.textContent='辨識中';setStatus('info',`正在呼叫 api-ocr-2025 /v1/invoice（engine=${engineEl.value}）…`);
    const fd=new FormData();fd.append('file',file,file.name||'invoice.jpg');fd.append('engine',engineEl.value);fd.append('slim','false');fd.append('include_image','false');
    try{
      const t=performance.now();const r=await fetch(b+'/v1/invoice',{method:'POST',headers:headers(),body:fd});
      const j=await r.json().catch(()=>null);if(!r.ok)throw new Error(j?.detail||('HTTP '+r.status));
      if(!j||!Array.isArray(j.results)||!j.results.length)throw new Error('Backend 未回傳辨識結果');
      const first=j.results[0],d=mapInvoice(first);const ms=Math.round(performance.now()-t);
      badge.textContent='Backend 完成';setStatus('ok',`✓ Backend 辨識完成：${d.invoice_type||first.invoice_type||'發票'}${d.buyer_tax_id?'，買方統編 '+d.buyer_tax_id:''}${d.seller_tax_id?'，賣方統編 '+d.seller_tax_id:''}。請人工確認後再加入本期。`);
      meta.textContent=`results=${j.count||j.results.length}｜source=${first.source||'—'}｜confidence=${first.confidence!=null?Math.round(first.confidence*100)+'%':'—'}｜browser round-trip=${ms}ms`;
      return j;
    }catch(e){badge.textContent='Backend 失敗';setStatus('warn','⚠ api-ocr-2025 辨識失敗：'+(e.message||e));return null}
  }

  $('apiOcrV1Save').onclick=()=>{localStorage.setItem('taxAiApiOcrBackendUrl',baseUrl());localStorage.setItem('taxAiApiOcrEngine',engineEl.value);setStatus('ok','✓ 已儲存 Backend 網址與 engine；API Key 不會寫入 LocalStorage。')};
  $('apiOcrV1Health').onclick=health;
  $('apiOcrV1Run').onclick=runBackend;
  engineEl.onchange=()=>localStorage.setItem('taxAiApiOcrEngine',engineEl.value);

  const baseScan=scanBtn.onclick;
  scanBtn.onclick=async function(){
    if(typeof baseScan==='function')await baseScan.call(scanBtn);
    if(baseUrl()) await runBackend();
  };
})();
