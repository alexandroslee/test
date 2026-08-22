(function(){
  if(window.__taxAiReleaseContract152)return;
  window.__taxAiReleaseContract152=true;

  const FRONTEND_VERSION='1.5.2';
  const RELEASE_ID='tax-ai-1.5.2-20260822-1555';
  const $=id=>document.getElementById(id);
  const gemmaButtons=['hfRun','hfBuyer','taxCategoryGemma'];

  function lockGemma(locked,reason=''){
    for(const id of gemmaButtons){
      const b=$(id);if(!b)continue;
      b.disabled=!!locked;
      b.title=locked?(reason||'等待 ZeroGPU Backend release 驗證'):'Backend release 已驗證';
    }
  }

  function ensurePanel(){
    let p=$('releaseContract152');
    if(p)return p;
    p=document.createElement('div');p.id='releaseContract152';p.className='warn';p.style.marginTop='10px';
    p.innerHTML='<b>🔐 Release Contract</b><div id="releaseContract152Body" style="margin-top:6px">正在驗證 Frontend / ZeroGPU Backend 是否為同一 release…</div>';
    const old=$('backendVersion151');
    if(old)old.insertAdjacentElement('afterend',p);
    else $('hfZeroGpuCard')?.appendChild(p);
    return p;
  }

  function show(cls,html){
    const p=ensurePanel(),b=$('releaseContract152Body');p.className=cls;if(b)b.innerHTML=html;
  }

  function parseSse(text){
    let last=null;
    for(const line of String(text||'').split(/\r?\n/)){
      if(!line.startsWith('data:'))continue;
      try{const v=JSON.parse(line.slice(5).trim());if(Array.isArray(v)&&v.length)last=v[0]}catch{}
    }
    return last;
  }

  async function healthDirect(){
    const base=String($('hfSpaceUrl')?.value||'https://alexandroslee-tax-ai-zerogpu.hf.space').replace(/\/+$/,'');
    const f=window.__taxAiGemmaDirectFetch||window.fetch.bind(window);
    const s=await f(`${base}/gradio_api/call/health_api`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:['health']})});
    if(!s.ok)throw new Error(`health submit HTTP ${s.status}`);
    const sj=await s.json();if(!sj.event_id)throw new Error('health 沒有 event_id');
    const r=await f(`${base}/gradio_api/call/health_api/${sj.event_id}`);
    if(!r.ok)throw new Error(`health result HTTP ${r.status}`);
    const h=parseSse(await r.text());if(!h)throw new Error('health 沒有完整結果');
    return h;
  }

  async function verify(){
    lockGemma(true,'正在驗證 ZeroGPU release');
    show('info',`Frontend：<b>V${FRONTEND_VERSION}</b>／Release：<code>${RELEASE_ID}</code><br>正在讀取 ZeroGPU Backend…`);
    try{
      const h=await healthDirect();
      const version=String(h.backend_version||h.version||'未知');
      const release=String(h.release_id||'未提供');
      const dedicated=h.dedicated_tax_category_api===true;
      const ok=version===FRONTEND_VERSION&&release===RELEASE_ID&&dedicated;
      window.__taxAiReleaseContract={frontend:FRONTEND_VERSION,expectedRelease:RELEASE_ID,backend:version,backendRelease:release,health:h,verified:ok};
      if(!ok){
        lockGemma(true,`Backend 不符：V${version} / ${release}`);
        show('warn',`❌ <b>版本不一致，Gemma 已安全鎖定</b><br>Frontend：V${FRONTEND_VERSION}／<code>${RELEASE_ID}</code><br>Backend：V${version}／<code>${release}</code><br>QR、本地 OCR、金額與課稅別結構判定仍可用；不會把舊 Gemma 結果冒充新版。`);
        const badge=$('hfBadge');if(badge)badge.textContent='Backend 版本不符';
        return false;
      }
      lockGemma(false);
      show('ok',`✅ <b>前後端 release 完全一致</b><br>Frontend V${FRONTEND_VERSION} ⇄ ZeroGPU Backend V${version}<br><code>${release}</code><br>課稅別專用 Gemma API 已啟用。`);
      const badge=$('hfBadge');if(badge)badge.textContent='V1.5.2 已驗證';
      return true;
    }catch(e){
      lockGemma(true,'無法確認 ZeroGPU Backend release');
      show('warn',`⚠ <b>無法驗證 ZeroGPU Backend，Gemma 已安全鎖定</b><br>${e.message||e}<br>QR／本地 OCR 仍可正常使用。`);
      return false;
    }
  }

  ensurePanel();lockGemma(true,'等待 V1.5.2 release 驗證');
  const subtitle=document.querySelector('.top .muted');if(subtitle)subtitle.textContent='V1.5.2｜Release Contract＋QR＋課稅別核心辨識＋ZeroGPU Gemma 4 E4B';
  const hero=document.querySelector('.hero');if(hero)hero.innerHTML='<b>V1.5.2：</b>版本不再只看畫面文字。Frontend 與 ZeroGPU Backend 必須回傳相同 Release ID 才會啟用 Gemma；電子發票優先 QR，課稅別採票面標記＋本地 ROI OCR＋結構交叉驗證。';
  const h2=$('hfZeroGpuCard')?.querySelector('h2');if(h2)h2.textContent='☁️ 1.5.2 Hugging Face ZeroGPU｜Gemma 4 E4B';
  window.__taxAiVerifyRelease152=verify;
  setTimeout(verify,900);
  console.info('[TaxAI] V1.5.2 Release Contract active',RELEASE_ID);
})();
