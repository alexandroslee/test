(function(){
  if(window.__taxAiBackendVersion150)return;
  window.__taxAiBackendVersion150=true;
  const EXPECTED='1.5.0';
  const $=id=>document.getElementById(id);

  function ensureUi(){
    let p=$('backendVersion150');
    if(p)return p;
    p=document.createElement('div');
    p.id='backendVersion150';
    p.className='info';
    p.style.marginTop='10px';
    p.innerHTML=`<b>🔗 執行版本</b><div id="backendVersion150Body" style="margin-top:6px">Frontend：<b>V1.5.0</b>　ZeroGPU Backend：<b>檢查中…</b></div>`;
    const card=$('hfZeroGpuCard');
    const meta=$('hfMeta');
    if(meta)meta.insertAdjacentElement('afterend',p);else card?.appendChild(p);
    return p;
  }

  function show(cls,html){
    const p=ensureUi();p.className=cls;
    const b=$('backendVersion150Body');if(b)b.innerHTML=html;
  }

  function parseSse(text){
    let last=null;
    for(const line of String(text||'').split(/\r?\n/)){
      if(!line.startsWith('data:'))continue;
      try{const x=JSON.parse(line.slice(5).trim());if(Array.isArray(x)&&x.length)last=x[0]}catch{}
    }
    return last;
  }

  async function check(){
    const fetchReal=window.__taxAiGemmaDirectFetch||window.fetch.bind(window);
    const base=String($('hfSpaceUrl')?.value||'https://alexandroslee-tax-ai-zerogpu.hf.space').replace(/\/+$/,'');
    show('info','Frontend：<b>V1.5.0</b>　ZeroGPU Backend：<b>檢查中…</b>');
    try{
      const s=await fetchReal(`${base}/gradio_api/call/health_api`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:['health']})});
      if(!s.ok)throw new Error(`health submit HTTP ${s.status}`);
      const sj=await s.json();if(!sj.event_id)throw new Error('health 無 event_id');
      const g=await fetchReal(`${base}/gradio_api/call/health_api/${sj.event_id}`);
      if(!g.ok)throw new Error(`health result HTTP ${g.status}`);
      const h=parseSse(await g.text());
      const actual=String(h?.backend_version||'未知');
      const supported=h?.tax_category_supported===true;
      window.__taxAiBackendContract={expected:EXPECTED,actual,supported,health:h||null,verified:actual===EXPECTED&&supported};
      if(actual===EXPECTED&&supported){
        show('ok',`Frontend：<b>V1.5.0</b>　ZeroGPU Backend：<b>V${actual}</b> ✅　課稅別辨識：<b>已啟用</b>`);
        const badge=$('hfBadge');if(badge)badge.textContent='前後端 V1.5.0';
        return true;
      }
      show('warn',`Frontend：<b>V1.5.0</b>　ZeroGPU Backend：<b>V${actual}</b> ❌<br>後端版本尚未同步完成；目前不要把 Gemma 課稅別結果當成 V1.5.0。`);
      const badge=$('hfBadge');if(badge)badge.textContent='後端版本不符';
      return false;
    }catch(e){
      window.__taxAiBackendContract={expected:EXPECTED,actual:'無法確認',supported:false,verified:false,error:String(e?.message||e)};
      show('warn',`Frontend：<b>V1.5.0</b>　ZeroGPU Backend：<b>無法確認</b> ⚠<br>${e?.message||e}`);
      return false;
    }
  }

  ensureUi();
  window.__taxAiCheckBackendVersion150=check;
  setTimeout(check,1200);
  console.info('[TaxAI] Backend version contract V1.5.0 active');
})();
