(function(){
  if(window.__taxAiMediaPreflight157)return;
  window.__taxAiMediaPreflight157=true;
  const VERSION='1.5.7',BUILD='20260825-v157-media-preflight';
  const $=id=>document.getElementById(id);
  const RECORD_KEY='taxai.media.v156.records';
  const META_KEY='taxai.media.v156.meta';
  const PREF_KEY='taxai.media.v157.pref';
  const FORMAT_ROLE={21:'purchase',22:'purchase',23:'purchase',24:'purchase',25:'purchase',26:'purchase',27:'purchase',28:'purchase',29:'purchase',31:'sales',32:'sales',33:'sales',34:'sales',35:'sales',36:'sales',37:'sales',38:'sales'};
  const TAX_CODES=['1','2','3','F','D'];
  const DED_CODES=['1','2','3','4',''];
  const AGG_CODES=['A','B',''];

  function load(k,d){try{return JSON.parse(localStorage.getItem(k)||'null')??d}catch{return d}}
  function save(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}
  function digits(v){return String(v??'').replace(/\D/g,'')}
  function pad7(n){return String(Math.max(0,Number(n)||0)).padStart(7,'0').slice(-7)}
  function ymPrev(ym){if(!/^\d{5}$/.test(ym))return'';let y=+ym.slice(0,3),m=+ym.slice(3);m--;if(m===0){y--;m=12}return String(y).padStart(3,'0')+String(m).padStart(2,'0')}
  function roleLabel(r){return r==='purchase'?'進項':r==='sales'?'銷項':'未知'}
  function readAll(){return {records:load(RECORD_KEY,[]),meta:load(META_KEY,{taxRegNo:'',carry:0,period:'',returnType:'401'}),pref:load(PREF_KEY,{filingCycle:'1',returnTypeAuto:true})}}
  function fixedFieldCheck(r,taxReg,serial){
    const e=[],w=[];
    const fmt=String(r.formatCode||'');
    if(!/^\d{2}$/.test(fmt)||!FORMAT_ROLE[fmt])e.push('格式代號需為有效2碼');
    if(FORMAT_ROLE[fmt]&&FORMAT_ROLE[fmt]!==r.role)e.push(`格式代號${fmt}與${roleLabel(r.role)}不一致`);
    if(!/^\d{9}$/.test(taxReg))e.push('申報營業人稅籍編號需9碼');
    if(!/^\d{7}$/.test(serial))e.push('流水號需7碼');
    if(!/^\d{5}$/.test(String(r.rocYm||'')))e.push('資料所屬年月需民國YYYMM共5碼');
    if(r.buyer&& !/^\d{8}$/.test(digits(r.buyer)))e.push('買受人統編若登載須8碼');
    if(!/^\d{8}$/.test(digits(r.seller)))e.push('銷售人統編需8碼');
    if(!/^[A-Z]{2}$/.test(String(r.track||'')))e.push('發票字軌需2位英文大寫');
    if(!/^\d{8}$/.test(digits(r.number)))e.push('發票號碼需8碼');
    const net=Number(r.net),tax=Number(r.tax),gross=Number(r.gross);
    if(!Number.isFinite(net)||net<0||String(Math.round(net)).length>12)e.push('銷售額需可放入12位數字欄');
    const taxCode=String(r.taxCode||({應稅:'1',零稅率:'2',免稅:'3'}[r.taxCategory]||''));
    if(!TAX_CODES.includes(taxCode))e.push('課稅別代號需為1/2/3/F/D');
    if(!Number.isFinite(tax)||tax<0||String(Math.round(tax)).length>10)e.push('營業稅額需可放入10位數字欄');
    const ded=String(r.deductionCode??'');if(!DED_CODES.includes(ded))e.push('扣抵代號需為1/2/3/4或空白');
    if(r.role==='sales'&&ded!=='')e.push('銷項扣抵代號應空白');
    if(r.role==='purchase'&&!['1','2','3','4'].includes(ded))e.push('進項需確認扣抵代號1~4');
    const agg=String(r.aggregate??'');if(!AGG_CODES.includes(agg))e.push('彙加／分攤註記僅可A/B/空白');
    if(agg==='B'&&fmt!=='25')e.push('分攤註記B僅限格式25');
    if(Number.isFinite(net)&&Number.isFinite(tax)&&Number.isFinite(gross)&&Math.round(net+tax)!==Math.round(gross))e.push('未稅＋稅額不等於總額');
    if(taxCode==='1'&&Number.isFinite(net)&&Number.isFinite(tax)&&Math.abs(Math.round(tax)-Math.round(net*.05))>1)w.push('應稅5%交叉檢查有差異');
    if((taxCode==='2'||taxCode==='3')&&Math.round(tax)!==0)e.push('零稅率／免稅之營業稅額應為0');
    if(Number(r.confidence)<70)w.push('綜合信心低於70，需人工核對');
    return {errors:e,warnings:w,taxCode};
  }
  function periodCheck(r,declared,cycle){
    if(!/^\d{5}$/.test(declared))return {ok:false,msg:'尚未設定申報所屬年月'};
    const ym=String(r.rocYm||'');
    if(cycle==='2')return {ok:ym===declared,msg:ym===declared?'按月期間符合':`按月申報只接受${declared}`};
    const prev=ymPrev(declared),ok=ym===declared||ym===prev;return {ok,msg:ok?'按期期間符合':`按期申報應為${prev}或${declared}`};
  }
  function recommendedReturn(records){return records.some(r=>String(r.taxCode)==='3'||r.taxCategory==='免稅')?'403':'401'}
  function keyOf(r){return [r.formatCode,r.rocYm,String(r.track||'').toUpperCase(),digits(r.number),digits(r.seller)].join('|')}
  function run(){
    const {records,meta,pref}=readAll();
    const cycle=String($('v157Cycle')?.value||pref.filingCycle||'1'),declared=String($('v156Period')?.value||meta.period||''),taxReg=digits($('v156TaxReg')?.value||meta.taxRegNo||'').slice(0,9);
    const seen=new Map(),rows=[];let ready=0,review=0,dups=0;
    records.forEach((r,i)=>{
      const serial=pad7(i+1),f=fixedFieldCheck(r,taxReg,serial),p=periodCheck(r,declared,cycle),k=keyOf(r);let duplicate=false;
      if(seen.has(k)){duplicate=true;dups++}else seen.set(k,i);
      const errors=[...f.errors];const warnings=[...f.warnings];if(!p.ok)errors.push(p.msg);if(duplicate)errors.push(`疑似重複：與第${seen.get(k)+1}筆相同`);
      const ok=errors.length===0;if(ok)ready++;else review++;
      rows.push({index:i+1,serial,record:r,errors,warnings,ok,period:p});
    });
    const recommended=recommendedReturn(records),selected=String($('v156ReturnType')?.value||meta.returnType||'401');
    const returnWarning=records.length&&selected!==recommended?`目前資料建議使用${recommended}，現在選擇${selected}`:'';
    const taxRegOk=/^\d{9}$/.test(taxReg),periodOk=/^\d{5}$/.test(declared);
    let score=100;score-=review?Math.min(45,review*12):0;score-=dups?Math.min(25,dups*10):0;if(!taxRegOk)score-=20;if(!periodOk)score-=15;if(returnWarning)score-=8;score=Math.max(0,score);
    const result={version:VERSION,build:BUILD,count:records.length,ready,review,duplicates:dups,taxReg,taxRegOk,declared,periodOk,cycle,recommendedReturn:recommended,selectedReturn:selected,returnWarning,score,rows,generatedAt:new Date().toISOString()};
    window.__taxAiMediaPreflight157Result=result;return result;
  }
  function ensureUi(){
    if($('v157Preflight'))return;
    const v156=$('v156Media');if(!v156)return;
    const sec=document.createElement('div');sec.id='v157Preflight';sec.className='card section';
    sec.innerHTML=`<div class="section-title"><div><h2>🛡️ 6. 媒體申報正式格式預檢 V1.5.7</h2><div class="muted">依財政部現行進銷項81 Bytes欄位規則先檢查內容、代號、期間、流水號與重複資料。此處通過表示「資料準備完成」，正式送件仍須再經財政部官方檢核程式。</div></div><span class="pill">PREFLIGHT</span></div>
      <div class="form" style="margin-top:12px"><div class="field"><label>申報週期</label><select id="v157Cycle"><option value="1">按期申報（雙月）</option><option value="2">按月申報</option></select></div><div class="field"><label>申報書建議</label><input id="v157ReturnSuggest" readonly></div><div class="field"><label>81 Bytes 資料準備度</label><input id="v157Readiness" readonly></div></div>
      <div id="v157Summary" class="info" style="margin-top:12px">等待預檢。</div>
      <div class="actions" style="margin-top:12px"><button id="v157Run" class="btn primary">🛡️ 執行媒體申報預檢</button><button id="v157ExportReport" class="btn secondary">⬇ 匯出預檢報告 JSON</button></div>
      <div class="tablewrap" style="margin-top:14px"><table><thead><tr><th>狀態</th><th>流水號</th><th>格式</th><th>年月</th><th>發票</th><th>課稅別</th><th>扣抵</th><th>問題／提醒</th></tr></thead><tbody id="v157Rows"></tbody></table></div>
      <div id="v157OfficialNote" class="warn" style="margin-top:12px">⚠ V1.5.7 不宣稱已完成正式送件驗證；正式媒體／網路申報前仍需通過財政部電子申報繳稅系統之檢核程式。</div>`;
    v156.insertAdjacentElement('afterend',sec);
    const pref=load(PREF_KEY,{filingCycle:'1'});$('v157Cycle').value=pref.filingCycle||'1';
    $('v157Cycle').addEventListener('change',()=>{save(PREF_KEY,{filingCycle:$('v157Cycle').value});render()});
    $('v157Run').addEventListener('click',e=>{e.preventDefault();render()});
    $('v157ExportReport').addEventListener('click',e=>{e.preventDefault();exportReport()});
  }
  function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function render(){
    ensureUi();const r=run();if(!$('v157Summary'))return r;
    $('v157ReturnSuggest').value=`${r.recommendedReturn}${r.returnWarning?'（與目前選擇不同）':''}`;
    $('v157Readiness').value=`${r.score}/100`;
    $('v157Summary').className=r.review||!r.taxRegOk||!r.periodOk?'warn':'ok';
    $('v157Summary').textContent=`${r.review||!r.taxRegOk||!r.periodOk?'⚠':'✓'} 共 ${r.count} 筆｜可進入正式檢核 ${r.ready} 筆｜需處理 ${r.review} 筆｜疑似重複 ${r.duplicates} 筆｜稅籍編號 ${r.taxRegOk?'9碼完成':'未完成'}｜申報期間 ${r.periodOk?r.declared:'未設定'}｜建議申報書 ${r.recommendedReturn}${r.returnWarning?`｜${r.returnWarning}`:''}`;
    $('v157Rows').innerHTML=r.rows.map(x=>`<tr><td>${x.ok?'✅ READY':'⚠ REVIEW'}</td><td>${x.serial}</td><td>${esc(x.record.formatCode||'—')}</td><td>${esc(x.record.rocYm||'—')}</td><td>${esc((x.record.track||'--')+'-'+(x.record.number||'--------'))}</td><td>${esc(x.record.taxCode||x.record.taxCategory||'—')}</td><td>${esc(x.record.deductionCode||'空白')}</td><td>${esc([...x.errors,...x.warnings].join('；')||'欄位邏輯通過')}</td></tr>`).join('')||'<tr><td colspan="8">尚無媒體申報資料</td></tr>';
    return r;
  }
  function exportReport(){const r=render(),blob=new Blob([JSON.stringify(r,null,2)],{type:'application/json;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`tax-ai-v157-preflight-${r.declared||'period'}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
  function applyVersion(){document.title='AI 超簡易營業稅申報 V1.5.7｜媒體申報預檢版';const sub=document.querySelector('.top .muted');if(sub)sub.textContent='V1.5.7｜AI 發票辨識＋媒體申報資料＋401試算＋81 Bytes 欄位預檢';const hero=document.querySelector('.hero');if(hero)hero.innerHTML='<b>V1.5.7 媒體申報預檢：</b>先由 AI 完成發票辨識、課稅別與稅額，再建立整期媒體資料與 401 試算；最後以財政部現行欄位規則檢查稅籍編號、流水號、資料年月、格式代號、課稅別、扣抵代號、彙加註記及重複資料。正式送件仍以官方檢核程式結果為準。'}
  function patch(){ensureUi();applyVersion();render()}
  patch();setTimeout(patch,300);setTimeout(patch,1200);setInterval(()=>{ensureUi();},2000);
  window.__taxAiMediaPreflight157Api={run,render,fixedFieldCheck,periodCheck,recommendedReturn};
  console.info('[TaxAI] V1.5.7 media preflight active',BUILD);
})();