(function(){
  if(window.__taxAiTetu158)return;
  window.__taxAiTetu158=true;
  const VERSION='1.5.8',BUILD='20260826-v158-tetu112-preview';
  const $=id=>document.getElementById(id);
  const RECORD_KEY='taxai.media.v156.records',META_KEY='taxai.media.v156.meta',PROFILE_KEY='taxai.tetu.v158.profile';
  const HEADER_NAMES=['資料別','檔案編號','統一編號','所屬年月','申報代號','稅籍編號','總繳代號','申報種類','縣市別','自行或委任申報註記','申報人身分證統一編號','申報人姓名','申報人電話區域碼','申報人電話','申報人電話分機','代理申報人登錄(文)字號'];
  function load(k,d){try{return JSON.parse(localStorage.getItem(k)||'null')??d}catch{return d}}
  function save(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}
  function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function digits(v){return String(v??'').replace(/\D/g,'')}
  function num(v){const n=Number(v);return Number.isFinite(n)?Math.round(n):0}
  function readRecords(){return load(RECORD_KEY,[])}
  function readMeta(){return load(META_KEY,{taxRegNo:'',carry:0,period:'',returnType:'401'})}
  function defaultProfile(){return {businessName:'',filingCode:'1',totalCode:'0',cycle:'1',cityCode:'',filerMode:'1',filerId:'',filerName:'',areaCode:'',phone:'',extension:'',agentRegNo:'',refundLimit:0,refundApplied:0}}
  function readProfile(){return {...defaultProfile(),...load(PROFILE_KEY,{})}}
  function dataType(returnType){return String(returnType)==='403'?'3':String(returnType)==='404'?'4':'1'}
  function recommendedReturn(records){return records.some(r=>String(r.taxCode)==='3'||r.taxCategory==='免稅')?'403':'401'}
  function calcCore(records,carry,refundLimit,refundApplied){
    const sales=records.filter(r=>r.role==='sales'),purchase=records.filter(r=>r.role==='purchase');
    const taxableSales=sales.filter(r=>String(r.taxCode||'')==='1'||r.taxCategory==='應稅');
    const zeroSales=sales.filter(r=>String(r.taxCode||'')==='2'||r.taxCategory==='零稅率');
    const exemptSales=sales.filter(r=>String(r.taxCode||'')==='3'||r.taxCategory==='免稅');
    const deductible=purchase.filter(r=>['1','2'].includes(String(r.deductionCode||'')));
    const c101=taxableSales.reduce((s,r)=>s+num(r.tax),0);
    const c107=deductible.reduce((s,r)=>s+num(r.tax),0);
    const c108=Math.max(0,num(carry));
    const c110=c107+c108,c111=Math.max(0,c101-c110),c112=Math.max(0,c110-c101);
    const c113=Math.max(0,num(refundLimit));
    const c114=Math.min(c112,c113,Math.max(0,num(refundApplied)));
    const c115=Math.max(0,c112-c114);
    return {salesTaxableNet:taxableSales.reduce((s,r)=>s+num(r.net),0),salesZeroNet:zeroSales.reduce((s,r)=>s+num(r.net),0),salesExemptNet:exemptSales.reduce((s,r)=>s+num(r.net),0),purchaseDeductibleTax:c107,c101,c107,c108,c110,c111,c112,c113,c114,c115,count:records.length};
  }
  function headerValues(profile,meta,returnType,ban){
    const total=String(profile.totalCode||'0'),filingCode=total==='1'?'5':'1';
    return [dataType(returnType),'00000000',ban,String(meta.period||''),filingCode,digits(meta.taxRegNo||'').slice(0,9),total,String(profile.cycle||'1'),String(profile.cityCode||'').slice(0,1),String(profile.filerMode||'1'),String(profile.filerId||'').slice(0,10),String(profile.filerName||'').slice(0,12),digits(profile.areaCode||'').slice(0,4),digits(profile.phone||'').slice(0,11),digits(profile.extension||'').slice(0,5),String(profile.agentRegNo||'').slice(0,50)];
  }
  function validateHeader(values,profile,returnType){
    const e=[],w=[];
    if(!['1','3','4'].includes(values[0]))e.push('資料別應為401/403/404對應代號');
    if(values[1]!=='00000000')e.push('檔案編號應為8個0');
    if(!/^\d{8}$/.test(values[2]))e.push('統一編號需8碼');
    if(!/^\d{5}$/.test(values[3]))e.push('所屬年月需民國YYYMM 5碼');
    if(!['1','5'].includes(values[4]))e.push('申報代號需1或5');
    if(!/^\d{9}$/.test(values[5]))e.push('稅籍編號需9碼');
    if(!['0','1','2'].includes(values[6]))e.push('總繳代號需0/1/2');
    if(!['1','2'].includes(values[7]))e.push('申報種類需1按期或2按月');
    if(!/^[0-9A-Za-z]$/.test(values[8]))e.push('縣市別需1碼');
    if(!['1','2'].includes(values[9]))e.push('自行/委任申報註記需1或2');
    if(values[10]&&values[10].length!==10)w.push('申報人身分證/統一編號建議10碼');
    if(!values[11])e.push('申報人姓名不可空白');
    if(profile.filerMode==='2'&&!values[15])e.push('委任申報需填代理申報人登錄字號');
    if(profile.filerMode==='1'&&values[15])w.push('自行申報時代理申報人登錄字號應留空');
    const expected=dataType(returnType);if(values[0]!==expected)e.push('資料別與申報書種類不一致');
    return {errors:e,warnings:w,ok:e.length===0};
  }
  function build112(values){const a=Array(112).fill('');for(let i=0;i<16;i++)a[i]=values[i]??'';return a}
  function snapshot(){
    const records=readRecords(),meta=readMeta(),profile=readProfile();
    const ban=digits($('companyBan')?.value||'').slice(0,8);
    const suggested=recommendedReturn(records),selected=String($('v156ReturnType')?.value||meta.returnType||suggested||'401');
    const core=calcCore(records,Number($('v156Carry')?.value??meta.carry??0),Number($('v158RefundLimit')?.value??profile.refundLimit??0),Number($('v158RefundApplied')?.value??profile.refundApplied??0));
    const values=headerValues(profile,{...meta,period:String($('v156Period')?.value||meta.period||'')},selected,ban),check=validateHeader(values,profile,selected),fields=build112(values);
    const compatibility=selected===suggested||records.length===0;
    return {version:VERSION,build:BUILD,records,meta,profile,ban,suggested,selected,compatibility,headerValues:values,headerCheck:check,fields112:fields,core,pipePreview:fields.join('|'),generatedAt:new Date().toISOString()};
  }
  function createUi(){
    if($('v158Tetu'))return;
    const anchor=$('v157Preflight')||$('v156Media');if(!anchor)return;
    const p=readProfile(),sec=document.createElement('div');sec.id='v158Tetu';sec.className='card section';
    sec.innerHTML=`<div class="section-title"><div><h2>📄 7. 401／403 TET_U 112欄申報資料層 V1.5.8</h2><div class="muted">依財政部現行規範建立TET_U前16欄申報識別資料與401/403核心稅額試算。112欄其餘欄位尚在逐欄映射，因此目前只提供結構預覽／JSON，不輸出可正式送件TET_U。</div></div><span class="pill">112-FIELD PREVIEW</span></div>
      <div class="form" style="margin-top:12px">
        <div class="field"><label>營業人名稱</label><input id="v158BusinessName" value="${esc(p.businessName)}" placeholder="公司／商號名稱"></div>
        <div class="field"><label>總繳代號</label><select id="v158TotalCode"><option value="0">0｜無總繳</option><option value="1">1｜總機構彙總報繳</option><option value="2">2｜各單位分別申報</option></select></div>
        <div class="field"><label>申報種類</label><select id="v158Cycle"><option value="1">1｜按期申報</option><option value="2">2｜按月申報</option></select></div>
        <div class="field"><label>縣市別（1碼）</label><input id="v158CityCode" maxlength="1" value="${esc(p.cityCode)}" placeholder="附件七代號"></div>
        <div class="field"><label>自行／委任申報</label><select id="v158FilerMode"><option value="1">1｜自行申報</option><option value="2">2｜委任申報</option></select></div>
        <div class="field"><label>申報人身分證／統一編號</label><input id="v158FilerId" maxlength="10" value="${esc(p.filerId)}"></div>
        <div class="field"><label>申報人姓名</label><input id="v158FilerName" maxlength="12" value="${esc(p.filerName)}"></div>
        <div class="field"><label>電話區域碼</label><input id="v158Area" maxlength="4" value="${esc(p.areaCode)}"></div>
        <div class="field"><label>申報人電話</label><input id="v158Phone" maxlength="11" value="${esc(p.phone)}"></div>
        <div class="field"><label>分機</label><input id="v158Ext" maxlength="5" value="${esc(p.extension)}"></div>
        <div class="field full"><label>代理申報人登錄(文)字號</label><input id="v158AgentReg" maxlength="50" value="${esc(p.agentRegNo)}" placeholder="自行申報留空"></div>
        <div class="field"><label>【113】得退稅限額（需附件／資格驗證）</label><input id="v158RefundLimit" type="number" min="0" value="${num(p.refundLimit)}"></div>
        <div class="field"><label>【114】本期擬申請退稅額</label><input id="v158RefundApplied" type="number" min="0" value="${num(p.refundApplied)}"></div>
      </div>
      <div id="v158Summary" class="info" style="margin-top:12px"></div>
      <div class="two section" style="margin-top:14px"><div><h3>🧮 401／403 核心稅額</h3><div id="v158Core"></div></div><div><h3>🪪 TET_U 前16欄檢核</h3><div id="v158HeaderCheck"></div></div></div>
      <h3 style="margin-top:16px">TET_U 前16欄結構預覽</h3><div class="tablewrap"><table><thead><tr><th>#</th><th>欄位</th><th>值</th></tr></thead><tbody id="v158HeaderRows"></tbody></table></div>
      <div class="field full" style="margin-top:14px"><label>112欄 Pipe 結構預覽（非正式申報檔）</label><textarea id="v158Pipe" readonly style="min-height:100px"></textarea></div>
      <div class="actions" style="margin-top:12px"><button id="v158Refresh" class="btn primary">🔄 更新401／403申報預覽</button><button id="v158Export" class="btn secondary">⬇ 匯出112欄映射草稿 JSON</button></div>
      <div class="warn" style="margin-top:12px">⚠ 此版已精確映射官方TET_U第1～16欄；第17～112欄仍需依附件六逐欄完成。正式申報前仍須使用財政部官方檢核程式前端審核。</div>`;
    anchor.insertAdjacentElement('afterend',sec);
    $('v158TotalCode').value=String(p.totalCode||'0');$('v158Cycle').value=String(p.cycle||$('v157Cycle')?.value||'1');$('v158FilerMode').value=String(p.filerMode||'1');bind();render();
  }
  function collectProfile(){return {businessName:$('v158BusinessName')?.value||'',totalCode:$('v158TotalCode')?.value||'0',cycle:$('v158Cycle')?.value||'1',cityCode:$('v158CityCode')?.value||'',filerMode:$('v158FilerMode')?.value||'1',filerId:$('v158FilerId')?.value||'',filerName:$('v158FilerName')?.value||'',areaCode:$('v158Area')?.value||'',phone:$('v158Phone')?.value||'',extension:$('v158Ext')?.value||'',agentRegNo:$('v158AgentReg')?.value||'',refundLimit:num($('v158RefundLimit')?.value),refundApplied:num($('v158RefundApplied')?.value)}}
  function persist(){save(PROFILE_KEY,collectProfile())}
  function bind(){
    for(const id of ['v158BusinessName','v158TotalCode','v158Cycle','v158CityCode','v158FilerMode','v158FilerId','v158FilerName','v158Area','v158Phone','v158Ext','v158AgentReg','v158RefundLimit','v158RefundApplied'])$(id)?.addEventListener('change',()=>{persist();render()});
    $('v158Refresh')?.addEventListener('click',e=>{e.preventDefault();persist();render()});$('v158Export')?.addEventListener('click',e=>{e.preventDefault();exportJson()});
  }
  function render(){
    if(!$('v158Tetu'))return null;persist();const s=snapshot(),c=s.core,chk=s.headerCheck;
    $('v158Summary').className=chk.ok&&s.compatibility?'ok':'warn';$('v158Summary').textContent=`${chk.ok&&s.compatibility?'✓':'⚠'} ${s.selected} 申報資料｜${s.records.length}筆進銷項｜建議申報書 ${s.suggested}｜TET_U前16欄 ${chk.ok?'完整':'需補資料'}｜112欄已建立結構骨架（其餘欄位待完整映射）`;
    $('v158Core').innerHTML=`<div class="row"><span>應稅銷售額</span><b>${c.salesTaxableNet}</b></div><div class="row"><span>零稅率銷售額</span><b>${c.salesZeroNet}</b></div><div class="row"><span>免稅銷售額</span><b>${c.salesExemptNet}</b></div><div class="row"><span>【101】本期銷項稅額</span><b>${c.c101}</b></div><div class="row"><span>【107】得扣抵進項稅額</span><b>${c.c107}</b></div><div class="row"><span>【108】上期累積留抵</span><b>${c.c108}</b></div><div class="row"><span>【110】107＋108</span><b>${c.c110}</b></div><div class="row"><span>【111】本期應實繳</span><b>${c.c111}</b></div><div class="row"><span>【112】本期申報留抵</span><b>${c.c112}</b></div><div class="row"><span>【113】得退稅限額</span><b>${c.c113}</b></div><div class="row"><span>【114】本期應退稅</span><b>${c.c114}</b></div><div class="row"><span>【115】本期累積留抵</span><b>${c.c115}</b></div>`;
    $('v158HeaderCheck').innerHTML=chk.ok?`<div class="ok">✅ 前16欄必要格式通過${chk.warnings.length?'；提醒：'+esc(chk.warnings.join('；')):''}</div>`:`<div class="warn">⚠ ${esc(chk.errors.join('；'))}${chk.warnings.length?'；'+esc(chk.warnings.join('；')):''}</div>`;
    $('v158HeaderRows').innerHTML=HEADER_NAMES.map((n,i)=>`<tr><td>${i+1}</td><td>${esc(n)}</td><td class="mono">${esc(s.headerValues[i]||'（空白）')}</td></tr>`).join('');$('v158Pipe').value=s.pipePreview;window.__taxAiTetu158Snapshot=s;return s;
  }
  function exportJson(){const s=render(),blob=new Blob([JSON.stringify(s,null,2)],{type:'application/json;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`tax-ai-v158-tetu-map-${s.meta.period||'period'}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
  function applyVersion(){document.title='AI 超簡易營業稅申報 V1.5.8｜401／403 TET_U 112欄資料層';const sub=document.querySelector('.top .muted');if(sub)sub.textContent='V1.5.8｜發票辨識＋媒體申報＋401/403核心試算＋TET_U 112欄結構預覽';const hero=document.querySelector('.hero');if(hero)hero.innerHTML='<b>V1.5.8：</b>從發票影像一路走到營業稅媒體申報。AI先辨識發票與課稅別、建立進銷項媒體資料、預檢81 Bytes，再建立401／403申報人資料與TET_U 112欄結構。正式檔輸出前仍保留財政部官方檢核安全門。';const scan=$('scan');if(scan)scan.textContent='✨ V1.5.8：AI辨識＋媒體申報＋401/403預覽'}
  function patch(){createUi();applyVersion();if($('v158Tetu'))render()}
  patch();setTimeout(patch,300);setTimeout(patch,1000);setInterval(()=>{applyVersion();if(!$('v158Tetu'))createUi()},1100);
  window.__taxAiTetu158Api={VERSION,BUILD,snapshot,calcCore,headerValues,validateHeader,build112,render};
})();
