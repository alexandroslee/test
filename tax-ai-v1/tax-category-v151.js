(function(){
  if(window.__taxAiTaxCategory151)return;
  window.__taxAiTaxCategory151=true;
  const $=id=>document.getElementById(id);
  const allowed=['待確認','應稅','零稅率','免稅'];

  function num(v){const s=String(v??'').replace(/[,，\s$NTnt元]/g,'');return /^-?\d+(?:\.\d+)?$/.test(s)?Number(s):NaN}
  function ensureUi(){
    let sel=$('taxCategory');
    if(!sel){
      const gross=$('gross');if(!gross)return null;
      const field=document.createElement('div');field.className='field';field.id='taxCategoryField';
      field.innerHTML=`<label>課稅別 <span id="sTaxCategory" class="src">—</span></label><select id="taxCategory"><option value="待確認">⚠ 待確認</option><option value="應稅">✅ 應稅</option><option value="零稅率">0% 零稅率</option><option value="免稅">免稅</option></select>`;
      gross.closest('.field')?.insertAdjacentElement('afterend',field);sel=$('taxCategory');
    }
    if(sel&&!sel.dataset.v151Bound){sel.dataset.v151Bound='1';sel.addEventListener('input',e=>{if(e.isTrusted){sel.dataset.humanEdited='1';show('info',`人工確認課稅別：${sel.value}`,'人工確認')}})}
    let panel=$('taxCategoryEvidence');
    if(!panel){
      panel=document.createElement('div');panel.id='taxCategoryEvidence';panel.className='info';panel.style.marginTop='10px';
      panel.innerHTML=`<b>🧾 課稅別判斷 V1.5.1</b><div id="taxCategoryEvidenceBody" style="margin-top:6px">等待發票辨識。</div><div style="margin-top:8px"><img id="taxCategoryRoiPreview" style="display:none;max-width:100%;max-height:190px;border:1px solid #e2e8f0;border-radius:10px;background:#fff"></div><div class="actions" style="margin-top:8px"><button id="taxCategoryLocal" class="btn ghost">🔍 本地專看票面 V</button><button id="taxCategoryGemma" class="btn secondary">👁 Gemma 專看課稅別小區塊</button></div>`;
      const conflicts=$('conflicts');if(conflicts)conflicts.insertAdjacentElement('afterend',panel);else $('gross')?.closest('.card')?.appendChild(panel);
    }
    return sel;
  }
  function show(cls,text,source){ensureUi();const p=$('taxCategoryEvidence'),b=$('taxCategoryEvidenceBody'),s=$('sTaxCategory');if(p)p.className=cls;if(b)b.textContent=text;if(s&&source)s.textContent=source}
  function setCat(cat,source,evidence,force=false){
    const sel=ensureUi();if(!sel)return false;cat=allowed.includes(cat)?cat:'待確認';
    if(sel.dataset.humanEdited==='1'&&sel.value!==cat&&!force){show('warn',`新判斷為「${cat}」，但人工已確認「${sel.value}」；保留人工值。${evidence||''}`,'人工確認');return false}
    sel.value=cat;sel.dataset.aiSource=source||'';show(cat==='待確認'?'warn':'ok',`${cat==='待確認'?'⚠':'✓'} 課稅別：${cat}｜${evidence||''}`,source||'—');
    window.__taxAiTaxCategoryState={category:cat,source,evidence};return true;
  }

  function structural(){
    ensureUi();
    const q=window.__taxAiLastQrAuthority;
    const tax=Number.isFinite(num(q?.tax))?num(q.tax):num($('tax')?.value);
    const net=Number.isFinite(num(q?.net))?num(q.net):num($('net')?.value);
    const gross=Number.isFinite(num(q?.gross))?num(q.gross):num($('gross')?.value);
    if(Number.isFinite(tax)&&tax>0){
      let ev=`稅額 ${Math.round(tax)} > 0`;
      if(Number.isFinite(net)&&Number.isFinite(gross)&&Math.round(net+tax)===Math.round(gross))ev+=`；${Math.round(net)} + ${Math.round(tax)} = ${Math.round(gross)}`;
      if(q)ev='電子發票 QR：'+ev;
      const current=$('taxCategory')?.value||'待確認';
      if(current==='零稅率'||current==='免稅'){show('warn',`課稅別衝突：目前「${current}」，但${ev}。請人工核對。`,'結構交叉驗證');return current}
      setCat('應稅',q?'QR／稅額結構判定':'稅額結構判定',ev);
      return '應稅';
    }
    if(Number.isFinite(tax)&&tax===0&&($('taxCategory')?.value||'待確認')==='待確認')show('info','稅額為 0，無法只靠金額區分零稅率與免稅；需看票面標記。','結構交叉驗證');
    return null;
  }

  function cropTaxRow(){
    const img=$('preview');if(!img||!img.complete)return '';
    const W=img.naturalWidth||img.width,H=img.naturalHeight||img.height;if(W<100||H<100)return '';
    const sx=Math.round(W*.30),sy=Math.round(H*.47),sw=Math.round(W*.38),sh=Math.round(H*.23);
    const c=document.createElement('canvas');const scale=Math.min(3.2,1500/Math.max(1,sw));c.width=Math.max(1,Math.round(sw*scale));c.height=Math.max(1,Math.round(sh*scale));
    const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,sx,sy,sw,sh,0,0,c.width,c.height);
    const url=c.toDataURL('image/png');const p=$('taxCategoryRoiPreview');if(p){p.src=url;p.style.display='block'}return url;
  }

  function parseLocalText(text){
    const t=String(text||'').replace(/[：:]/g,' ').replace(/\s+/g,' ').trim();
    const mark='(?:V|v|✓|√|✔|☑|Y)';
    if(new RegExp(`應\\s*稅\\s*${mark}`,'i').test(t))return {category:'應稅',evidence:`本地 ROI OCR：「${t.slice(0,120)}」；標記位於應稅旁`};
    if(new RegExp(`零\\s*稅\\s*率\\s*${mark}`,'i').test(t))return {category:'零稅率',evidence:`本地 ROI OCR：「${t.slice(0,120)}」；標記位於零稅率旁`};
    if(new RegExp(`免\\s*稅\\s*${mark}`,'i').test(t))return {category:'免稅',evidence:`本地 ROI OCR：「${t.slice(0,120)}」；標記位於免稅旁`};
    const m=t.match(/應\s*稅\s*(V|v|✓|√|✔|☑|Y)\s*零\s*稅\s*率.*免\s*稅/i);
    if(m)return {category:'應稅',evidence:`本地 ROI OCR 讀到「應稅 ${m[1]}／零稅率／免稅」排列`};
    return null;
  }

  async function localOcr(){
    structural();const image=cropTaxRow();if(!image){show('warn','找不到方向校正後的課稅別區塊。','本地 ROI OCR');return null}
    if(!window.Tesseract?.createWorker){show('warn','本地 OCR 尚未載入；結構判定仍保留。','本地 ROI OCR');return null}
    const btn=$('taxCategoryLocal');if(btn)btn.disabled=true;show('info','本地 OCR 正在只看「應稅／零稅率／免稅」小區塊…','本地 ROI OCR');
    let worker=null;
    try{
      worker=await Tesseract.createWorker('chi_tra+eng',1);
      try{await worker.setParameters({tessedit_pageseg_mode:'6',preserve_interword_spaces:'1'})}catch{}
      const r=await worker.recognize(image),text=r?.data?.text||'',hit=parseLocalText(text),structuralCat=structural();
      if(hit){
        if(structuralCat==='應稅'&&(hit.category==='零稅率'||hit.category==='免稅')){show('warn',`本地 ROI OCR 判「${hit.category}」，但 QR／稅額結構判「應稅」；保留應稅並要求人工核對。OCR：${text.trim().slice(0,140)}`,'來源衝突');return {text,hit}}
        setCat(hit.category,'本地 ROI OCR：票面標記',`${hit.evidence}；OCR confidence ${Math.round(Number(r.data.confidence)||0)}%`,true);return {text,hit}
      }
      if(structuralCat==='應稅'){show('ok',`✓ 課稅別：應稅｜結構證據已成立；本地 ROI OCR 未可靠讀出小 V，不因此降回待確認。OCR：${text.trim().slice(0,120)||'無文字'}`,'QR／稅額結構判定');return {text,hit:null}}
      show('warn',`本地 ROI OCR 尚未可靠辨識課稅別標記：${text.trim().slice(0,140)||'無文字'}`,'本地 ROI OCR');return {text,hit:null}
    }catch(e){structural();show('warn',`本地課稅別 OCR 失敗：${e.message||e}；結構判定仍保留。`,'結構判定');return null}
    finally{try{await worker?.terminate()}catch{}if(btn)btn.disabled=false}
  }

  function parseSse(text){let event='',last=null,complete=null;for(const line of String(text||'').split(/\r?\n/)){if(line.startsWith('event:'))event=line.slice(6).trim();else if(line.startsWith('data:')){try{const j=JSON.parse(line.slice(5).trim());last=j;if(event==='complete')complete=j}catch{}}}const v=complete??last;return Array.isArray(v)?v[0]:v}
  async function vision(){
    structural();const image=cropTaxRow();if(!image){show('warn','找不到方向校正後的發票影像。請先完成一次辨識。','課稅別專用視覺');return null}
    const fetchReal=window.__taxAiGemmaDirectFetch||window.fetch.bind(window),base=String($('hfSpaceUrl')?.value||'https://alexandroslee-tax-ai-zerogpu.hf.space').replace(/\/+$/,''),btn=$('taxCategoryGemma');if(btn)btn.disabled=true;
    show('info','Gemma 4 E4B 正在只看「應稅／零稅率／免稅」裁切區。','課稅別專用視覺');const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),120000);
    try{
      const s=await fetchReal(`${base}/gradio_api/call/tax_category_api`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:[image]}),signal:ctl.signal});if(!s.ok)throw new Error(`submit HTTP ${s.status}`);const sj=await s.json();if(!sj.event_id)throw new Error('沒有 event_id');
      const r=await fetchReal(`${base}/gradio_api/call/tax_category_api/${sj.event_id}`,{signal:ctl.signal});if(!r.ok)throw new Error(`result HTTP ${r.status}`);const j=parseSse(await r.text());if(!j)throw new Error('沒有完成結果');
      const cat=allowed.includes(j.category)?j.category:'待確認',ev=j.evidence||'未提供視覺證據',structuralCat=structural();
      if(structuralCat==='應稅'&&(cat==='零稅率'||cat==='免稅')){show('warn',`Gemma 判「${cat}」，但 QR／稅額結構已判「應稅」；不自動覆寫。視覺證據：${ev}`,'來源衝突');return j}
      if(cat==='應稅')setCat('應稅','Gemma 課稅別專用裁切',`${ev}；confidence ${Math.round((Number(j.confidence)||0)*100)}%`,true);
      else if(cat!=='待確認'&&structuralCat==null)setCat(cat,'Gemma 課稅別專用裁切',ev);
      else if(cat==='待確認'&&structuralCat!=='應稅')setCat('待確認','Gemma 課稅別專用裁切',ev);
      return j;
    }catch(e){structural();show('warn',`課稅別專用 Gemma 辨識失敗：${e.message||e}。結構判定仍保留。`,'結構判定');return null}
    finally{clearTimeout(timer);if(btn)btn.disabled=false}
  }

  ensureUi();if($('taxCategoryGemma'))$('taxCategoryGemma').onclick=vision;if($('taxCategoryLocal'))$('taxCategoryLocal').onclick=localOcr;
  const scan=$('scan');if(scan){const old=scan.onclick;scan.onclick=async function(){const r=typeof old==='function'?await old.call(scan):undefined;structural();setTimeout(localOcr,80);return r}}
  ['net','tax','gross'].forEach(id=>$(id)?.addEventListener('change',structural));setTimeout(structural,900);
  const subtitle=document.querySelector('.top .muted');if(subtitle)subtitle.textContent='V1.5.1｜QR 結構判定＋本地 ROI OCR＋課稅別專用 Gemma';
  const hero=document.querySelector('.hero');if(hero)hero.innerHTML='<b>V1.5.1：</b>課稅別改成核心欄位。電子發票稅額 > 0 立即判「應稅」；票面證據則只裁「應稅／零稅率／免稅」區塊，先用本地 OCR 看 V，再可用 Gemma 專用小圖交叉辨識。';
  const h2=$('hfZeroGpuCard')?.querySelector('h2');if(h2)h2.textContent='☁️ 1.5.1 Hugging Face ZeroGPU｜Gemma 4 E4B';
  window.__taxAiTaxCategory151Api={structural,localOcr,vision,cropTaxRow};console.info('[TaxAI] Tax Category core V1.5.1 active');
})();
