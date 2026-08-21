(function(){
  const $=id=>document.getElementById(id);
  const gross=$('gross'), net=$('net'), tax=$('tax');
  if(!gross||!net||!tax)return;

  function money(v){
    const s=String(v??'').replace(/[,，\s$NTnt元]/g,'');
    if(!s||!/^-?\d+(?:\.\d+)?$/.test(s))return NaN;
    return Number(s);
  }

  function markSource(id, text){
    const src=$('s'+id.charAt(0).toUpperCase()+id.slice(1));
    if(src)src.textContent=text;
  }

  function setValue(el, value, source){
    const human=el.dataset.humanEdited==='1' && String(el.value||'').trim()!=='';
    if(human)return false;
    el.value=String(value);
    el.dataset.aiSource=source;
    try{el.dispatchEvent(new Event('change',{bubbles:true}))}catch{}
    return true;
  }

  function reverseGross(){
    const g=money(gross.value);
    if(!Number.isFinite(g)||g<0){
      alert('請先輸入或辨識「含稅總額」。');
      gross.focus();
      return;
    }
    const G=Math.round(g);
    // 一般 5% 營業稅含稅反算：稅額 = 總額 × 5 / 105，元以下四捨五入。
    const T=Math.round(G*5/105);
    const N=G-T;

    const netHuman=net.dataset.humanEdited==='1' && String(net.value||'').trim()!=='';
    const taxHuman=tax.dataset.humanEdited==='1' && String(tax.value||'').trim()!=='';
    const wn=setValue(net,N,'5%含稅反算');
    const wt=setValue(tax,T,'5%含稅反算');
    if(wn)markSource('net','5%含稅反算');
    if(wt)markSource('tax','5%含稅反算');

    const msg=`總額 ${G.toLocaleString('zh-TW')} → 未稅 ${N.toLocaleString('zh-TW')} ＋ 稅額 ${T.toLocaleString('zh-TW')}`;
    const note=$('grossReverseNote');
    if(note){
      note.className=(netHuman||taxHuman)?'warn':'ok';
      note.textContent=(netHuman||taxHuman)
        ? `↩️ ${msg}。人工修改過的欄位未覆寫。`
        : `✅ 5% 反算完成：${msg}`;
    }
    const conflict=$('conflicts');
    if(conflict && !(netHuman||taxHuman)){
      conflict.className='ok';
      conflict.textContent=`✅ 5% 含稅反算：${msg}。請人工確認發票金額後再加入本期。`;
    }
    try{if(typeof validateRecognition==='function')validateRecognition()}catch{}
  }

  // 1) 永久放在「含稅總額」欄位正下方。
  const grossField=gross.closest('.field');
  if(grossField && !$('grossReverseBox')){
    const box=document.createElement('div');
    box.id='grossReverseBox';
    box.style.cssText='margin-top:10px;padding:12px;border:2px solid #2563eb;border-radius:12px;background:#eff6ff';
    box.innerHTML=`
      <button id="grossReverseBtn" type="button" class="btn primary" style="width:100%;font-weight:900;font-size:16px">↩️ 總額反算未稅／稅額（5%）</button>
      <div id="grossReverseNote" class="muted" style="margin-top:8px;font-weight:800;line-height:1.5">只要有「含稅總額」，即可反算：稅額＝總額×5÷105（四捨五入），未稅＝總額－稅額。</div>`;
    grossField.appendChild(box);
    $('grossReverseBtn').addEventListener('click',reverseGross);
  }

  // 2) 辨識結果底部操作列也放一顆，避免使用者沒注意到欄位下方。
  const recheck=$('recheck');
  const actions=recheck?.parentElement;
  if(actions && !$('grossReverseBtn2')){
    const b=document.createElement('button');
    b.id='grossReverseBtn2';
    b.type='button';
    b.className='btn primary';
    b.textContent='↩️ 總額反算未稅／稅額';
    b.addEventListener('click',reverseGross);
    actions.insertBefore(b, actions.firstChild);
  }

  function updateHint(){
    const g=money(gross.value), n=money(net.value), t=money(tax.value);
    const box=$('grossReverseBox');
    if(!box)return;
    if(Number.isFinite(g) && (!Number.isFinite(n)||!Number.isFinite(t))){
      box.style.display='block';
      const note=$('grossReverseNote');
      if(note){note.className='warn';note.textContent='⚠ 已有含稅總額，但未稅／稅額尚未完整。請按上方按鈕自動反算。'}
    }else{
      box.style.display='block';
    }
  }
  gross.addEventListener('input',updateHint);
  net.addEventListener('input',updateHint);
  tax.addEventListener('input',updateHint);
  updateHint();
})();
