// V0.37.2 - Buyer BAN expected-value verification patch.
// Keeps V0.35 UI and V0.36/V0.37 pipeline. For purchase invoices, company BAN is the expected buyer BAN.
// Model output is evidence only; it cannot replace the expected company BAN without human confirmation.
(function(){
  const $=id=>document.getElementById(id);
  const scan=$('scan'), company=$('companyBan');
  if(!scan||!company)return;

  const subtitle=document.querySelector('.top .muted');
  if(subtitle)subtitle.textContent='V0.37.2｜V0.35介面＋8格透視＋手寫數字辨識＋申報單位統編驗證';
  const hero=document.querySelector('.hero');
  if(hero)hero.innerHTML='<b>V0.37.2：</b>買受人統編不再讓模型自由猜一組「合法統編」。進項發票先以<b>申報單位統編</b>作為預期值，再將左上 8 格逐格辨識結果拿來驗證。模型不可靠時顯示「無法自動確認」，只能由人工核對 8 格後確認。';

  const panel=$('handBuyerPanel');
  if(panel){
    const h2=panel.querySelector('h2'); if(h2)h2.textContent='✍️ 5. 買受人統編 8 格辨識與申報單位驗證';
    const muted=panel.querySelector('.section-title .muted');
    if(muted)muted.textContent='左上「統一編號」8 格＝買受人統編。V0.37.2：8 格拉正 → 逐格模型讀值 → 與申報單位統編逐格比對；檢查碼只驗證，不反推、不改字。';
    const preset=$('handBuyerPreset'); if(preset?.closest('.field'))preset.closest('.field').style.display='none';
    const oldRun=$('rerunHandBuyer'); if(oldRun)oldRun.style.display='none';
    const status=$('handBuyerStatus');
    const controls=document.createElement('div'); controls.id='buyerVerifyControls'; controls.style.marginTop='10px';
    controls.innerHTML=`
      <div class="info" id="buyerExpectedBox"><b>申報單位預期買方統編：</b><span id="buyerExpectedBan">尚未設定</span></div>
      <div class="actions" style="margin-top:10px">
        <button id="buyerVerifyRun" class="btn primary">📐 8格拉正＋🧠 模型驗證</button>
        <button id="buyerHumanConfirm" class="btn secondary" disabled>✓ 我確認 8 格就是申報單位統編</button>
      </div>
      <div id="buyerVerifySummary" class="warn" style="margin-top:10px">請先設定申報單位統編。</div>`;
    status?.insertAdjacentElement('afterend',controls);
  }

  const css=document.createElement('style');
  css.textContent=`
    .digitbox .expected{display:block;margin-top:3px;font-size:11px;font-weight:800;color:#1d4ed8}
    .digitbox.match{background:#f0fdf4;border-radius:10px;padding:4px}.digitbox.mismatch{background:#fff7ed;border-radius:10px;padding:4px}
    #buyerExpectedBan{font-family:ui-monospace,monospace;font-size:20px;font-weight:900;margin-left:8px;letter-spacing:2px}
  `; document.head.appendChild(css);

  const digits=s=>String(s||'').replace(/\D/g,'').slice(0,8);
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  async function waitUntil(fn,timeout=18000,step=150){const start=Date.now();while(Date.now()-start<timeout){try{if(fn())return true}catch{}await sleep(step)}return false}

  function expectedBan(){return digits(company.value)}
  function modelDigits(){return [...document.querySelectorAll('#d37Cells input[data-digit]')].map(x=>digits(x.value).slice(0,1)).join('')}
  function section5Digits(){return [...document.querySelectorAll('#digitBoxes input')].map(x=>digits(x.value).slice(0,1)).join('')}
  function d37Confidence(){return [...document.querySelectorAll('#d37Cells small')].map(el=>{const m=el.textContent.match(/([0-9.]+)%/);return m?Number(m[1])/100:0})}

  function updateExpectedBox(){
    const exp=expectedBan(), box=$('buyerExpectedBan'), sum=$('buyerVerifySummary'), human=$('buyerHumanConfirm');
    if(box)box.textContent=exp||'尚未設定';
    if(human)human.disabled=exp.length!==8;
    if(!sum)return;
    if(exp.length!==8){sum.className='warn';sum.textContent='⚠ 請先在「0. 申報單位」填寫 8 碼統一編號。進項買受人不能在未知申報單位的情況下自動判定。';return}
    const got=modelDigits()||section5Digits(), conf=d37Confidence();
    if(got.length!==8){sum.className='warn';sum.textContent=`預期買方統編 ${exp}。尚未取得可靠的 8 格模型讀值，請執行「8格拉正＋模型驗證」。`;return}
    const matches=[...exp].map((d,i)=>got[i]===d), same=matches.every(Boolean), mean=conf.length?conf.reduce((a,b)=>a+b,0)/conf.length:0, min=conf.length?Math.min(...conf):0;
    if(same && mean>=.60 && min>=.35){sum.className='ok';sum.textContent=`✓ 模型讀值 ${got} 與申報單位統編 ${exp} 8 格全部吻合。仍須人工確認後套用。`;}
    else if(same){sum.className='warn';sum.textContent=`⚠ 模型讀值雖為 ${got}，但整體信心仍低。請直接看 8 個格子後人工確認。`;}
    else{sum.className='warn';sum.textContent=`⚠ 模型讀值 ${got} 與預期 ${exp} 不一致，表示目前模型無法可靠辨識這張手寫發票。不要套用模型結果；請人工核對 8 格。`;}
    decorateBoxes(exp,got,conf);
    const apply=$('d37Apply'); if(apply && exp.length===8) apply.disabled=!(same && mean>=.60 && min>=.35);
  }

  function decorateBoxes(exp,got,conf){
    const boxes=[...document.querySelectorAll('#digitBoxes .digitbox')];
    boxes.forEach((b,i)=>{
      b.classList.remove('match','mismatch');
      if(exp[i])b.classList.add(got[i]===exp[i]?'match':'mismatch');
      let e=b.querySelector('.expected'); if(!e){e=document.createElement('span');e.className='expected';b.appendChild(e)}
      e.textContent=exp[i]?`預期 ${exp[i]}${conf[i]!=null?`｜模型 ${(conf[i]*100).toFixed(0)}%`:''}`:'未設定';
    });
  }

  function clearLegacyGuess(){
    const cand=$('handBuyerCandidate'), chk=$('handBuyerChecksum'), badge=$('handBuyerBadge'), stat=$('handBuyerStatus');
    if(cand)cand.textContent='—'; if(chk)chk.textContent='等待 8 格模型';
    if(badge)badge.textContent='等待 8 格驗證';
    if(stat){stat.className='info';stat.textContent='V0.37.2 已停用舊的整排 Tesseract「合法候選」邏輯；買受人改用 8 格模型＋申報單位統編驗證。'}
  }

  async function runNewBuyerFlow(){
    const exp=expectedBan();
    if(exp.length!==8){updateExpectedBox();return false}
    clearLegacyGuess();
    const warp=$('p36Warp'); if(!warp)return false;
    warp.click();
    const has8=await waitUntil(()=>document.querySelectorAll('#p36Cells .p36-cell canvas').length===8,22000);
    if(!has8){const s=$('buyerVerifySummary');if(s){s.className='warn';s.textContent='⚠ 無法取得 8 格透視切割結果，請先在第 7 區調整四角後再試。'}return false}
    const run=$('d37Run'); if(!run)return false;
    run.click();
    const done=await waitUntil(()=>document.querySelectorAll('#d37Cells input[data-digit]').length===8,30000);
    if(!done){const s=$('buyerVerifySummary');if(s){s.className='warn';s.textContent='⚠ 手寫數字模型未完成 8 格輸出，請人工確認。'}return false}
    await sleep(100);updateExpectedBox();return true;
  }

  const runBtn=$('buyerVerifyRun'); if(runBtn)runBtn.onclick=async()=>{runBtn.disabled=true;try{await runNewBuyerFlow()}finally{runBtn.disabled=false}};
  const human=$('buyerHumanConfirm'); if(human)human.onclick=()=>{
    const exp=expectedBan(); if(exp.length!==8)return;
    const buyer=$('buyer'); if(buyer)buyer.value=exp;
    try{if(typeof window.setSource==='function')window.setSource('buyer','人工確認：8格＝申報單位統編');if(typeof window.addCandidate==='function')window.addCandidate('buyer',exp,'人工確認：8格＝申報單位統編',200);if(typeof window.chooseFields==='function')window.chooseFields();if(typeof window.validateRecognition==='function')window.validateRecognition();if(typeof window.renderSourceDetail==='function')window.renderSourceDetail()}catch{}
    const s=$('buyerVerifySummary');if(s){s.className='ok';s.textContent=`✓ 已由人工確認：8 格買受人統編為申報單位 ${exp}。`}
  };

  company.addEventListener('input',updateExpectedBox); company.addEventListener('change',updateExpectedBox);
  const d37=$('d37Cells'); if(d37)new MutationObserver(()=>setTimeout(updateExpectedBox,50)).observe(d37,{childList:true,subtree:true,characterData:true});

  // Wrap the existing scan chain: after V0.34/V0.35/V0.36 processing, automatically run the safe buyer verification.
  const baseScan=scan.onclick;
  scan.onclick=async function(){
    await baseScan.call(scan);
    const type=$('invoiceType')?.value||'auto';
    const hand=type==='hand'||(type==='auto' && (window.state?.qr?.length||0)===0);
    if(hand){clearLegacyGuess();await runNewBuyerFlow()}
    updateExpectedBox();
  };

  clearLegacyGuess(); updateExpectedBox();
})();
