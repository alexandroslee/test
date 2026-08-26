(function(){
  if(window.__taxAiOfficialGradio157)return;
  window.__taxAiOfficialGradio157=true;

  const BUILD='20260826-v157-official-client-r10';
  const SPACE_ID='AlexandrosLee/tax-ai-zerogpu-v152';
  const CLIENT_URL='https://cdn.jsdelivr.net/npm/@gradio/client@2.5.0/dist/index.min.js';
  const EXPECTED_VERSION='1.5.2';
  const EXPECTED_RELEASE='tax-ai-1.5.2-20260822-1555';
  const $=id=>document.getElementById(id);
  let modulePromise=null,clientPromise=null,verified=false,serial=Promise.resolve();

  function status(text,cls='info'){
    const el=$('hfStatus');if(el){el.className=cls;el.textContent=text}
    let p=$('officialGradio157Status');
    if(!p){p=document.createElement('div');p.id='officialGradio157Status';p.className='info';p.style.marginTop='10px';$('hfStatus')?.insertAdjacentElement('afterend',p)}
    if(p){p.className=cls;p.textContent=text}
  }
  function unwrap(result){
    let v=Array.isArray(result?.data)?result.data[0]:result?.data??result;
    if(typeof v==='string'){try{v=JSON.parse(v)}catch{}}
    return v;
  }
  async function mod(){
    if(!modulePromise)modulePromise=import(CLIENT_URL);
    return modulePromise;
  }
  async function client(){
    if(!clientPromise){
      clientPromise=(async()=>{
        const {Client}=await mod();
        status('正在以官方 @gradio/client 連線 Hugging Face ZeroGPU…','info');
        return await Client.connect(SPACE_ID,{events:['data','status']});
      })().catch(e=>{clientPromise=null;throw e});
    }
    return clientPromise;
  }
  function enqueue(fn){
    const p=serial.then(fn,fn);serial=p.catch(()=>{});return p;
  }
  async function blobFromCurrentImage(){
    const src=String($('preview')?.src||'');
    if(/^(data:|blob:|https?:)/i.test(src)){
      try{return await (await fetch(src)).blob()}catch{}
    }
    try{if(state?.file instanceof Blob)return state.file}catch{}
    for(const id of ['camera','purchase','sales']){const f=$(id)?.files?.[0];if(f)return f}
    throw new Error('找不到目前發票影像');
  }
  function setField(id,value,source){
    if(value===undefined||value===null||value==='')return false;
    const el=$(id);if(!el)return false;const v=String(value);
    if(el.dataset.humanEdited==='1'&&String(el.value||'')!==v)return false;
    if(el.dataset.qrAuthority==='1'&&String(el.value||'')!=='')return false;
    el.value=v;el.dataset.aiSource=source;
    try{if(typeof addCandidate==='function')addCandidate(id,v,source,540)}catch{}
    try{if(typeof setSource==='function')setSource(id,source)}catch{}
    try{el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}catch{}
    return true;
  }
  function normalizeDate(v){
    const s=String(v||'').trim();
    let m=s.match(/^(\d{3})[年\/-](\d{1,2})[月\/-](\d{1,2})/);
    if(m)return `${Number(m[1])+1911}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
    m=s.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
    if(m)return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
    return s.slice(0,10);
  }
  function mapInvoice(resp){
    const first=resp?.results?.[0];if(!first)throw new Error('Gemma 未回傳發票結果');
    const d=first.data||{},src='官方 @gradio/client：Gemma 4 E4B';
    const m=String(d.invoice_number||'').toUpperCase().replace(/\s/g,'').match(/^([A-Z]{2})-?(\d{8})$/);
    if(m){setField('track',m[1],src);setField('number',m[2],src)}
    setField('date',normalizeDate(d.invoice_date),src);
    setField('seller',d.seller_tax_id,src);setField('buyer',d.buyer_tax_id,src);
    setField('net',d.sales_amount,src);setField('tax',d.tax_amount,src);setField('gross',d.total_amount,src);setField('sellerName',d.seller_name,src);
    const cat=String(d.tax_category||'');
    if(['應稅','零稅率','免稅'].includes(cat)){
      const sel=$('taxCategory');
      if(sel&&sel.dataset.humanEdited!=='1'){
        if(window.__taxAiAutoTax152Api?.setConcreteCategory)window.__taxAiAutoTax152Api.setConcreteCategory(cat,'官方 @gradio/client：Gemma 整張票面',d.tax_category_evidence||'票面視覺',(Number(first.confidence)||Number(d.confidence)||0)*100);
        else{sel.value=cat;sel.dataset.aiSource=src;try{sel.dispatchEvent(new Event('change',{bubbles:true}))}catch{}}
      }
    }
    try{if(typeof validateRecognition==='function')validateRecognition()}catch{}
    try{if(typeof renderSourceDetail==='function')renderSourceDetail()}catch{}
    try{window.__taxAiConfidenceScore154Api?.render?.()}catch{}
    return d;
  }
  async function predict(endpoint,payload){
    return enqueue(async()=>{
      const app=await client();
      const r=await app.predict(endpoint,payload);
      const v=unwrap(r);
      if(v===null||v===undefined)throw new Error(`${endpoint} 沒有回傳資料`);
      return v;
    });
  }
  async function verifyBackend(){
    try{
      const h=await predict('/health_api',['health']);
      const v=String(h?.backend_version||h?.version||''),rel=String(h?.release_id||'');
      verified=v===EXPECTED_VERSION&&rel===EXPECTED_RELEASE;
      window.__taxAiReleaseContract={frontend:'1.5.7',backend:v,release:rel,verified,health:h,transport:'@gradio/client@2.5.0'};
      const badge=$('hfBadge');if(badge)badge.textContent=verified?'V1.5.2 已驗證':'Backend 不符';
      for(const id of ['hfRun','hfBuyer','taxCategoryGemma']){const b=$(id);if(b)b.disabled=!verified}
      status(verified?`✓ 官方 @gradio/client 已連線 ZeroGPU Backend V${v}。`:`⚠ Backend ${v||'未知'} / ${rel||'未提供'} 與預期不符。`,verified?'ok':'warn');
      return verified;
    }catch(e){verified=false;status('⚠ 官方 Gradio Client 連線失敗：'+(e.message||e),'warn');return false}
  }
  async function runInvoiceGemma(){
    if(!verified&&!(await verifyBackend()))return null;
    status('🤖 Gemma 4 E4B 正在透過官方 @gradio/client 辨識整張發票…','info');
    try{
      const {handle_file}=await mod(),blob=await blobFromCurrentImage();
      const resp=await predict('/invoice_api',[handle_file(blob)]);
      const d=mapInvoice(resp);
      window.__taxAiWholeGemmaFinished157=true;window.__taxAiWholeGemmaFinishedAt157=Date.now();
      status(`✓ Gemma 4 E4B 整張辨識完成${d.tax_category?'；課稅別 '+d.tax_category:''}。`,'ok');
      return resp;
    }catch(e){
      status('⚠ Gemma 4 E4B 整張辨識失敗：'+(e.message||e)+'。保留 QR／本地 OCR。','warn');
      console.error('[TaxAI r10] official invoice_api failed',e);return null;
    }
  }
  function canvasBlob(c,type='image/png',quality=.95){return new Promise((ok,no)=>c.toBlob(b=>b?ok(b):no(new Error('canvas 轉檔失敗')),type,quality))}
  async function runBuyer(){
    if(!verified&&!(await verifyBackend()))return null;
    const cvs=[...document.querySelectorAll('#gfCells canvas')];if(cvs.length!==8){status('⚠ 找不到完整買受人 8 格。','warn');return null}
    const c=document.createElement('canvas');c.width=8*96;c.height=96;const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);cvs.forEach((x,i)=>ctx.drawImage(x,i*96,0,96,96));
    try{
      const {handle_file}=await mod(),j=await predict('/buyer_ban_api',[handle_file(await canvasBlob(c))]),ban=String(j?.buyer_tax_id||'');
      if(/^\d{8}$/.test(ban))setField('buyer',ban,'官方 @gradio/client：Gemma 買受人 8 格');
      status(/^\d{8}$/.test(ban)?`✓ Gemma 買受人 8 格：${ban}`:'⚠ Gemma 8 格未取得有效統編',/^\d{8}$/.test(ban)?'ok':'warn');
      return j;
    }catch(e){status('⚠ Gemma 8 格辨識失敗：'+(e.message||e),'warn');return null}
  }
  async function cropTaxBlob(){
    const roi=$('taxCategoryRoiPreview');
    if(roi?.src&&/^(data:|blob:)/i.test(roi.src)){try{return await (await fetch(roi.src)).blob()}catch{}}
    return await blobFromCurrentImage();
  }
  async function gemmaTaxCategory(){
    const current=String($('taxCategory')?.value||'');
    if(['應稅','零稅率','免稅'].includes(current))return {category:current,confidence:1,evidence:'已有明確課稅別，略過重複模型呼叫',source:'r10-skip'};
    if(!verified&&!(await verifyBackend()))return null;
    try{
      const {handle_file}=await mod(),j=await predict('/tax_category_api',[handle_file(await cropTaxBlob())]);
      const cat=String(j?.category||'待確認');
      if(['應稅','零稅率','免稅'].includes(cat)&&window.__taxAiAutoTax152Api?.setConcreteCategory)window.__taxAiAutoTax152Api.setConcreteCategory(cat,'官方 @gradio/client：Gemma 課稅別',j.evidence||'票面勾選',(Number(j.confidence)||0)*100);
      return j;
    }catch(e){status('⚠ Gemma 課稅別辨識失敗：'+(e.message||e),'warn');return null}
  }
  function patch(){
    const api=window.__taxAiCore152Api;if(!api)return false;
    api.verifyBackend=verifyBackend;api.runInvoiceGemma=runInvoiceGemma;api.gemmaTaxCategory=gemmaTaxCategory;api.runBuyer=runBuyer;api.__officialGradio157=true;
    const h=$('hfHealth'),r=$('hfRun'),b=$('hfBuyer'),t=$('taxCategoryGemma');
    if(h)h.onclick=verifyBackend;if(r)r.onclick=runInvoiceGemma;if(b)b.onclick=runBuyer;if(t)t.onclick=gemmaTaxCategory;
    const sub=$('hfZeroGpuCard')?.querySelector('.muted');if(sub)sub.textContent='ZeroGPU 呼叫已改用 Gradio 官方 @gradio/client 2.5.0；一次只執行一個 Gemma 工作。';
    return true;
  }

  window.__taxAiOfficialGradio157Api={BUILD,SPACE_ID,CLIENT_URL,verifyBackend,runInvoiceGemma,runBuyer,gemmaTaxCategory,predict,patch};
  patch();setTimeout(patch,50);setTimeout(patch,400);setTimeout(()=>verifyBackend(),1200);
  console.info('[TaxAI] Official Gradio JS Client transport active',BUILD);
})();