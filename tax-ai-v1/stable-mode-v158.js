(function(){
  if(window.__taxAiStableMode158)return;
  window.__taxAiStableMode158=true;
  const BUILD='20260828-v158-stable-r1';
  const $=id=>document.getElementById(id);

  function ensurePanel(){
    let p=$('v158StableMode');
    if(p)return p;
    p=document.createElement('div');
    p.id='v158StableMode';
    p.className='ok';
    p.style.marginTop='10px';
    p.innerHTML='<b>🛡️ V1.5.8 穩定模式</b><div id="v158StableModeBody" style="margin-top:6px">主辨識不等待 ZeroGPU：QR／本地 OCR／課稅別／金額先完成。Gemma 4 E4B 改為選用加強辨識，不會卡住主流程。</div>';
    const sum=$('scanSummary');
    if(sum)sum.insertAdjacentElement('afterend',p);
    else $('scan')?.insertAdjacentElement('afterend',p);
    return p;
  }
  function text(t,cls='ok'){
    const p=ensurePanel(),b=$('v158StableModeBody');
    if(p)p.className=cls;if(b)b.textContent=t;
  }
  function patchScan(){
    const scan=$('scan');
    if(!scan||scan.dataset.v158StableBound==='1')return;
    scan.dataset.v158StableBound='1';
    const old=scan.onclick;
    scan.textContent='✨ V1.5.8：穩定辨識（不等待 Gemma）';
    scan.onclick=async function(...args){
      text('正在執行 QR／本地 OCR／版面／課稅別／金額辨識…','info');
      let r;
      try{r=typeof old==='function'?await old.apply(this,args):undefined}
      catch(e){text('⚠ 本地辨識發生錯誤：'+(e.message||e),'warn');throw e}
      try{window.__taxAiConfidenceScore154Api?.render?.()}catch{}
      text('✓ 主辨識已完成。請先檢查目前結果；若手寫欄位仍缺漏，再使用「Gemma 整張交叉辨識」或「Gemma 買受人 8 格」。','ok');
      return r;
    };
  }
  function patchGemmaButtons(){
    const run=$('hfRun');if(run){run.textContent='🚀 Gemma 4 E4B 加強辨識（選用）';run.title='不影響主辨識；ZeroGPU 排隊或失敗時可繼續人工核對'}
    const buyer=$('hfBuyer');if(buyer){buyer.textContent='🎯 Gemma 買受人 8 格（選用）';buyer.title='只在買受人統編仍不確定時使用'}
    const tax=$('taxCategoryGemma');if(tax){tax.textContent='👁 Gemma 課稅別補驗（選用）';tax.title='已有明確應稅／零稅率／免稅時不必重跑'}
  }
  function clearBusy(){
    for(const id of ['scan','camera','purchase','sales']){const e=$(id);if(e)e.disabled=false}
  }
  function apply(){ensurePanel();patchScan();patchGemmaButtons();clearBusy()}
  apply();setTimeout(apply,150);setTimeout(apply,800);setInterval(()=>{patchGemmaButtons();clearBusy()},1500);
  window.__taxAiStableMode158Api={BUILD,apply,text};
  console.info('[TaxAI] V1.5.8 stable non-blocking mode active',BUILD);
})();