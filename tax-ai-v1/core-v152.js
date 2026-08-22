(function(){
  if(window.__taxAiCore152)return;
  window.__taxAiCore152=true;

  const VERSION='1.5.2';
  const RELEASE_ID='tax-ai-1.5.2-20260822-1555';
  const SPACE_DEFAULT='https://alexandroslee-tax-ai-zerogpu.hf.space';
  const $=id=>document.getElementById(id);
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  let backendVerified=false;

  function num(v){const s=String(v??'').replace(/[,，\s$NTnt元]/g,'');return /^-?\d+(?:\.\d+)?$/.test(s)?Number(s):NaN}
  function fileToDataURL(file){return new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=no;r.readAsDataURL(file)})}
  function getFile(){try{if(state?.file)return state.file}catch{}for(const id of ['camera','purchase','sales']){const f=$(id)?.files?.[0];if(f)return f}return null}
  function correctedImage(){const s=String($('preview')?.src||'');return /^data:image\//i.test(s)?s:''}
  function space(){return String($('hfSpaceUrl')?.value||SPACE_DEFAULT).trim().replace(/\/+$/,'')}
  function setField(id,value,source,{overwriteQr=false}={}){
    if(value===undefined||value===null||value==='')return false;
    const el=$(id);if(!el)return false;const v=String(value);
    if(el.dataset.humanEdited==='1'&&String(el.value||'')!==v)return false;
    if(!overwriteQr&&el.dataset.qrAuthority==='1'&&String(el.value||'')!=='')return false;
    el.value=v;el.dataset.aiSource=source;
    try{if(typeof addCandidate==='function')addCandidate(id,v,source,500)}catch{}
    try{if(typeof setSource==='function')setSource(id,source)}catch{}
    return true;
  }

  function ensureUi(){
    let card=$('hfZeroGpuCard');
    if(!card){
      card=document.createElement('div');card.className='card section';card.id='hfZeroGpuCard';
      card.innerHTML=`<div class="section-title"><div><h2>☁️ V1.5.2 Hugging Face ZeroGPU｜Gemma 4 E4B</h2><div class="muted">統一核心：QR、ZeroGPU、金額、課稅別與版本合約都由 core-v152 管理。</div></div><span id="hfBadge" class="pill">驗證中</span></div>
      <div class="form" style="margin-top:12px"><div class="field full"><label>ZeroGPU Space</label><input id="hfSpaceUrl" value="${SPACE_DEFAULT}"></div></div>
      <div class="actions" style="margin-top:10px"><a class="btn ghost" href="https://huggingface.co/spaces/AlexandrosLee/tax-ai-zerogpu" target="_blank" rel="noopener">開啟 Hugging Face Space</a><button id="hfHealth" class="btn secondary">🩺 驗證 V1.5.2 Backend</button><button id="hfRun" class="btn primary">🚀 Gemma 整張交叉辨識</button><button id="hfBuyer" class="btn secondary">🎯 Gemma 買受人 8 格</button><button id="hfReverseTax" class="btn secondary">↩️ 總額反算未稅／稅額</button></div>
      <div id="hfStatus" class="info" style="margin-top:10px">正在驗證 release contract。</div><div id="hfMeta" class="muted small" style="margin-top:8px"></div>
      <div id="qrAuthority152" class="info" style="margin-top:10px"><b>📱 電子發票 QR 權威資料</b><div id="qrAuthority152Body" style="margin-top:6px">等待標準電子發票第一個 QR。</div></div>
      <div id="releaseContract152" class="warn" style="margin-top:10px"><b>🔐 Release Contract</b><div id="releaseContract152Body" style="margin-top:6px">Frontend V${VERSION} 正在核對 ZeroGPU Backend。</div></div>`;
      const company=$('companyName')?.closest('.card');if(company)company.insertAdjacentElement('afterend',card);else document.querySelector('.card')?.insertAdjacentElement('afterend',card);
    }

    if(!$('taxCategory')){
      const gross=$('gross');if(gross){const f=document.createElement('div');f.className='field';f.id='taxCategoryField';f.innerHTML='<label>課稅別 <span id="sTaxCategory" class="src">—</span></label><select id="taxCategory"><option value="待確認">⚠ 待確認</option><option value="應稅">✅ 應稅</option><option value="零稅率">0% 零稅率</option><option value="免稅">免稅</option></select>';gross.closest('.field')?.insertAdjacentElement('afterend',f);$('taxCategory')?.addEventListener('input',e=>{if(e.isTrusted)$('taxCategory').dataset.humanEdited='1'});}
    }
    if(!$('taxCategoryEvidence')){
      const p=document.createElement('div');p.id='taxCategoryEvidence';p.className='info';p.style.marginTop='10px';p.innerHTML='<b>🧾 課稅別判斷</b><div id="taxCategoryEvidenceBody" style="margin-top:6px">等待發票辨識。</div><div style="margin-top:8px"><img id="taxCategoryRoiPreview" style="display:none;max-width:100%;max-height:190px;border:1px solid #e2e8f0;border-radius:10px;background:#fff"></div><div class="actions" style="margin-top:8px"><button id="taxCategoryLocal" class="btn ghost">🔍 本地專看票面 V</button><button id="taxCategoryGemma" class="btn secondary">👁 Gemma 專看課稅別小區塊</button></div>';const c=$('conflicts');if(c)c.insertAdjacentElement('afterend',p);else $('gross')?.closest('.card')?.appendChild(p);
    }
    ['track','number','date','seller','buyer','net','tax','gross','sellerName'].forEach(id=>{const el=$(id);if(el&&!el.dataset.v152HumanBound){el.dataset.v152HumanBound='1';el.addEventListener('input',e=>{if(e.isTrusted)el.dataset.humanEdited='1'})}});
  }

  function status(cls,text){ensureUi();const e=$('hfStatus');if(e){e.className=cls;e.textContent=text}}
  function meta(text){const e=$('hfMeta');if(e)e.textContent=text}
  function taxShow(cls,text,source){ensureUi();const p=$('taxCategoryEvidence'),b=$('taxCategoryEvidenceBody'),s=$('sTaxCategory');if(p)p.className=cls;if(b)b.textContent=text;if(s)s.textContent=source||'—'}
  function releaseShow(cls,html){ensureUi();const p=$('releaseContract152'),b=$('releaseContract152Body');if(p)p.className=cls;if(b)b.innerHTML=html}
  function lockGemma(locked,reason=''){for(const id of ['hfRun','hfBuyer','taxCategoryGemma']){const b=$(id);if(b){b.disabled=!!locked;b.title=locked?reason:'Backend 已驗證'}}}

  function parseSse(text){
    let last=null,complete=null,event='';
    for(const line of String(text||'').split(/\r?\n/)){
      if(line.startsWith('event:'))event=line.slice(6).trim();
      else if(line.startsWith('data:')){try{const j=JSON.parse(line.slice(5).trim());last=j;if(event==='complete')complete=j}catch{}}
    }
    const v=complete??last;return Array.isArray(v)?v[0]:v;
  }

  async function callGradio(apiName,data,timeoutMs=180000,retries=2){
    const base=space();let lastErr=null;
    for(let attempt=0;attempt<=retries;attempt++){
      const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeoutMs);
      try{
        const s=await fetch(`${base}/gradio_api/call/${apiName}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data}),signal:ctl.signal});
        if(!s.ok)throw new Error(`submit HTTP ${s.status}`);const sj=await s.json();if(!sj.event_id)throw new Error('沒有 event_id');
        const r=await fetch(`${base}/gradio_api/call/${apiName}/${sj.event_id}`,{signal:ctl.signal});if(!r.ok)throw new Error(`result HTTP ${r.status}`);
        const text=await r.text(),payload=parseSse(text);if(payload!==null&&payload!==undefined)return payload;
        throw new Error('Space 沒有回傳完成結果');
      }catch(e){lastErr=e;if(attempt<retries)await sleep(1200*(attempt+1));}
      finally{clearTimeout(timer)}
    }
    throw lastErr||new Error('ZeroGPU 呼叫失敗');
  }

  async function verifyBackend(){
    ensureUi();lockGemma(true,'等待 V1.5.2 release 驗證');status('info','正在驗證 ZeroGPU Backend release…');
    try{
      const h=await callGradio('health_api',['health'],60000,1);const v=String(h?.backend_version||h?.version||'未知'),r=String(h?.release_id||'未提供'),ok=v===VERSION&&r===RELEASE_ID&&h?.dedicated_tax_category_api===true;
      backendVerified=ok;window.__taxAiReleaseContract={frontend:VERSION,backend:v,release:r,verified:ok,health:h};
      if(ok){lockGemma(false);$('hfBadge').textContent='V1.5.2 已驗證';status('ok',`✓ ZeroGPU Backend V${v} 已驗證，課稅別專用 API 啟用。`);meta(`release=${r}｜GPU=${h.gpu_mode||'ZeroGPU'}｜model=${h.model||'Gemma 4 E4B'}`);releaseShow('ok',`✅ Frontend V${VERSION} ⇄ Backend V${v}<br><code>${r}</code>`);return true;}
      lockGemma(true,`Backend V${v} / ${r} 與 V1.5.2 不符`);$('hfBadge').textContent='Backend 版本不符';status('warn',`⚠ Backend V${v} 尚未與 Frontend V${VERSION} 同步。QR／本地 OCR 可用，Gemma 已安全鎖定。`);releaseShow('warn',`❌ Frontend V${VERSION}／<code>${RELEASE_ID}</code><br>Backend V${v}／<code>${r}</code><br>Gemma 新功能不會啟用。`);return false;
    }catch(e){backendVerified=false;lockGemma(true,'無法驗證 Backend');$('hfBadge').textContent='Backend 未驗證';status('warn','⚠ 無法驗證 ZeroGPU Backend：'+(e.message||e));releaseShow('warn',`⚠ Backend 無法驗證，Gemma 已安全鎖定。<br>${e.message||e}`);return false}
  }

  function parseTaiwanQr(raw){
    let q=String(raw||'').trim().toUpperCase();const pos=q.search(/[A-Z]{2}\d{8}/);if(pos>0)q=q.slice(pos);if(q.length<53||!/^[A-Z]{2}\d{8}/.test(q))return null;
    const inv=q.slice(0,10),roc=q.slice(10,17),netHex=q.slice(21,29),grossHex=q.slice(29,37),buyer=q.slice(37,45),seller=q.slice(45,53);
    if(!/^\d{7}$/.test(roc)||!/^[0-9A-F]{8}$/.test(netHex)||!/^[0-9A-F]{8}$/.test(grossHex)||!/^\d{8}$/.test(buyer)||!/^\d{8}$/.test(seller))return null;
    const net=parseInt(netHex,16),gross=parseInt(grossHex,16);if(!Number.isFinite(net)||!Number.isFinite(gross)||gross<net)return null;
    const y=parseInt(roc.slice(0,3),10)+1911,m=roc.slice(3,5),d=roc.slice(5,7);
    return {raw:q,track:inv.slice(0,2),number:inv.slice(2),date:`${y}-${m}-${d}`,seller,buyer:/^0{8}$/.test(buyer)?'':buyer,net,tax:gross-net,gross};
  }

  function scanPreviewQr(){
    const img=$('preview');if(!window.jsQR||!img?.complete)return null;const W=img.naturalWidth||img.width,H=img.naturalHeight||img.height;if(W<50||H<50)return null;
    const scale=Math.min(1,1800/Math.max(W,H)),c=document.createElement('canvas');c.width=Math.round(W*scale);c.height=Math.round(H*scale);c.getContext('2d',{willReadFrequently:true}).drawImage(img,0,0,c.width,c.height);
    const regs=[[0,0,c.width,c.height],[0,0,Math.ceil(c.width*.6),c.height],[0,Math.floor(c.height*.35),Math.ceil(c.width*.65),Math.ceil(c.height*.65)],[0,0,Math.ceil(c.width*.6),Math.ceil(c.height*.6)]];
    for(const [x,y,w0,h0] of regs){const w=Math.min(w0,c.width-x),h=Math.min(h0,c.height-y);try{const im=c.getContext('2d',{willReadFrequently:true}).getImageData(x,y,w,h),r=jsQR(im.data,w,h,{inversionAttempts:'attemptBoth'}),p=parseTaiwanQr(r?.data);if(p)return p}catch{}}
    return null;
  }

  function resolveQr(){try{for(const q of (state?.qr||[])){const p=parseTaiwanQr(q);if(p)return p}}catch{}return scanPreviewQr()}
  function applyQr(p){
    if(!p)return null;const src='QR Code（權威資料）';
    for(const [id,v,label] of [['track',p.track,'字軌'],['number',p.number,'號碼'],['date',p.date,'日期'],['seller',p.seller,'賣方統編'],['net',p.net,'銷售額'],['tax',p.tax,'總額－銷售額'],['gross',p.gross,'總額']]){const el=$(id);if(el){if(el.dataset.humanEdited!=='1'||String(el.value||'')===String(v)){el.value=String(v);el.dataset.qrAuthority='1';try{setSource(id,`${src}：${label}`)}catch{}}}}
    if(p.buyer){const el=$('buyer');if(el&&(el.dataset.humanEdited!=='1'||String(el.value||'')===p.buyer)){el.value=p.buyer;el.dataset.qrAuthority='1';try{setSource('buyer',src+'：買方統編')}catch{}}}
    const b=$('qrAuthority152Body');if(b)b.innerHTML=`<b>${p.track}-${p.number}</b>　日期 ${p.date}<br>賣方統編 <b>${p.seller}</b>　買方統編 <b>${p.buyer||'未登載'}</b><br><span style="font-size:1.12em">未稅／銷售額 <b>${p.net.toLocaleString('zh-TW')}</b>　稅額 <b>${p.tax.toLocaleString('zh-TW')}</b>　含稅總額 <b>${p.gross.toLocaleString('zh-TW')}</b></span><br><small>電子發票 QR 權威來源；不需要 ZeroGPU。</small>`;
    const panel=$('qrAuthority152');if(panel)panel.className='ok';window.__taxAiQr152=p;try{validateRecognition()}catch{};structuralTaxCategory();return p;
  }

  function setTaxCategory(cat,source,evidence,force=false){const sel=$('taxCategory');if(!sel)return;if(sel.dataset.humanEdited==='1'&&sel.value!==cat&&!force){taxShow('warn',`新判斷「${cat}」與人工「${sel.value}」不同；保留人工值。`,'人工確認');return}sel.value=cat;sel.dataset.aiSource=source;taxShow(cat==='待確認'?'warn':'ok',`${cat==='待確認'?'⚠':'✓'} 課稅別：${cat}｜${evidence}`,source)}
  function structuralTaxCategory(){
    ensureUi();const q=window.__taxAiQr152,tax=Number.isFinite(num(q?.tax))?num(q.tax):num($('tax')?.value),net=Number.isFinite(num(q?.net))?num(q.net):num($('net')?.value),gross=Number.isFinite(num(q?.gross))?num(q.gross):num($('gross')?.value);
    if(Number.isFinite(tax)&&tax>0){let ev=`稅額 ${Math.round(tax)} > 0`;if(Number.isFinite(net)&&Number.isFinite(gross)&&Math.round(net+tax)===Math.round(gross))ev+=`；${Math.round(net)} + ${Math.round(tax)} = ${Math.round(gross)}`;if(q)ev='電子發票 QR：'+ev;setTaxCategory('應稅',q?'QR／稅額結構判定':'稅額結構判定',ev);return '應稅'}
    if(Number.isFinite(tax)&&tax===0)taxShow('info','稅額為 0，需看票面標記才能區分零稅率與免稅。','結構判定');return null;
  }

  function cropTaxRow(){const img=$('preview');if(!img?.complete)return '';const W=img.naturalWidth||img.width,H=img.naturalHeight||img.height;if(W<100||H<100)return '';const sx=Math.round(W*.30),sy=Math.round(H*.46),sw=Math.round(W*.40),sh=Math.round(H*.25),c=document.createElement('canvas'),scale=Math.min(3.2,1600/Math.max(1,sw));c.width=Math.round(sw*scale);c.height=Math.round(sh*scale);c.getContext('2d').drawImage(img,sx,sy,sw,sh,0,0,c.width,c.height);const url=c.toDataURL('image/png'),p=$('taxCategoryRoiPreview');if(p){p.src=url;p.style.display='block'}return url}
  function parseTaxText(text){const t=String(text||'').replace(/[：:]/g,' ').replace(/\s+/g,' ').trim(),mark='(?:V|v|✓|√|✔|☑|Y)';if(new RegExp(`應\\s*稅\\s*${mark}`,'i').test(t))return '應稅';if(new RegExp(`零\\s*稅\\s*率\\s*${mark}`,'i').test(t))return '零稅率';if(new RegExp(`免\\s*稅\\s*${mark}`,'i').test(t))return '免稅';return null}
  async function localTaxCategory(){structuralTaxCategory();const image=cropTaxRow();if(!image||!window.Tesseract?.createWorker)return null;const btn=$('taxCategoryLocal');if(btn)btn.disabled=true;taxShow('info','本地 OCR 正在只看「應稅／零稅率／免稅」小區塊…','本地 ROI OCR');let w=null;try{w=await Tesseract.createWorker('chi_tra+eng',1);try{await w.setParameters({tessedit_pageseg_mode:'6',preserve_interword_spaces:'1'})}catch{}const r=await w.recognize(image),text=r.data.text||'',cat=parseTaxText(text);if(cat){if(cat!=='應稅'&&structuralTaxCategory()==='應稅'){taxShow('warn',`本地 OCR 判「${cat}」，但 QR／稅額結構判「應稅」；不自動覆寫。OCR：${text.trim().slice(0,120)}`,'來源衝突')}else setTaxCategory(cat,'本地 ROI OCR：票面標記',`OCR：${text.trim().slice(0,120)}`,true)}else if(structuralTaxCategory()!=='應稅')taxShow('warn',`本地 OCR 未可靠讀出課稅別標記：${text.trim().slice(0,120)||'無文字'}`,'本地 ROI OCR');return {text,cat}}catch(e){taxShow('warn','本地課稅別 OCR 失敗：'+(e.message||e),'本地 ROI OCR');return null}finally{try{await w?.terminate()}catch{}if(btn)btn.disabled=false}}

  async function gemmaTaxCategory(){if(!backendVerified){await verifyBackend();if(!backendVerified)return null}const image=cropTaxRow();if(!image)return null;taxShow('info','Gemma 4 E4B 正在只看課稅別小區塊…','Gemma 課稅別');try{const j=await callGradio('tax_category_api',[image],120000,1),cat=['應稅','零稅率','免稅','待確認'].includes(j?.category)?j.category:'待確認',structural=structuralTaxCategory();if(structural==='應稅'&&(cat==='零稅率'||cat==='免稅')){taxShow('warn',`Gemma 判「${cat}」，但 QR／稅額結構判「應稅」；不覆寫。視覺證據：${j.evidence||'—'}`,'來源衝突')}else setTaxCategory(cat,'Gemma 課稅別專用裁切',`${j.evidence||'—'}；confidence ${Math.round((Number(j.confidence)||0)*100)}%`,cat==='應稅');return j}catch(e){taxShow('warn','Gemma 課稅別辨識失敗：'+(e.message||e),'Gemma 課稅別');return null}}

  function reverseTax(){const g=num($('gross')?.value);if(!Number.isFinite(g)){status('warn','請先取得有效含稅總額。');return}const gross=Math.round(g),tax=Math.round((gross/1.05)*.05),net=gross-tax;setField('net',net,'5%含稅反算');setField('tax',tax,'5%含稅反算');try{validateRecognition()}catch{}status('ok',`✓ 反算完成：${gross} = 未稅 ${net} + 稅額 ${tax}`);structuralTaxCategory()}

  function mapGemma(resp){const first=resp?.results?.[0];if(!first)throw new Error('Gemma 未回傳發票結果');const d=first.data||{},src='HF-ZeroGPU:Gemma4E4B V1.5.2',m=String(d.invoice_number||'').toUpperCase().replace(/\s/g,'').match(/^([A-Z]{2})-?(\d{8})$/);if(m){setField('track',m[1],src);setField('number',m[2],src)}setField('date',String(d.invoice_date||'').slice(0,10),src);setField('seller',d.seller_tax_id,src);setField('buyer',d.buyer_tax_id,src);setField('net',d.sales_amount,src);setField('tax',d.tax_amount,src);setField('gross',d.total_amount,src);setField('sellerName',d.seller_name,src);if(d.tax_category&&d.tax_category!=='待確認'){const structural=structuralTaxCategory();if(!(structural==='應稅'&&['零稅率','免稅'].includes(d.tax_category)))setTaxCategory(d.tax_category,'Gemma 整張票面',d.tax_category_evidence||d.tax_category_source||'票面視覺')}try{validateRecognition()}catch{}return d}
  async function runInvoiceGemma(){if(!backendVerified){await verifyBackend();if(!backendVerified)return null}const file=getFile();if(!file)return null;status('info','Gemma 4 E4B 正在交叉辨識…');try{const image=correctedImage()||await fileToDataURL(file),r=await callGradio('invoice_api',[image],240000,1),d=mapGemma(r);status('ok',`✓ Gemma V1.5.2 交叉辨識完成${d.tax_category?'；課稅別 '+d.tax_category:''}。`);return r}catch(e){status('warn','⚠ Gemma 辨識失敗：'+(e.message||e)+'。QR／本地 OCR 保留。');return null}}
  async function runBuyer(){if(!backendVerified){await verifyBackend();if(!backendVerified)return null}const cvs=[...document.querySelectorAll('#gfCells canvas')];if(cvs.length!==8){status('warn','找不到完整 8 格；不送模型猜測。');return null}const c=document.createElement('canvas');c.width=8*96;c.height=96;const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);cvs.forEach((x,i)=>ctx.drawImage(x,i*96,0,96,96));try{const j=await callGradio('buyer_ban_api',[c.toDataURL('image/png')],120000,1),ban=String(j?.buyer_tax_id||'');if(/^\d{8}$/.test(ban))setField('buyer',ban,'Gemma 8格');return j}catch(e){status('warn','8格辨識失敗：'+(e.message||e));return null}}

  ensureUi();
  const subtitle=document.querySelector('.top .muted');if(subtitle)subtitle.textContent='V1.5.2｜單一核心 core-v152＋QR＋課稅別＋ZeroGPU Release Contract';
  const hero=document.querySelector('.hero');if(hero)hero.innerHTML='<b>V1.5.2：</b>不再疊用 V1.4.9／V1.5.0 控制模組。QR、ZeroGPU、金額、課稅別與版本合約全部由單一 core-v152 管理；只有後端 release 完全一致才啟用 Gemma。';
  const scan=$('scan');if(scan){const old=scan.onclick;scan.textContent='✨ V1.5.2：本地辨識＋QR＋課稅別';scan.onclick=async function(){const r=typeof old==='function'?await old.call(scan):undefined;const q=resolveQr();if(q)applyQr(q);else structuralTaxCategory();setTimeout(localTaxCategory,80);return r}}
  $('hfHealth').onclick=verifyBackend;$('hfRun').onclick=runInvoiceGemma;$('hfBuyer').onclick=runBuyer;$('hfReverseTax').onclick=reverseTax;$('taxCategoryLocal').onclick=localTaxCategory;$('taxCategoryGemma').onclick=gemmaTaxCategory;
  lockGemma(true,'等待 V1.5.2 Backend release 驗證');setTimeout(verifyBackend,900);
  window.__taxAiCore152Api={verifyBackend,resolveQr,applyQr,structuralTaxCategory,localTaxCategory,gemmaTaxCategory,runInvoiceGemma};
  console.info('[TaxAI] Unified Core V1.5.2 active',RELEASE_ID);
})();
