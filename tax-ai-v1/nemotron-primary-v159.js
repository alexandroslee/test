(function(){
  if(window.__taxAiNemotron159)return;
  window.__taxAiNemotron159=true;
  const VERSION='1.5.9';
  const BUILD='20260830-v159-nemotron-parse-r3';
  const MODEL='nvidia/NVIDIA-Nemotron-Parse-2.0';
  const RELEASE='tax-ai-1.5.9-nemotron-parse-20260830-r3';
  const DEFAULT_SPACE='https://alexandroslee-tax-ai-zerogpu-v152.hf.space';
  const CLIENT_URL='https://cdn.jsdelivr.net/npm/@gradio/client@2.5.0/dist/index.min.js';
  const $=id=>document.getElementById(id);
  let modulePromise=null,clientPromise=null,verified=false,running=false;
  const digits=v=>String(v??'').replace(/\D/g,'');
  const num=v=>{const n=Number(String(v??'').replace(/[,，\s$NTnt元]/g,''));return Number.isFinite(n)?n:NaN};

  function validBan(v){
    const b=digits(v);if(!/^\d{8}$/.test(b))return false;
    const w=[1,2,1,2,1,2,4,1];let sum=0;
    for(let i=0;i<8;i++){const p=Number(b[i])*w[i];sum+=Math.floor(p/10)+p%10}
    return sum%5===0||(b[6]==='7'&&(sum+1)%5===0);
  }
  function ensureCard(){
    let card=$('nemotron159Card');if(card)return card;
    card=document.createElement('div');card.id='nemotron159Card';card.className='card';card.style.marginTop='16px';
    card.innerHTML=`<h2>🟢 NVIDIA Nemotron Parse 2.0｜V1.5.9 主文件模型</h2>
      <div class="muted">先解析文字、Semantic Class、Bounding Box，再由 Tax AI 空間規則引擎決定買／賣方、金額與課稅別；不讓 VLM 直接猜欄位角色。</div>
      <label style="display:block;margin-top:10px;font-weight:700">Nemotron Backend</label>
      <input id="nemotron159Url" value="${DEFAULT_SPACE}" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #d7dfeb;border-radius:10px;margin-top:6px">
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
        <button id="nemotron159Health" class="btn ghost">🔌 驗證 Nemotron Backend</button>
        <button id="nemotron159Run" class="btn">🟢 Nemotron Parse 2.0 主辨識</button>
      </div>
      <div id="nemotron159Status" class="info" style="margin-top:10px">等待 V1.5.9 r3 後端連線；本地 OCR 可先工作，Nemotron 結果回來後再升級主值。</div>
      <div id="nemotron159Evidence" class="info" style="margin-top:10px;display:none"></div>`;
    const old=$('hfZeroGpuCard');if(old)old.insertAdjacentElement('afterend',card);else document.querySelector('.top')?.insertAdjacentElement('afterend',card);
    $('nemotron159Health').onclick=()=>verify(true);$('nemotron159Run').onclick=()=>runPrimary({manual:true});
    return card;
  }
  function status(text,cls='info'){ensureCard();const e=$('nemotron159Status');if(e){e.className=cls;e.textContent=text}}
  async function mod(){if(!modulePromise)modulePromise=import(CLIENT_URL);return modulePromise}
  async function connect(){
    if(clientPromise)return clientPromise;
    const url=String($('nemotron159Url')?.value||DEFAULT_SPACE).trim()||DEFAULT_SPACE;
    clientPromise=(async()=>{const {Client}=await mod();status('正在連線 NVIDIA Nemotron Parse 2.0 Backend…','info');return await Client.connect(url)})().catch(e=>{clientPromise=null;throw e});
    return clientPromise;
  }
  function unwrap(r){let v=Array.isArray(r?.data)?r.data[0]:r?.data??r;if(typeof v==='string'){try{v=JSON.parse(v)}catch{}}return v}
  async function verify(showResult=false){
    ensureCard();
    try{
      const app=await connect(),r=unwrap(await app.predict('/health_api',['health']));
      verified=String(r?.backend_version||'')===VERSION&&String(r?.release_id||'')===RELEASE&&String(r?.model||'')===MODEL;
      window.__taxAiNemotronHealth159=r;
      if(showResult||verified)status(verified?`✓ Nemotron Backend V${r.backend_version} r3 已驗證｜${r.model}`:`⚠ Backend Release Contract 不符：${r?.backend_version||'?'} / ${r?.release_id||'?'} / ${r?.model||'?'}`,verified?'ok':'warn');
      return verified;
    }catch(e){verified=false;if(showResult)status('⚠ Nemotron Backend 尚未就緒：'+(e.message||e)+'。本地辨識仍可使用。','warn');return false}
  }
  async function currentBlob(){
    const src=String($('preview')?.src||'');if(/^(data:|blob:|https?:)/i.test(src)){try{return await (await fetch(src)).blob()}catch{}}
    try{if(state?.file instanceof Blob)return state.file}catch{}
    for(const id of ['camera','purchase','sales']){const f=$(id)?.files?.[0];if(f)return f}
    throw new Error('找不到目前發票影像');
  }
  function prune(id,keep){try{if(typeof state!=='undefined'&&state?.candidates?.[id])state.candidates[id]=state.candidates[id].filter(x=>String(x.value)===String(keep))}catch{}}
  function write(id,v,source,promote=false){
    if(v===undefined||v===null||v==='')return false;const el=$(id);if(!el)return false;const value=String(v);
    if(el.dataset.humanEdited==='1'&&String(el.value||'')!==value)return false;if(el.dataset.qrAuthority==='1'&&String(el.value||'')!=='')return false;
    el.value=value;el.dataset.aiSource=source;el.dataset.nemotron159='1';
    try{if(typeof addCandidate==='function')addCandidate(id,value,source,650)}catch{}try{if(typeof setSource==='function')setSource(id,source)}catch{}if(promote)prune(id,value);
    try{el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}catch{}return true;
  }
  function coherentAmounts(d){const net=num(d?.sales_amount),tax=num(d?.tax_amount),gross=num(d?.total_amount);return Number.isFinite(net)&&Number.isFinite(tax)&&Number.isFinite(gross)&&Math.round(net+tax)===Math.round(gross)?{ok:true,net,tax,gross}:{ok:false,net,tax,gross}}
  function renderEvidence(first){
    const e=$('nemotron159Evidence');if(!e)return;const ev=first?.evidence||{},d=first?.data||{},a=ev.amounts||{},tc=ev.tax_category||{};
    const buyer=ev.ban?.buyer_candidates?.[0],seller=ev.ban?.seller_candidates?.[0];
    e.style.display='block';e.className='info';e.innerHTML=`<b>📐 Nemotron 空間證據</b><br>買受人：${d.buyer_tax_id||'待確認'}${buyer?`（score ${Number(buyer.score).toFixed(1)}）`:''}｜賣方：${d.seller_tax_id||'待確認'}${seller?`（score ${Number(seller.score).toFixed(1)}）`:''}<br>金額：${a.sales_amount??'—'}＋${a.tax_amount??'—'}＝${a.total_amount??'—'} ${a.coherent?'✅':'⚠️'}｜課稅別：${d.tax_category||'待確認'}（${tc.source||'—'}）<br>Document blocks：${first.blocks?.length||0}`;
  }
  function applyResult(resp){
    if(String(resp?.backend_version||'')!==VERSION||String(resp?.release_id||'')!==RELEASE||String(resp?.model||'')!==MODEL)throw new Error('Nemotron 回傳的 Release Contract 不符 V1.5.9 r3');
    const first=resp?.results?.[0];if(!first)throw new Error('Nemotron 未回傳 results[0]');const d=first.data||{},conf=Number(first.confidence)||0,promote=conf>=.85,src=`NVIDIA Nemotron Parse 2.0 ${Math.round(conf*100)}%`;
    const m=String(d.invoice_number||'').toUpperCase().replace(/\s/g,'').match(/^([A-Z]{2})-?(\d{8})$/);if(m){write('track',m[1],src,promote);write('number',m[2],src,promote)}
    if(d.invoice_date)write('date',d.invoice_date,src,promote);
    const seller=digits(d.seller_tax_id),buyer=digits(d.buyer_tax_id);if(validBan(seller))write('seller',seller,src,promote);if(validBan(buyer)&&buyer!==seller)write('buyer',buyer,src,promote);
    const a=coherentAmounts(d);if(a.ok){write('net',Math.round(a.net),src,promote);write('tax',Math.round(a.tax),src,promote);write('gross',Math.round(a.gross),src,promote)}
    const cat=String(d.tax_category||'');if(['應稅','零稅率','免稅'].includes(cat)){if(window.__taxAiTaxStable158Api?.setCategory)window.__taxAiTaxStable158Api.setCategory(cat,src,d.tax_category_evidence||d.tax_category_source||'Nemotron 空間證據',Math.round(conf*100));else{const s=$('taxCategory');if(s&&s.dataset.humanEdited!=='1')s.value=cat}}
    renderEvidence(first);try{if(typeof validateRecognition==='function')validateRecognition()}catch{}try{if(typeof renderSourceDetail==='function')renderSourceDetail()}catch{}try{window.__taxAiConfidenceScore154Api?.render?.()}catch{}
    window.__taxAiNemotronResult159=resp;status(`✓ Nemotron Parse 2.0 r3 完成：${first.blocks?.length||0} 個文件區塊；空間規則已對賬並回寫。綜合信心 ${Math.round(conf*100)}%。`,'ok');return first;
  }
  async function runPrimary({manual=false}={}){
    if(running)return null;running=true;ensureCard();
    try{
      if(!verified&&!(await verify(manual))){if(!manual)status('ℹ Nemotron Backend 尚未通過 V1.5.9 r3 驗證；保留本地 provisional 結果，不阻塞操作。','info');return null}
      status('🟢 NVIDIA Nemotron Parse 2.0 主模型辨識中：正在解析文字＋版面＋Bounding Box…','info');
      const {handle_file}=await mod(),blob=await currentBlob(),app=await connect();
      const resp=unwrap(await app.predict('/invoice_api',[handle_file(blob)]));return applyResult(resp);
    }catch(e){status('⚠ Nemotron 主模型辨識失敗：'+(e.message||e)+'。已保留本地 OCR／QR，不影響入帳前人工修正。','warn');return null}finally{running=false}
  }
  function patchScan(){
    const scan=$('scan');if(!scan||scan.dataset.nemotron159==='1')return;scan.dataset.nemotron159='1';const old=scan.onclick;
    scan.onclick=async function(...args){const r=typeof old==='function'?await old.apply(this,args):undefined;status('✓ 本地初步辨識完成；Nemotron Parse 2.0 r3 正在背景解析，畫面可繼續操作。','info');setTimeout(()=>runPrimary({manual:false}),20);return r};
  }
  function patch(){ensureCard();patchScan()}
  patch();setTimeout(patch,200);setTimeout(patch,900);setTimeout(()=>verify(false),1600);
  window.__taxAiNemotron159Api={VERSION,BUILD,MODEL,RELEASE,DEFAULT_SPACE,verify,runPrimary,applyResult,validBan};
  console.info('[TaxAI] V1.5.9 Nemotron Parse primary pipeline active',BUILD);
})();