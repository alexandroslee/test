(function(){
  const $=id=>document.getElementById(id); const scanBtn=$('scan'); if(!scanBtn)return;
  const GATEWAY='https://tax-ai-v1-gateway.vercel.app';
  const COLAB_NOTEBOOK='https://colab.research.google.com/github/alexandroslee/test/blob/gh-pages/colab/tax-ai-gemma4-e4b.ipynb';
  const subtitle=document.querySelector('.top .muted'); if(subtitle)subtitle.textContent='V1.2｜GitHub Pages＋Vercel 免費 HTTPS＋Colab GPU＋Gemma 4 E4B＋api-ocr-2025';
  const hero=document.querySelector('.hero'); if(hero)hero.innerHTML='<b>V1.2：</b>Vercel 只做免費 HTTPS Proxy；真正 OCR/VLM 在 <b>Colab GPU</b> 執行 <b>Gemma 4 E4B + api-ocr-2025</b>。三聯式左上 8 格是買受人統編，右下專用章是賣方統編；檢查碼只驗證、不改寫辨識數字。';
  scanBtn.textContent='✨ V1.2：本地辨識＋Colab Gemma 4 E4B 交叉驗證';

  const card=document.createElement('div'); card.className='card section'; card.id='apiOcrV1Card';
  card.innerHTML=`<div class="section-title"><div><h2>🧠 1.2 Colab GPU Backend｜Gemma 4 E4B + api-ocr-2025</h2><div class="muted">Vercel AI Gateway：停用｜OpenAI API：停用｜GPU：Google Colab。Colab 中斷後網址會失效，重新啟動 Notebook 後貼入新網址即可。</div></div><span id="apiOcrV1Badge" class="pill">等待 Colab</span></div>
  <div class="form" style="margin-top:12px"><div class="field full"><label>Vercel 免費 HTTPS Gateway</label><input id="apiOcrV1Gateway" readonly></div><div class="field full"><label>Colab Backend URL</label><input id="apiOcrV1Colab" placeholder="https://xxxxx.trycloudflare.com"></div></div>
  <div class="actions" style="margin-top:10px"><a id="apiOcrV1ColabOpen" class="btn secondary" target="_blank" rel="noopener">▶ 開啟 Colab GPU Notebook</a><button id="apiOcrV1Save" class="btn ghost">儲存 Colab URL</button><button id="apiOcrV1Health" class="btn secondary">檢查 Colab /health</button><button id="apiOcrV1Run" class="btn primary">🚀 Gemma 4 E4B 辨識本張發票</button></div>
  <div id="apiOcrV1Status" class="info" style="margin-top:10px">先開啟 Colab Notebook，依序執行到顯示 COLAB_BACKEND_URL，再貼到上方。</div><div id="apiOcrV1Meta" class="muted small" style="margin-top:8px"></div>`;
  const companyCard=$('companyName')?.closest('.card'); if(companyCard)companyCard.insertAdjacentElement('afterend',card); else document.querySelector('.card')?.insertAdjacentElement('afterend',card);

  const gatewayEl=$('apiOcrV1Gateway'),colabEl=$('apiOcrV1Colab'),badge=$('apiOcrV1Badge'),st=$('apiOcrV1Status'),meta=$('apiOcrV1Meta');
  gatewayEl.value=GATEWAY; colabEl.value=localStorage.getItem('taxAiColabBackendUrl')||''; $('apiOcrV1ColabOpen').href=COLAB_NOTEBOOK;
  const setStatus=(c,t)=>{st.className=c;st.textContent=t};
  function colabUrl(){return String(colabEl.value||'').trim().replace(/\/+$/,'')}
  function validColab(){try{const u=new URL(colabUrl());return u.protocol==='https:'&&u.hostname.endsWith('.trycloudflare.com')}catch{return false}}
  function proxyHeaders(){return {'X-Colab-Backend':colabUrl()}}
  function getFile(){try{if(typeof state!=='undefined'&&state.file)return state.file}catch{} for(const id of ['camera','purchase','sales']){const f=$(id)?.files?.[0];if(f)return f}return null}

  async function health(){
    if(!validColab()){badge.textContent='等待 Colab';setStatus('warn','請先從 Colab Notebook 複製 https://*.trycloudflare.com URL。');return false}
    badge.textContent='檢查中';setStatus('info','正在經 Vercel Gateway 檢查 Colab api-ocr-2025…');
    try{
      const g=await fetch(GATEWAY+'/health');const gj=await g.json().catch(()=>({}));if(!g.ok)throw new Error('Gateway HTTP '+g.status);
      const r=await fetch(GATEWAY+'/health/colab',{headers:proxyHeaders()});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.detail||('HTTP '+r.status));
      badge.textContent='Colab GPU 正常';setStatus('ok',`✓ Gateway ${gj.version||'V1'} + Colab api-ocr-2025 正常。現在可用 Gemma 4 E4B 辨識。`);return true;
    }catch(e){badge.textContent='Colab 未就緒';setStatus('warn','⚠ Colab Backend 無法使用：'+(e.message||e)+'。請確認 Notebook 還在執行。');return false}
  }

  function addMapped(k,v,src,score){if(v===undefined||v===null||v==='')return;try{if(typeof addCandidate==='function')addCandidate(k,v,src,score)}catch{}const el=$(k);if(el)el.value=v;try{if(typeof setSource==='function')setSource(k,src)}catch{}}
  function mapInvoice(result){
    const d=result?.data||result||{},src=`Colab-Gemma4E4B:${result?.source||'api-ocr-2025'}`;
    const inv=String(d.invoice_number||'').toUpperCase().replace(/\s/g,'');const m=inv.match(/^([A-Z]{2})-?(\d{8})$/);if(m){addMapped('track',m[1],src,220);addMapped('number',m[2],src,220)}
    addMapped('date',d.invoice_date,src,205);addMapped('seller',d.seller_tax_id,src,230);addMapped('buyer',d.buyer_tax_id,src,230);addMapped('net',d.sales_amount,src,205);addMapped('tax',d.tax_amount,src,205);addMapped('gross',d.total_amount,src,205);
    if($('sellerName')&&d.seller_name)$('sellerName').value=d.seller_name;
    const raw=[result?.raw_text||'',...(result?.warnings||[]).map(x=>'⚠ '+x)].filter(Boolean).join('\n');if($('raw')&&raw)$('raw').value=($('raw').value?$('raw').value+'\n\n--- Colab Gemma 4 E4B ---\n':'')+raw;
    try{if(typeof chooseFields==='function')chooseFields()}catch{}try{if(typeof validateRecognition==='function')validateRecognition()}catch{}try{if(typeof renderSourceDetail==='function')renderSourceDetail()}catch{}return d;
  }

  async function runBackend(){
    const file=getFile();if(!validColab()){badge.textContent='等待 Colab';setStatus('warn','Colab VLM 未執行：請先啟動 Notebook 並貼入 URL。');return null}if(!file){setStatus('warn','請先拍照或上傳發票。');return null}
    badge.textContent='Gemma 辨識中';setStatus('info','已經由 Vercel 免費 HTTPS Gateway 將發票送往 Colab GPU → api-ocr-2025 → Gemma 4 E4B…');
    const fd=new FormData();fd.append('file',file,file.name||'invoice.jpg');fd.append('engine','vlm');fd.append('slim','false');fd.append('include_image','false');
    try{
      const t=performance.now();const r=await fetch(GATEWAY+'/v1/invoice',{method:'POST',headers:proxyHeaders(),body:fd});const j=await r.json().catch(()=>null);if(!r.ok)throw new Error(j?.detail||('HTTP '+r.status));if(!j?.results?.length)throw new Error('api-ocr-2025 未回傳結果');
      const first=j.results[0],d=mapInvoice(first),ms=Math.round(performance.now()-t);badge.textContent='Gemma 完成';setStatus('ok',`✓ Colab GPU 真正完成辨識${d.buyer_tax_id?'；買受人統編 '+d.buyer_tax_id:''}${d.seller_tax_id?'；賣方統編 '+d.seller_tax_id:''}。請對照原始 8 格人工確認。`);meta.textContent=`Gemma 4 E4B｜api-ocr-2025｜source=${first.source||'—'}｜${ms}ms`;return j;
    }catch(e){badge.textContent='Gemma 失敗';setStatus('warn','⚠ Colab 後端已呼叫，但辨識失敗：'+(e.message||e));return null}
  }

  $('apiOcrV1Save').onclick=()=>{if(!validColab()){setStatus('warn','URL 格式不正確，必須是 https://*.trycloudflare.com');return}localStorage.setItem('taxAiColabBackendUrl',colabUrl());setStatus('ok','✓ 已儲存本次 Colab Backend URL。Colab 重啟後需換新 URL。')};
  $('apiOcrV1Health').onclick=health; $('apiOcrV1Run').onclick=runBackend;
  const baseScan=scanBtn.onclick;scanBtn.onclick=async function(){if(typeof baseScan==='function')await baseScan.call(scanBtn);if(validColab())await runBackend()};
  if(validColab())setTimeout(health,800);
})();
