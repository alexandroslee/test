(function(){
  const $=id=>document.getElementById(id);
  const scanBtn=$('scan'); if(!scanBtn)return;

  const FALLBACK_SPACE='https://alexandroslee-tax-ai-zerogpu.hf.space';
  const CONFIG_URL='../tax-ai-v1/hf-space.json';
  let resolvedRepo='https://huggingface.co/new-space';

  const subtitle=document.querySelector('.top .muted');
  if(subtitle)subtitle.textContent='V1.4.1｜GitHub Pages＋Hugging Face ZeroGPU＋Gemma 4 E4B';
  const hero=document.querySelector('.hero');
  if(hero)hero.innerHTML='<b>V1.4.1：</b>真正雲端版。免 Colab、免 Tunnel、免 OpenAI API。GitHub Pages 直接呼叫 <b>Hugging Face ZeroGPU → Gemma 4 E4B</b>；Space 網址由自動部署流程回寫，不再硬猜帳號名稱。';
  scanBtn.textContent='✨ V1.4.1：本地辨識＋ZeroGPU Gemma 4 E4B';

  const card=document.createElement('div'); card.className='card section'; card.id='hfZeroGpuCard';
  card.innerHTML=`<div class="section-title"><div><h2>☁️ 1.4.1 Hugging Face ZeroGPU｜Gemma 4 E4B</h2><div class="muted">固定雲端 GPU；不再需要 Colab、Cloudflare Tunnel 或 Vercel AI Gateway。</div></div><span id="hfBadge" class="pill">檢查中</span></div>
  <div class="form" style="margin-top:12px"><div class="field full"><label>ZeroGPU Space</label><input id="hfSpaceUrl" value="${FALLBACK_SPACE}"></div></div>
  <div class="actions" style="margin-top:10px"><a id="hfRepoLink" class="btn ghost" href="https://huggingface.co/new-space" target="_blank" rel="noopener">開啟 Hugging Face Space</a><button id="hfHealth" class="btn secondary">🩺 檢查 ZeroGPU</button><button id="hfRun" class="btn primary">🚀 Gemma 4 E4B 辨識本張發票</button><button id="hfBuyer" class="btn secondary">🎯 只辨識買受人 8 格</button></div>
  <div id="hfStatus" class="info" style="margin-top:10px">正在讀取自動部署設定。</div><div id="hfMeta" class="muted small" style="margin-top:8px"></div>`;
  const companyCard=$('companyName')?.closest('.card');
  if(companyCard)companyCard.insertAdjacentElement('afterend',card); else document.querySelector('.card')?.insertAdjacentElement('afterend',card);

  const urlEl=$('hfSpaceUrl'),badge=$('hfBadge'),st=$('hfStatus'),meta=$('hfMeta'),repoLink=$('hfRepoLink');
  const fields=['track','number','date','seller','buyer','net','tax','gross','sellerName'];
  fields.forEach(id=>{const el=$(id);if(el){el.addEventListener('input',()=>{el.dataset.humanEdited='1'})}});

  function space(){return String(urlEl.value||'').trim().replace(/\/+$/,'')}
  function setStatus(cls,text){st.className=cls;st.textContent=text}
  function getFile(){try{if(typeof state!=='undefined'&&state.file)return state.file}catch{}for(const id of ['camera','purchase','sales']){const f=$(id)?.files?.[0];if(f)return f}return null}
  function fileToDataURL(file){return new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=no;r.readAsDataURL(file)})}

  async function loadConfig(){
    try{
      const r=await fetch(`${CONFIG_URL}?t=${Date.now()}`,{cache:'no-store'});
      if(!r.ok)throw new Error(`config HTTP ${r.status}`);
      const c=await r.json();
      if(c?.configured&&c?.space_url){
        urlEl.value=String(c.space_url).replace(/\/+$/,'');
        resolvedRepo=c.repo_url||resolvedRepo;repoLink.href=resolvedRepo;
        meta.textContent=`Space=${c.repo_id||'—'}｜stage=${c.stage||'—'}｜hardware=${c.hardware||c.requested_hardware||'zero-a10g'}`;
        return c;
      }
      badge.textContent='尚未部署';
      setStatus('warn','Hugging Face Space 尚未建立完成；GitHub 自動部署正在等待 Hugging Face 授權憑證。');
      repoLink.href='https://huggingface.co/new-space';
      return c;
    }catch(e){
      badge.textContent='設定未就緒';setStatus('warn','尚未取得 Hugging Face 部署設定：'+(e.message||e));return null;
    }
  }

  async function callGradio(apiName,data,timeoutMs=180000){
    const base=space();
    if(!/^https:\/\/.+\.hf\.space$/i.test(base))throw new Error('Space URL 尚未設定');
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeoutMs);
    try{
      const start=await fetch(`${base}/gradio_api/call/${apiName}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data}),signal:ctl.signal});
      if(start.status===404)throw new Error('Space 尚未建立、正在建置，或 API route 尚未發布');
      if(!start.ok)throw new Error(`Space submit HTTP ${start.status}`);
      const j=await start.json();if(!j.event_id)throw new Error('Space 未回傳 event_id');
      const result=await fetch(`${base}/gradio_api/call/${apiName}/${j.event_id}`,{signal:ctl.signal});
      if(!result.ok)throw new Error(`Space result HTTP ${result.status}`);
      const text=await result.text();
      let event='',payload=null;
      for(const line of text.split(/\r?\n/)){
        if(line.startsWith('event:'))event=line.slice(6).trim();
        if(line.startsWith('data:')){
          const raw=line.slice(5).trim();
          try{const arr=JSON.parse(raw);if(event==='complete'||payload===null)payload=arr}catch{}
        }
      }
      if(payload===null)throw new Error('Space 沒有回傳完成結果');
      return Array.isArray(payload)?payload[0]:payload;
    }finally{clearTimeout(timer)}
  }

  async function health(){
    badge.textContent='檢查中';setStatus('info','正在檢查 Hugging Face ZeroGPU Space…');
    try{
      const j=await callGradio('health_api',['health'],60000);
      if(!j||j.status!=='ok')throw new Error('Space health 非正常狀態');
      badge.textContent='ZeroGPU 正常';setStatus('ok',`✓ ZeroGPU Space 已啟用；model=${j.model||'Gemma 4 E4B'}。`);meta.textContent=`backend=${j.backend||'huggingface-zerogpu'}｜GPU=${j.gpu_mode||'ZeroGPU'}`;return true;
    }catch(e){badge.textContent='Space 未就緒';setStatus('warn','⚠ ZeroGPU Space 尚未可用：'+(e.message||e));return false}
  }

  function put(id,value,source){
    if(value===undefined||value===null||value==='')return false;
    const el=$(id);if(!el)return false;
    const v=String(value);
    if(el.dataset.humanEdited==='1'&&String(el.value||'')!==v)return false;
    el.value=v;el.dataset.aiSource=source;
    try{if(typeof addCandidate==='function')addCandidate(id,v,source,240)}catch{}
    try{if(typeof setSource==='function')setSource(id,source)}catch{}
    return true;
  }

  function mapInvoice(resp){
    const first=resp?.results?.[0];if(!first)throw new Error('ZeroGPU 未回傳發票結果');
    const d=first.data||{},src='HF-ZeroGPU:Gemma4E4B';
    const inv=String(d.invoice_number||'').toUpperCase().replace(/\s/g,'');
    const m=inv.match(/^([A-Z]{2})-?(\d{8})$/);if(m){put('track',m[1],src);put('number',m[2],src)}
    put('date',String(d.invoice_date||'').slice(0,10),src);put('seller',d.seller_tax_id,src);put('buyer',d.buyer_tax_id,src);put('net',d.sales_amount,src);put('tax',d.tax_amount,src);put('gross',d.total_amount,src);put('sellerName',d.seller_name,src);
    if($('raw')&&first.raw_text)$('raw').value=($('raw').value?$('raw').value+'\n\n--- ZeroGPU Gemma 4 E4B ---\n':'')+first.raw_text;
    try{if(typeof validateRecognition==='function')validateRecognition()}catch{}
    return {first,d};
  }

  function buyerGridDataURL(){
    const cvs=[...document.querySelectorAll('#gfCells canvas')];if(cvs.length!==8)return null;
    const out=document.createElement('canvas');out.width=8*96;out.height=96;const ctx=out.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,out.width,out.height);
    cvs.forEach((c,i)=>ctx.drawImage(c,i*96,0,96,96));return out.toDataURL('image/png');
  }

  async function runBuyer(){
    const dataUrl=buyerGridDataURL();if(!dataUrl){setStatus('warn','請先完成「格線 → 8格」本地切割；找不到完整 8 格時不送 VLM 猜測。');return null}
    badge.textContent='8格辨識中';setStatus('info','ZeroGPU Gemma 4 E4B 正在只看買受人 8 格…');
    try{
      const j=await callGradio('buyer_ban_api',[dataUrl],120000);
      const ban=String(j?.buyer_tax_id||'');
      if(!/^\d{8}$/.test(ban)){badge.textContent='8格待人工';setStatus('warn','Gemma 無法可靠讀出完整 8 格；不猜測、不套用。');return j}
      const buyer=$('buyer'),existing=String(buyer?.value||'');
      if(buyer?.dataset.humanEdited==='1'&&existing&&existing!==ban){badge.textContent='結果衝突';setStatus('warn',`Gemma 8格=${ban}，但人工值=${existing}；保留人工值，不自動覆寫。`);return j}
      put('buyer',ban,'HF-ZeroGPU:8格');badge.textContent='8格完成';setStatus('ok',`✓ Gemma 只看 8 格辨識：${ban}。檢查碼仍只做驗證，請人工對照原圖。`);meta.textContent=`8格 confidence=${j.confidence!=null?Math.round(j.confidence*100)+'%':'—'}｜checksum_used=${j.checksum_used===false?'false':'—'}`;return j;
    }catch(e){badge.textContent='8格失敗';setStatus('warn','⚠ ZeroGPU 8格辨識失敗：'+(e.message||e));return null}
  }

  async function runInvoice(){
    const file=getFile();if(!file){setStatus('warn','請先拍照或上傳發票。');return null}
    badge.textContent='Gemma 辨識中';setStatus('info','正在送往 Hugging Face ZeroGPU → Gemma 4 E4B…');
    try{
      const dataUrl=await fileToDataURL(file),t=performance.now();const resp=await callGradio('invoice_api',[dataUrl],240000);const {d}=mapInvoice(resp);const ms=Math.round(performance.now()-t);
      badge.textContent='整張完成';setStatus('ok',`✓ ZeroGPU 整張辨識完成${d.buyer_tax_id?'；買受人 '+d.buyer_tax_id:''}${d.seller_tax_id?'；賣方 '+d.seller_tax_id:''}。正在準備 8 格交叉驗證。`);meta.textContent=`Gemma 4 E4B｜${ms}ms`;
      await runBuyer();return resp;
    }catch(e){badge.textContent='Gemma 失敗';setStatus('warn','⚠ ZeroGPU 辨識失敗：'+(e.message||e)+'。本地 OCR 結果仍保留。');return null}
  }

  $('hfHealth').onclick=health;$('hfRun').onclick=runInvoice;$('hfBuyer').onclick=runBuyer;
  const baseScan=scanBtn.onclick;scanBtn.onclick=async function(){if(typeof baseScan==='function')await baseScan.call(scanBtn);await runInvoice()};
  setTimeout(async()=>{const c=await loadConfig();if(c?.configured&&c?.space_url)await health()},700);
})();
