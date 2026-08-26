(function(){
  if(window.__taxAiOfficialGradioSubmit157)return;
  window.__taxAiOfficialGradioSubmit157=true;
  const BUILD='20260826-v157-official-submit-r11';
  const SPACE_URL='https://alexandroslee-tax-ai-zerogpu-v152.hf.space';
  const SPACE_ID='AlexandrosLee/tax-ai-zerogpu-v152';
  const CLIENT_URL='https://cdn.jsdelivr.net/npm/@gradio/client@2.5.0/dist/index.min.js';
  const EXPECTED_VERSION='1.5.2',EXPECTED_RELEASE='tax-ai-1.5.2-20260822-1555';
  const $=id=>document.getElementById(id);let modulePromise=null,clientPromise=null,verified=false,serial=Promise.resolve();
  const digits=v=>String(v??'').replace(/\D/g,'');
  const num=v=>{const n=Number(String(v??'').replace(/[,，\s$NTnt元]/g,''));return Number.isFinite(n)?n:NaN};
  function status(text,cls='info'){
    const e=$('hfStatus');if(e){e.className=cls;e.textContent=text}
    let p=$('officialGradio157Status');if(!p){p=document.createElement('div');p.id='officialGradio157Status';p.className='info';p.style.marginTop='10px';$('hfStatus')?.insertAdjacentElement('afterend',p)}
    if(p){p.className=cls;p.textContent=text}
    let s=$('v157GemmaLiveStatus');if(!s){s=document.createElement('div');s.id='v157GemmaLiveStatus';s.className='info';s.style.marginTop='10px';$('scanSummary')?.insertAdjacentElement('afterend',s)}
    if(s){s.className=cls;s.textContent=text}
  }
  async function mod(){if(window.__taxAiGradioModuleOverride)return window.__taxAiGradioModuleOverride;if(!modulePromise)modulePromise=import(CLIENT_URL);return modulePromise}
  async function connect(){
    if(clientPromise)return clientPromise;
    clientPromise=(async()=>{const {Client}=await mod();let err;
      for(const src of [SPACE_URL,SPACE_ID]){try{status(`正在連線 ZeroGPU：${src}`,'info');const app=await Client.connect(src,{status_callback:s=>{if(s?.status)status(`ZeroGPU Space：${s.status}`,'info')}});try{const info=await app.view_api();window.__taxAiGradioApiInfo157=info}catch{}return app}catch(e){err=e}}
      throw err||new Error('無法連線 Hugging Face Space');
    })().catch(e=>{clientPromise=null;throw e});return clientPromise;
  }
  function enqueue(fn){const p=serial.then(fn,fn);serial=p.catch(()=>{});return p}
  function unwrapData(data){let v=Array.isArray(data)&&data.length===1?data[0]:data;if(typeof v==='string'){try{v=JSON.parse(v)}catch{}}return v}
  function stageText(label,m){const pos=Number.isFinite(m?.position)?`，前方 ${m.position} 個工作`:'';const eta=Number.isFinite(m?.eta)?`，預估 ${Math.round(m.eta)} 秒`:'';switch(m?.stage){case'pending':return `${label}：ZeroGPU 排隊中${pos}${eta}`;case'generating':return `${label}：Gemma 4 E4B 執行中${eta}`;case'complete':return `${label}：模型工作完成，正在回寫`;case'error':return `${label}：ZeroGPU 錯誤${m?.message?'－'+m.message:''}`;default:return `${label}：${m?.stage||m?.code||'處理中'}`}}
  async function submit(endpoint,payload,label){return enqueue(async()=>{const app=await connect();const job=app.submit(endpoint,payload);let data=null,lastStatus=null;status(`${label}：已送入官方 Gradio Client`,'info');
    for await(const msg of job){if(msg?.type==='status'){lastStatus=msg;status(stageText(label,msg),msg.stage==='error'?'warn':'info')}else if(msg?.type==='data'){data=msg.data;status(`${label}：已收到模型資料，正在驗證`,'info')}}
    if(data===null||data===undefined){const reason=lastStatus?.message||lastStatus?.code||lastStatus?.stage||'沒有 data event';throw new Error(`${endpoint} 未收到完成資料（${reason}）`)}
    return unwrapData(data);
  })}
  async function blobFromImage(){const src=String($('preview')?.src||'');if(/^(data:|blob:|https?:)/i.test(src)){try{return await (await fetch(src)).blob()}catch{}}try{if(state?.file instanceof Blob)return state.file}catch{}for(const id of ['camera','purchase','sales']){const f=$(id)?.files?.[0];if(f)return f}throw new Error('找不到目前發票影像')}
  function validBan(v){v=digits(v);if(!/^\d{8}$/.test(v))return false;const w=[1,2,1,2,1,2,4,1];let sum=0;for(let i=0;i<8;i++){const p=Number(v[i])*w[i];sum+=Math.floor(p/10)+p%10}return sum%5===0||(v[6]==='7'&&(sum+1)%5===0)}
  function handLike(d){const t=String($('invoiceType')?.value||'auto');return t==='hand'||/三聯|二聯|手開/.test(String(d?.invoice_type||''))||(t==='auto'&&!window.__taxAiQr152)}
  function amountCheck(d){const sales=num(d?.sales_amount),tax=num(d?.tax_amount),total=num(d?.total_amount),cat=String(d?.tax_category||$('taxCategory')?.value||'');if(!Number.isFinite(sales)||!Number.isFinite(tax)||!Number.isFinite(total))return{ok:false,reason:'金額不完整'};if(Math.round(sales+tax)!==Math.round(total))return{ok:false,reason:`${sales}+${tax}≠${total}`};if(cat==='應稅'){const ex=Math.round(sales*.05),tol=Math.max(2,Math.round(sales*.002));if(Math.abs(tax-ex)>tol)return{ok:false,reason:`5% 稅額不合理：${tax}，預期約 ${ex}`}}if((cat==='零稅率'||cat==='免稅')&&tax!==0)return{ok:false,reason:`${cat} 稅額應為 0`};return{ok:true,sales,tax,total}}
  function prune(id,keep){try{if(typeof state!=='undefined'&&state?.candidates?.[id])state.candidates[id]=state.candidates[id].filter(x=>String(x.value)===String(keep))}catch{}}
  function write(id,v,src,promote=false){if(v===undefined||v===null||v==='')return false;const el=$(id);if(!el)return false;if(el.dataset.humanEdited==='1'&&String(el.value||'')!==String(v))return false;if(el.dataset.qrAuthority==='1'&&String(el.value||'')!=='')return false;el.value=String(v);el.dataset.aiSource=src;try{if(typeof addCandidate==='function')addCandidate(id,String(v),src,600)}catch{}try{if(typeof setSource==='function')setSource(id,src)}catch{}if(promote)prune(id,v);try{el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}catch{}return true}
  function normalizeDate(v){const s=String(v||'').trim();let m=s.match(/^(\d{3})[年\/-](\d{1,2})[月\/-](\d{1,2})/);if(m)return `${Number(m[1])+1911}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;m=s.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);if(m)return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;return s.slice(0,10)}
  function mapInvoice(resp){const first=resp?.results?.[0];if(!first)throw new Error('Gemma 未回傳 results[0]');const d=first.data||{},conf=Number(first.confidence)||Number(d.confidence)||0,high=conf>=.9,src=`Gemma 4 E4B r11 ${Math.round(conf*100)}%`;
    const isHand=handLike(d),seller=digits(d.seller_tax_id),buyer=digits(d.buyer_tax_id),buyerRoleBad=isHand&&seller&&buyer&&seller===buyer,a=amountCheck(d);
    const m=String(d.invoice_number||'').toUpperCase().replace(/\s/g,'').match(/^([A-Z]{2})-?(\d{8})$/);if(m){write('track',m[1],src,high);write('number',m[2],src,high)}
    const nd=normalizeDate(d.invoice_date);if(nd)write('date',nd,src,high);if(validBan(seller))write('seller',seller,src,high);if(validBan(buyer)&&!buyerRoleBad)write('buyer',buyer,src,high);if(d.seller_name)write('sellerName',d.seller_name,src,false);
    if(a.ok){write('net',Math.round(a.sales),src,high);write('tax',Math.round(a.tax),src,high);write('gross',Math.round(a.total),src,high)}
    const cat=String(d.tax_category||'');if(['應稅','零稅率','免稅'].includes(cat)&&window.__taxAiAutoTax152Api?.setConcreteCategory)window.__taxAiAutoTax152Api.setConcreteCategory(cat,src,d.tax_category_evidence||'票面視覺',conf*100);
    const issues=[];if(buyerRoleBad)issues.push(`買方與賣方同為 ${seller}，未寫入買方，改交 8 格辨識`);if(!a.ok)issues.push(`金額未採用：${a.reason}`);window.__taxAiR11Last={data:d,confidence:conf,issues,amount:a};
    try{if(typeof validateRecognition==='function')validateRecognition()}catch{}try{if(typeof renderSourceDetail==='function')renderSourceDetail()}catch{}try{window.__taxAiConfidenceScore154Api?.render?.()}catch{}
    status(issues.length?`⚠ Gemma 已回傳，但 ${issues.join('；')}。其餘通過欄位已回寫。`:`✓ Gemma 已回傳並完成欄位回寫／品質重算（${Math.round(conf*100)}%）。`,issues.length?'warn':'ok');return d}
  async function verifyBackend(){try{const h=await submit('/health_api',['health'],'Backend 驗證');const v=String(h?.backend_version||h?.version||''),rel=String(h?.release_id||'');verified=v===EXPECTED_VERSION&&rel===EXPECTED_RELEASE;for(const id of ['hfRun','hfBuyer','taxCategoryGemma']){const b=$(id);if(b)b.disabled=!verified}const badge=$('hfBadge');if(badge)badge.textContent=verified?'V1.5.2 已驗證':'Backend 不符';status(verified?`✓ Backend V${v} 已驗證；r11 submit transport 就緒。`:`⚠ Backend ${v||'未知'} / ${rel||'未提供'} 不符。`,verified?'ok':'warn');return verified}catch(e){verified=false;status('⚠ Backend／Gradio Client 驗證失敗：'+(e.message||e),'warn');return false}}
  async function runInvoiceGemma(){if(!verified&&!(await verifyBackend()))return null;try{const {handle_file}=await mod(),blob=await blobFromImage(),resp=await submit('/invoice_api',[handle_file(blob)],'整張 Gemma');const d=mapInvoice(resp);window.__taxAiWholeGemmaFinished157=true;window.__taxAiWholeGemmaFinishedAt157=Date.now();return resp}catch(e){status('⚠ 整張 Gemma 失敗：'+(e.message||e),'warn');console.error('[TaxAI r11]',e);return null}}
  function canvasBlob(c){return new Promise((ok,no)=>c.toBlob(b=>b?ok(b):no(new Error('canvas 轉檔失敗')),'image/png'))}
  async function runBuyer(){if(!verified&&!(await verifyBackend()))return null;const cvs=[...document.querySelectorAll('#gfCells canvas')];if(cvs.length!==8){status('⚠ 買受人 8 格尚未完整','warn');return null}const c=document.createElement('canvas');c.width=768;c.height=96;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);cvs.forEach((v,i)=>x.drawImage(v,i*96,0,96,96));try{const {handle_file}=await mod(),j=await submit('/buyer_ban_api',[handle_file(await canvasBlob(c))],'買受人 8 格 Gemma'),ban=digits(j?.buyer_tax_id);if(validBan(ban)){write('buyer',ban,'Gemma 4 E4B 8 格',Number(j?.confidence)>=.9);try{window.__taxAiConfidenceScore154Api?.render?.()}catch{}status(`✓ 買受人 8 格：${ban}（${Math.round((Number(j?.confidence)||0)*100)}%）`,'ok')}return j}catch(e){status('⚠ 買受人 8 格 Gemma 失敗：'+(e.message||e),'warn');return null}}
  async function taxGemma(){const cur=String($('taxCategory')?.value||'');if(['應稅','零稅率','免稅'].includes(cur))return{category:cur,confidence:1};if(!verified&&!(await verifyBackend()))return null;try{const {handle_file}=await mod(),blob=await blobFromImage(),j=await submit('/tax_category_api',[handle_file(blob)],'課稅別 Gemma'),cat=String(j?.category||'待確認');if(['應稅','零稅率','免稅'].includes(cat)&&window.__taxAiAutoTax152Api?.setConcreteCategory)window.__taxAiAutoTax152Api.setConcreteCategory(cat,'Gemma 4 E4B r11 課稅別',j.evidence||'票面標記',(Number(j.confidence)||0)*100);return j}catch(e){status('⚠ 課稅別 Gemma 失敗：'+(e.message||e),'warn');return null}}
  function patch(){const api=window.__taxAiCore152Api;if(!api)return;api.verifyBackend=verifyBackend;api.runInvoiceGemma=runInvoiceGemma;api.runBuyer=runBuyer;api.gemmaTaxCategory=taxGemma;api.__officialSubmitR11=true;const h=$('hfHealth'),r=$('hfRun'),b=$('hfBuyer'),t=$('taxCategoryGemma');if(h)h.onclick=verifyBackend;if(r)r.onclick=runInvoiceGemma;if(b)b.onclick=runBuyer;if(t)t.onclick=taxGemma;const sub=$('hfZeroGpuCard')?.querySelector('.muted');if(sub)sub.textContent='V1.5.7 r11：官方 @gradio/client submit 狀態流；排隊／執行／完成／錯誤都會顯示。'}
  window.__taxAiOfficialSubmit157Api={BUILD,verifyBackend,runInvoiceGemma,runBuyer,taxGemma,submit,mapInvoice,patch};patch();setTimeout(patch,100);setTimeout(()=>verifyBackend(),1200);console.info('[TaxAI] r11 official submit transport active',BUILD);
})();