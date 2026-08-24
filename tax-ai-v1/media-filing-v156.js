(function(){
  if(window.__taxAiMedia156)return;
  window.__taxAiMedia156=true;
  const VERSION='1.5.6', BUILD='20260825-v156-media-filing';
  const $=id=>document.getElementById(id);
  const KEY='taxai.media.v156.records';
  const META='taxai.media.v156.meta';
  const FORMAT={
    '21':'進項三聯式、電子計算機統一發票',
    '22':'進項二聯式收銀機統一發票、載有稅額之其他憑證',
    '23':'進項三聯式等進貨退出或折讓證明單',
    '24':'進項二聯式等進貨退出或折讓證明單',
    '25':'進項三聯式收銀機統一發票、一般稅額電子發票',
    '26':'彙總：每張稅額500元以下之進項三聯式／電子計算機發票',
    '27':'彙總：每張稅額500元以下之進項二聯式收銀機／其他憑證',
    '28':'進項海關代徵營業稅繳納證',
    '29':'進項海關退還溢繳營業稅申報單',
    '31':'銷項三聯式統一發票',
    '32':'銷項二聯式、二聯式收銀機統一發票',
    '33':'銷項三聯式等銷貨退回或折讓證明單',
    '34':'銷項二聯式等銷貨退回或折讓證明單',
    '35':'銷項三聯式收銀機統一發票、一般稅額電子發票',
    '36':'銷項免用統一發票'
  };
  const TAX={'應稅':'1','零稅率':'2','免稅':'3'};
  const DED={'1':'可扣抵－進貨及費用','2':'可扣抵－固定資產','3':'不可扣抵－進貨及費用','4':'不可扣抵－固定資產','':'銷項／空白'};
  let records=load(KEY,[]), meta=load(META,{taxRegNo:'',carry:0,period:'',returnType:'401'});

  function load(k,d){try{return JSON.parse(localStorage.getItem(k)||'null')??d}catch{return d}}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(records));localStorage.setItem(META,JSON.stringify(meta))}catch{}}
  function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function digits(s){return String(s||'').replace(/\D/g,'')}
  function num(id){const s=String($(id)?.value??'').replace(/[,，\s元$NTnt]/g,'');if(s==='')return NaN;const n=Number(s);return Number.isFinite(n)?Math.round(n):NaN}
  function normalizeDate(v){const m=String(v||'').match(/(20\d{2})[-\/.](\d{1,2})[-\/.](\d{1,2})/);return m?`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`:''}
  function rocYm(date){const d=normalizeDate(date);if(!d)return '';const [y,m]=d.split('-');return `${String(Number(y)-1911).padStart(3,'0')}${m}`}
  function reportPeriod(){const p=String($('v156Period')?.value||meta.period||'');if(/^\d{5}$/.test(p))return p;return rocYm($('date')?.value)}
  function currentDirection(){
    let r=$('direction')?.value||'unknown';if(['purchase','sales'].includes(r))return r;
    const c=digits($('companyBan')?.value),s=digits($('seller')?.value),b=digits($('buyer')?.value);
    if(c&&b===c)return 'purchase';if(c&&s===c)return 'sales';return r;
  }
  function isElectronic(){
    const t=$('invoiceType')?.value||'auto';if(t==='electronic')return true;if(t==='hand')return false;
    try{if(typeof state!=='undefined'&&state?.qr?.length)return true}catch{}
    const raw=String($('raw')?.value||'');return /電子發票|交易明細|雲端發票/.test(raw);
  }
  function autoFormat(){const r=currentDirection(),e=isElectronic();return r==='purchase'?(e?'25':'21'):r==='sales'?(e?'35':'31'):''}
  function taxCategory(){const c=$('taxCategory')?.value||'';return TAX[c]?c:''}
  function composite(){const c=window.__taxAiCompositeConfidence154||window.__taxAiV154Decision;const n=Number(c?.total??c?.confidence);return Number.isFinite(n)?Math.round(n):null}
  function currentRecord(){
    const role=currentDirection(),cat=taxCategory(),fmt=$('v156Format')?.value||autoFormat(),date=normalizeDate($('date')?.value),net=num('net'),tax=num('tax'),gross=num('gross');
    const ded=role==='purchase'?String($('ded')?.value||''):'';
    const aggregate=String($('v156Aggregate')?.value||'');
    const record={id:`M${Date.now()}${Math.random().toString(36).slice(2,6)}`,serial:records.length+1,formatCode:fmt,formatName:FORMAT[fmt]||'',rocYm:rocYm(date),date,role,track:String($('track')?.value||'').toUpperCase().trim(),number:digits($('number')?.value),seller:digits($('seller')?.value),buyer:digits($('buyer')?.value),net,tax,gross,taxCategory:cat,taxCode:TAX[cat]||'',deductionCode:ded,deductionName:DED[ded]||'',aggregate,confidence:composite(),review:false};
    const issues=[];
    if(!['purchase','sales'].includes(role))issues.push('進／銷項尚未確認');
    if(!FORMAT[fmt])issues.push('格式代號未確認');
    if(!/^\d{5}$/.test(record.rocYm))issues.push('開立年月不完整');
    if(!/^[A-Z]{2}$/.test(record.track)||!/^\d{8}$/.test(record.number))issues.push('發票字軌／號碼不完整');
    if(!/^\d{8}$/.test(record.seller))issues.push('銷售人統編不完整');
    if(!cat)issues.push('課稅別未確認');
    if(!Number.isFinite(net)||!Number.isFinite(tax)||!Number.isFinite(gross)||net+tax!==gross)issues.push('金額尚未通過未稅＋稅額＝總額');
    if(cat==='應稅'&&Number.isFinite(net)&&Math.abs(tax-Math.round(net*.05))>1)issues.push('5% 稅額交叉檢查異常');
    if((cat==='零稅率'||cat==='免稅')&&tax!==0)issues.push('零稅率／免稅之稅額應為0');
    if(role==='purchase'&&!['1','2','3','4'].includes(ded))issues.push('進項扣抵代號未確認');
    if(role==='sales'&&ded)issues.push('銷項扣抵代號應留空');
    if(aggregate==='B'&&fmt!=='25')issues.push('分攤註記B僅限格式代號25');
    if(record.confidence!==null&&record.confidence<70)issues.push('綜合信心低於70，建議人工核對');
    record.issues=issues;record.review=issues.length>0;return record;
  }
  function autoPrepare(){
    const f=$('v156Format');if(f&&!f.dataset.manualFormat){const v=autoFormat();if(v)f.value=v}
    const p=$('v156Period');if(p&&!p.value){const v=rocYm($('date')?.value);if(v)p.value=v}
    renderPreview();
  }
  function createUi(){
    if($('v156Media'))return;
    const anchor=document.querySelector('.card.section:last-of-type')||document.querySelector('.wrap');if(!anchor)return;
    const sec=document.createElement('div');sec.id='v156Media';sec.className='card section';
    sec.innerHTML=`<div class="section-title"><div><h2>💾 5. 營業稅媒體申報 V1.5.6</h2><div class="muted">將 AI 辨識結果轉成進銷項媒體申報資料，彙總整期後即時計算 401。此版先提供資料建檔／檢核／CSV 測試匯出，不直接送件。</div></div><span class="pill">PUBLIC TEST</span></div>
      <div class="form" style="margin-top:12px">
        <div class="field"><label>稅籍編號（9碼）</label><input id="v156TaxReg" maxlength="9" inputmode="numeric" placeholder="正式媒體檔必要欄位"></div>
        <div class="field"><label>申報所屬年月（民國YYYMM）</label><input id="v156Period" maxlength="5" inputmode="numeric" placeholder="例如11508"></div>
        <div class="field"><label>申報書</label><select id="v156ReturnType"><option value="401">401 一般稅額－專營應稅</option><option value="403">403 一般稅額－兼營免稅／特種</option></select></div>
        <div class="field"><label>格式代號</label><select id="v156Format">${Object.entries(FORMAT).map(([k,v])=>`<option value="${k}">${k}｜${esc(v)}</option>`).join('')}</select></div>
        <div class="field"><label>彙加／分攤註記</label><select id="v156Aggregate"><option value="">空白｜一般逐筆</option><option value="A">A｜彙加資料</option><option value="B">B｜進項分攤（僅格式25）</option></select></div>
        <div class="field"><label>上期累積留抵【108】</label><input id="v156Carry" type="number" min="0" value="0"></div>
      </div>
      <div id="v156Preview" class="info" style="margin-top:12px">等待發票辨識結果。</div>
      <div class="actions" style="margin-top:12px"><button id="v156Add" class="btn primary">＋ 加入本期媒體申報資料</button><button id="v156Export" class="btn secondary">⬇ 匯出媒體申報測試 CSV</button><button id="v156Clear" class="btn ghost">清除媒體測試資料</button></div>
      <div class="tablewrap" style="margin-top:14px"><table><thead><tr><th>狀態</th><th>格式</th><th>年月</th><th>進／銷</th><th>發票</th><th>銷售人</th><th>未稅</th><th>稅額</th><th>課稅別</th><th>扣抵</th><th>信心</th><th></th></tr></thead><tbody id="v156Rows"></tbody></table></div>
      <div class="two section" style="margin-top:16px"><div><h3>📊 401 核心稅額試算</h3><div id="v156Calc"></div></div><div><h3>🧾 媒體申報檢核</h3><div id="v156Check" class="info"></div></div></div>`;
    anchor.insertAdjacentElement('afterend',sec);
    $('v156TaxReg').value=meta.taxRegNo||'';$('v156Period').value=meta.period||'';$('v156Carry').value=Number(meta.carry)||0;$('v156ReturnType').value=meta.returnType||'401';
    bind();autoPrepare();renderAll();
  }
  function bind(){
    $('v156Format')?.addEventListener('change',()=>{$('v156Format').dataset.manualFormat='1';renderPreview()});
    for(const id of ['date','direction','invoiceType','track','number','seller','buyer','net','tax','gross','taxCategory','ded'])$(id)?.addEventListener('change',()=>setTimeout(autoPrepare,0));
    $('v156Add')?.addEventListener('click',e=>{e.preventDefault();addCurrent()});
    $('v156Export')?.addEventListener('click',e=>{e.preventDefault();exportCsv()});
    $('v156Clear')?.addEventListener('click',e=>{e.preventDefault();if(confirm('清除 V1.5.6 媒體申報測試資料？')){records=[];save();renderAll()}});
    for(const id of ['v156TaxReg','v156Period','v156Carry','v156ReturnType'])$(id)?.addEventListener('change',()=>{meta={taxRegNo:digits($('v156TaxReg')?.value).slice(0,9),period:String($('v156Period')?.value||'').replace(/\D/g,'').slice(0,5),carry:Math.max(0,Math.round(Number($('v156Carry')?.value)||0)),returnType:$('v156ReturnType')?.value||'401'};$('v156TaxReg').value=meta.taxRegNo;$('v156Period').value=meta.period;save();renderAll()});
  }
  function renderPreview(){const r=currentRecord(),p=$('v156Preview');if(!p)return;const cls=r.issues.length?'warn':'ok';p.className=cls;p.textContent=`${r.issues.length?'⚠':'✓'} ${r.role==='purchase'?'進項':r.role==='sales'?'銷項':'待判斷'}｜格式 ${r.formatCode||'—'} ${r.formatName||''}｜${r.track||'--'}-${r.number||'--------'}｜課稅別 ${r.taxCategory||'—'}(${r.taxCode||'—'})｜未稅 ${Number.isFinite(r.net)?r.net:'—'}＋稅 ${Number.isFinite(r.tax)?r.tax:'—'}＝${Number.isFinite(r.gross)?r.gross:'—'}｜扣抵 ${r.deductionCode||'空白'} ${r.deductionName||''}${r.confidence!==null?`｜綜合信心 ${r.confidence}%`:''}${r.issues.length?`｜需核對：${r.issues.join('；')}`:'｜可加入媒體申報資料'}`}
  function addCurrent(){const r=currentRecord();records.push(r);save();renderAll();const p=$('v156Preview');if(p){p.className=r.review?'warn':'ok';p.textContent=`${r.review?'⚠ 已先加入，但需要人工核對':'✓ 已加入本期媒體申報資料'}：${r.track}-${r.number}｜格式${r.formatCode}｜${r.net}+${r.tax}=${r.gross}`}}
  function remove(id){records=records.filter(x=>x.id!==id);save();renderAll()}
  function money(v){return Number.isFinite(Number(v))?Math.round(Number(v)).toLocaleString('zh-TW'):'—'}
  function renderRows(){const b=$('v156Rows');if(!b)return;b.innerHTML=records.map(r=>`<tr><td>${r.review?'⚠ REVIEW':'✅ PASS'}</td><td>${esc(r.formatCode)}</td><td>${esc(r.rocYm)}</td><td>${r.role==='purchase'?'進項':'銷項'}</td><td>${esc(r.track)}-${esc(r.number)}</td><td>${esc(r.seller)}</td><td>${money(r.net)}</td><td>${money(r.tax)}</td><td>${esc(r.taxCode)} ${esc(r.taxCategory)}</td><td>${esc(r.deductionCode||'')}</td><td>${r.confidence??'—'}%</td><td><button class="btn ghost" data-v156-del="${esc(r.id)}">刪除</button></td></tr>`).join('')||'<tr><td colspan="12" class="muted">尚未加入本期媒體申報資料。</td></tr>';b.querySelectorAll('[data-v156-del]').forEach(x=>x.onclick=()=>remove(x.dataset.v156Del))}
  function calc(){const sales=records.filter(r=>r.role==='sales'&&!r.review),inputs=records.filter(r=>r.role==='purchase'&&!r.review);const f101=sales.reduce((a,r)=>a+(Number(r.tax)||0),0),f107=inputs.filter(r=>['1','2'].includes(r.deductionCode)).reduce((a,r)=>a+(Number(r.tax)||0),0),f108=Math.max(0,Math.round(Number($('v156Carry')?.value||meta.carry)||0)),f110=f107+f108,f111=Math.max(0,f101-f110),f112=Math.max(0,f110-f101),f113=0,f114=0,f115=Math.max(0,f112-f114);return {f101,f107,f108,f110,f111,f112,f113,f114,f115,sales:sales.length,inputs:inputs.length}}
  function renderCalc(){const c=calc(),e=$('v156Calc');if(!e)return;e.innerHTML=[[101,'本期銷項稅額合計',c.f101],[107,'得扣抵進項稅額合計',c.f107],[108,'上期累積留抵稅額',c.f108],[110,'小計（107＋108）',c.f110],[111,'本期應實繳稅額',c.f111],[112,'本期申報留抵稅額',c.f112],[113,'得退稅限額合計（本版暫0）',c.f113],[114,'本期應退稅額（本版暫0）',c.f114],[115,'本期累積留抵稅額',c.f115]].map(([n,t,v])=>`<div class="row"><span>【${n}】${t}</span><b>$${money(v)}</b></div>`).join('')}
  function renderCheck(){const e=$('v156Check');if(!e)return;const review=records.filter(r=>r.review),exempt=records.some(r=>r.taxCategory==='免稅'),taxReg=digits($('v156TaxReg')?.value),period=reportPeriod();const msgs=[];if(!records.length)msgs.push('尚無媒體申報資料');if(review.length)msgs.push(`${review.length} 筆資料需要人工核對，暫不列入401自動試算`);if(taxReg.length!==9)msgs.push('稅籍編號尚未填滿9碼：正式媒體檔必要');if(!/^\d{5}$/.test(period))msgs.push('申報所屬年月需為民國YYYMM');if(exempt&&$('v156ReturnType')?.value==='401')msgs.push('資料含免稅交易，請確認是否應使用403而非401');if(records.some(r=>r.aggregate==='B'&&r.formatCode!=='25'))msgs.push('分攤註記B僅限格式代號25');e.className=msgs.length?'warn':'ok';e.textContent=msgs.length?'⚠ '+msgs.join('；'):'✓ 媒體申報核心欄位檢核通過；目前可做測試資料匯出。正式81 Bytes申報檔仍維持關閉，待完整格式驗證。'}
  function renderAll(){renderRows();renderCalc();renderCheck();renderPreview()}
  function exportCsv(){if(!records.length){alert('尚無媒體申報資料');return}const head=['流水號','格式代號','開立年月','進銷項','發票字軌','發票號碼','銷售人統編','買受人統編','銷售額','營業稅額','含稅總額','課稅別','課稅代號','扣抵代號','彙加分攤','綜合信心','狀態'];const rows=records.map((r,i)=>[i+1,r.formatCode,r.rocYm,r.role,r.track,r.number,r.seller,r.buyer,r.net,r.tax,r.gross,r.taxCategory,r.taxCode,r.deductionCode,r.aggregate,r.confidence??'',r.review?'REVIEW':'PASS']);const csv='\ufeff'+[head,...rows].map(a=>a.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\r\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=`TaxAI_V156_media_${reportPeriod()||'test'}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
  function applyUi(){document.title='AI 超簡易營業稅申報 V1.5.6｜媒體申報測試版';const sub=document.querySelector('.top .muted');if(sub)sub.textContent='V1.5.6 媒體申報測試版｜發票 AI 辨識 → 媒體申報資料 → 401 自動試算';const hero=document.querySelector('.hero');if(hero)hero.innerHTML='<b>V1.5.6 媒體申報測試版：</b>延續 V1.5.5 的自動課稅別、自動算稅與綜合信心評分，新增進銷項媒體申報資料建檔、格式代號／課稅別／扣抵代號檢核與 401 核心稅額即時試算。正式申報檔在完整81 Bytes格式驗證前不開放。'}
  function patch(){applyUi();createUi();autoPrepare();renderAll()}
  patch();setTimeout(patch,300);setTimeout(patch,1200);
  window.__taxAiMedia156Api={VERSION,BUILD,currentRecord,addCurrent,calc,renderAll,autoFormat,getRecords:()=>records.slice()};
  console.info('[TaxAI] V1.5.6 media filing workspace active',BUILD);
})();