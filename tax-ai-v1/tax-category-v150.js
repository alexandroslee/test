(function(){
  if(window.__taxAiTaxCategory150)return;
  window.__taxAiTaxCategory150=true;
  const $=id=>document.getElementById(id);
  const allowed=['待確認','應稅','零稅率','免稅'];

  function num(v){
    const s=String(v??'').replace(/[,，\s$NTnt元]/g,'');
    if(!s||!/^-?\d+(?:\.\d+)?$/.test(s))return NaN;
    return Number(s);
  }

  function ensureUi(){
    let select=$('taxCategory');
    if(select)return select;
    const gross=$('gross');
    if(!gross)return null;
    const field=document.createElement('div');
    field.className='field';
    field.id='taxCategoryField';
    field.innerHTML=`<label>課稅別 <span id="sTaxCategory" class="src">—</span></label>
      <select id="taxCategory">
        <option value="待確認">⚠ 待確認</option>
        <option value="應稅">✅ 應稅</option>
        <option value="零稅率">0% 零稅率</option>
        <option value="免稅">免稅</option>
      </select>
      <div id="taxCategoryHint" class="muted small" style="margin-top:5px">優先看票面「應稅／零稅率／免稅」的 V／✓／勾選位置；金額只做交叉驗證。</div>`;
    gross.closest('.field')?.insertAdjacentElement('afterend',field);
    select=$('taxCategory');
    if(select){
      select.addEventListener('input',e=>{
        if(e.isTrusted){
          select.dataset.humanEdited='1';
          setSource('人工確認');
          showEvidence('info',`人工確認課稅別：${select.value}。`);
        }
      });
    }

    let panel=$('taxCategoryEvidence');
    if(!panel){
      panel=document.createElement('div');
      panel.id='taxCategoryEvidence';panel.className='info';panel.style.marginTop='10px';
      panel.innerHTML='<b>🧾 課稅別判斷</b><div id="taxCategoryEvidenceBody" style="margin-top:6px">等待發票辨識。</div><div class="actions" style="margin-top:8px"><button id="taxCategoryGemma" class="btn secondary">👁 Gemma 看票面課稅別</button></div>';
      const resultCard=gross.closest('.card');
      const conflicts=$('conflicts');
      if(conflicts)conflicts.insertAdjacentElement('afterend',panel);else resultCard?.appendChild(panel);
    }
    return select;
  }

  function setSource(source){const s=$('sTaxCategory');if(s)s.textContent=source||'—'}
  function showEvidence(cls,text){
    ensureUi();
    const p=$('taxCategoryEvidence'),b=$('taxCategoryEvidenceBody');
    if(p)p.className=cls||'info';
    if(b)b.textContent=text||'';
  }

  function setCategory(category,source,evidence,opts={}){
    const select=ensureUi();if(!select)return false;
    const cat=allowed.includes(category)?category:'待確認';
    const existing=select.value||'待確認';
    const human=select.dataset.humanEdited==='1';
    if(human&&existing!==cat&&!opts.force){
      showEvidence('warn',`AI／金額判斷為「${cat}」，但人工已確認「${existing}」；保留人工值。${evidence?' '+evidence:''}`);
      return false;
    }
    if(existing!==cat&&opts.conflictOnDifferent&&existing!=='待確認'){
      showEvidence('warn',`課稅別來源衝突：目前「${existing}」，新來源判斷「${cat}」。不自動覆寫，請人工核對。${evidence?' '+evidence:''}`);
      return false;
    }
    select.value=cat;
    select.dataset.aiSource=source||'';
    setSource(source||'—');
    const cls=cat==='待確認'?'warn':'ok';
    showEvidence(cls,`${cat==='待確認'?'⚠':'✓'} 課稅別：${cat}｜來源：${source||'未判定'}${evidence?'｜'+evidence:''}`);
    window.__taxAiTaxCategoryState={category:cat,source:source||'',evidence:evidence||''};
    return true;
  }

  function inferFromAmounts(){
    ensureUi();
    const tax=num($('tax')?.value),net=num($('net')?.value),gross=num($('gross')?.value);
    if(Number.isFinite(tax)&&tax>0){
      const evidence=[];
      evidence.push(`稅額 ${Math.round(tax)} > 0`);
      if(Number.isFinite(net)&&Number.isFinite(gross)&&Math.round(net+tax)===Math.round(gross))evidence.push(`${Math.round(net)} + ${Math.round(tax)} = ${Math.round(gross)}`);
      if(Number.isFinite(net)&&net>0&&Math.abs(Math.round(net*.05)-Math.round(tax))<=1)evidence.push('5% 稅額交叉檢查一致');
      const current=$('taxCategory')?.value||'待確認';
      if(current==='零稅率'||current==='免稅'){
        showEvidence('warn',`⚠ 課稅別衝突：目前為「${current}」，但票面／QR 稅額 ${Math.round(tax)} > 0。請人工核對。`);
        return current;
      }
      setCategory('應稅','金額交叉驗證',evidence.join('；'));
      return '應稅';
    }
    if(Number.isFinite(tax)&&tax===0){
      const cur=$('taxCategory')?.value||'待確認';
      if(cur==='待確認')showEvidence('info','稅額為 0，僅靠金額無法區分「零稅率」與「免稅」；必須看票面勾選。');
    }
    return null;
  }

  function applyQrCategory(){
    const q=window.__taxAiLastQrAuthority;
    if(!q)return false;
    if(Number(q.tax)>0){
      const ev=`QR：銷售額 ${q.net}、稅額 ${q.tax}、總額 ${q.gross}；${q.net}+${q.tax}=${q.gross}`;
      setCategory('應稅','QR 金額交叉驗證',ev);
      return true;
    }
    inferFromAmounts();
    return true;
  }

  function parseSse(text){
    let event='',last=null,complete=null,error=null;
    for(const line of String(text||'').split(/\r?\n/)){
      if(line.startsWith('event:'))event=line.slice(6).trim();
      else if(line.startsWith('data:')){
        const raw=line.slice(5).trim();
        try{
          const j=JSON.parse(raw);last=j;
          if(event==='complete')complete=j;
          if(event==='error')error=j;
        }catch{}
      }
    }
    const v=complete??last;
    return {value:Array.isArray(v)?v[0]:v,error};
  }

  function correctedImage(){
    const p=$('preview');
    const src=String(p?.src||'');
    return /^data:image\//i.test(src)?src:'';
  }

  async function fileDataUrl(){
    let f=null;
    try{f=state?.file||null}catch{}
    if(!f)return '';
    return await new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(String(r.result||''));r.onerror=no;r.readAsDataURL(f)});
  }

  async function gemmaVisualCategory(){
    const fetchReal=window.__taxAiGemmaDirectFetch;
    const base=String($('hfSpaceUrl')?.value||'https://alexandroslee-tax-ai-zerogpu.hf.space').replace(/\/+$/,'');
    if(typeof fetchReal!=='function'){showEvidence('warn','Gemma 直接視覺通道尚未載入。請重新整理 V1.5.0。');return null}
    const image=correctedImage()||await fileDataUrl();
    if(!image){showEvidence('warn','請先拍照或上傳發票。');return null}
    const btn=$('taxCategoryGemma')||$('hfRun');if(btn)btn.disabled=true;
    showEvidence('info','👁 Gemma 4 E4B 正在直接看票面「應稅／零稅率／免稅」及 V／✓／勾選位置…');
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),240000);
    try{
      const start=await fetchReal(`${base}/gradio_api/call/invoice_api`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:[image]}),signal:ctl.signal});
      if(!start.ok)throw new Error(`Gemma submit HTTP ${start.status}`);
      const sj=await start.json();if(!sj.event_id)throw new Error('Gemma 未回 event_id');
      const result=await fetchReal(`${base}/gradio_api/call/invoice_api/${sj.event_id}`,{signal:ctl.signal});
      if(!result.ok)throw new Error(`Gemma result HTTP ${result.status}`);
      const parsed=parseSse(await result.text());
      if(!parsed.value)throw new Error('Gemma 沒有回傳完成資料');
      const first=parsed.value?.results?.[0];const d=first?.data||{};
      const cat=allowed.includes(d.tax_category)?d.tax_category:'待確認';
      const source=d.tax_category_source||'Gemma 票面辨識';
      const evidence=d.tax_category_evidence||'';
      const localTax=num($('tax')?.value);
      if((cat==='零稅率'||cat==='免稅')&&Number.isFinite(localTax)&&localTax>0){
        showEvidence('warn',`⚠ Gemma 票面判斷「${cat}」，但現有稅額為 ${localTax} > 0；不自動覆寫，請人工核對。Gemma 證據：${evidence||'未提供'}`);
        return parsed.value;
      }
      const current=$('taxCategory')?.value||'待確認';
      if(cat==='應稅'&&current==='應稅'){
        // Same category: upgrade the source from amount inference to visual evidence.
        setCategory('應稅',source,evidence,{force:true});
      }else if(cat!=='待確認'){
        setCategory(cat,source,evidence,{conflictOnDifferent:true});
      }else{
        inferFromAmounts();
        if(($('taxCategory')?.value||'待確認')==='待確認')showEvidence('warn',`Gemma 未可靠讀出課稅別。${evidence||'請人工查看票面勾選。'}`);
      }

      const qr=window.__taxAiLastQrAuthority;
      const mismatches=[];
      if(qr){
        if(d.sales_amount!=null&&Number(d.sales_amount)!==Number(qr.net))mismatches.push(`銷售額 Gemma=${d.sales_amount} / QR=${qr.net}`);
        if(d.tax_amount!=null&&Number(d.tax_amount)!==Number(qr.tax))mismatches.push(`稅額 Gemma=${d.tax_amount} / QR=${qr.tax}`);
        if(d.total_amount!=null&&Number(d.total_amount)!==Number(qr.gross))mismatches.push(`總額 Gemma=${d.total_amount} / QR=${qr.gross}`);
      }
      if(mismatches.length)showEvidence('warn',`⚠ Gemma 與 QR 金額有差異：${mismatches.join('；')}。電子發票仍保留 QR 金額；課稅別請人工核對票面。`);
      return parsed.value;
    }catch(e){
      inferFromAmounts();
      showEvidence('warn',`⚠ Gemma 票面課稅別辨識失敗：${e.message||e}。已保留 QR／金額判斷，不影響既有發票資料。`);
      return null;
    }finally{clearTimeout(timer);if(btn)btn.disabled=false}
  }

  ensureUi();
  const catBtn=$('taxCategoryGemma');if(catBtn)catBtn.onclick=gemmaVisualCategory;

  // For an electronic invoice, the existing blue "Gemma cross-check" button now
  // really reaches the model instead of being short-circuited by the QR adapter.
  const hfRun=$('hfRun');
  if(hfRun){
    const old=hfRun.onclick;
    hfRun.textContent='👁 Gemma 票面交叉辨識';
    hfRun.onclick=async()=>{
      if(window.__taxAiLastQrAuthority)return gemmaVisualCategory();
      if(typeof old==='function')return old.call(hfRun);
    };
  }

  const scan=$('scan');
  if(scan){
    const old=scan.onclick;
    scan.onclick=async function(){
      const r=typeof old==='function'?await old.call(scan):undefined;
      // QR parsing is synchronous inside the existing pipeline by this point.
      applyQrCategory()||inferFromAmounts();
      return r;
    };
  }

  ['net','tax','gross'].forEach(id=>$(id)?.addEventListener('change',inferFromAmounts));
  setTimeout(()=>{applyQrCategory()||inferFromAmounts()},900);

  const subtitle=document.querySelector('.top .muted');
  if(subtitle)subtitle.textContent='V1.5.0｜電子發票 QR＋課稅別（應稅／零稅率／免稅）＋Gemma 票面勾選交叉辨識';
  const hero=document.querySelector('.hero');
  if(hero)hero.innerHTML='<b>V1.5.0：</b>新增正式「課稅別」欄位。優先辨識票面「應稅／零稅率／免稅」的 V／✓／勾選位置；電子發票若 QR 稅額大於 0，可先以金額交叉驗證為「應稅」，再按 Gemma 票面交叉辨識確認勾選。QR 金額仍為電子發票最高權威來源。';
  console.info('[TaxAI] Tax Category V1.5.0 active');
})();
