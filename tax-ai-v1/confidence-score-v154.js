(function(){
  if(window.__taxAiConfidenceScore154)return;
  window.__taxAiConfidenceScore154=true;
  const $=id=>document.getElementById(id);
  const VERSION='1.5.4';
  const BUILD='20260824-v154-composite-confidence';
  const CATS=['應稅','零稅率','免稅'];

  function digits(v){return String(v||'').replace(/\D/g,'')}
  function validBan(v){
    const b=digits(v);if(!/^\d{8}$/.test(b))return false;
    const w=[1,2,1,2,1,2,4,1];let sum=0;
    for(let i=0;i<8;i++){const p=Number(b[i])*w[i];sum+=Math.floor(p/10)+(p%10)}
    return sum%5===0;
  }
  function n(id){const s=String($(id)?.value??'').replace(/[,，\s元$NTnt]/g,'');if(s==='')return NaN;const x=Number(s);return Number.isFinite(x)?x:NaN}
  function ocrConfidence(){
    try{if(typeof state!=='undefined'&&Number.isFinite(Number(state.ocrConfidence)))return Math.max(0,Math.min(100,Number(state.ocrConfidence)))}catch{}
    const txt=String($('ocrConfidence')?.textContent||'');const m=txt.match(/(?:OCR[^0-9]*)?(\d{1,3})\s*%/i);return m?Math.max(0,Math.min(100,Number(m[1]))):0;
  }
  function taxConfidence(){
    const d=window.__taxAiV154Decision;if(d&&Number.isFinite(Number(d.confidence)))return Math.max(0,Math.min(100,Number(d.confidence)));
    const sel=$('taxCategory');let c=Number(sel?.dataset?.v154Confidence);if(Number.isFinite(c)&&c>0)return Math.max(0,Math.min(100,c));
    const txt=String($('taxCategoryEvidenceBody')?.textContent||'');const m=txt.match(/confidence\s*(\d{1,3})%/i)||txt.match(/信心(?:度)?\s*(\d{1,3})%/);return m?Math.max(0,Math.min(100,Number(m[1]))):0;
  }
  function hasSourceConflicts(){
    try{
      if(typeof state!=='undefined'&&state?.candidates){
        for(const k of ['number','seller','buyer','net','tax','gross']){
          const vals=[...new Set((state.candidates[k]||[]).map(x=>String(x.value)).filter(Boolean))];if(vals.length>1)return true;
        }
        return false;
      }
    }catch{}
    const t=String($('conflicts')?.textContent||'');return /不同來源值|金額不一致|檢查碼異常/.test(t);
  }
  function score(){
    const track=String($('track')?.value||'').trim().toUpperCase(),no=digits($('number')?.value),seller=digits($('seller')?.value),buyer=digits($('buyer')?.value),date=String($('date')?.value||'');
    const net=n('net'),tax=n('tax'),gross=n('gross'),cat=String($('taxCategory')?.value||'');
    const taxConf=taxConfidence(),ocrConf=ocrConfidence();
    const parts={identity:0,amounts:0,taxCategory:0,crossSource:0,ocr:0};
    const detail=[];

    if(/^[A-Z]{2}$/.test(track)&&/^\d{8}$/.test(no)){parts.identity+=12;detail.push('發票號碼 12/12')}else detail.push('發票號碼 0/12');
    if(validBan(seller)){parts.identity+=10;detail.push('賣方統編 10/10')}else detail.push('賣方統編 0/10');
    if(!buyer||validBan(buyer)){parts.identity+=8;detail.push(`買方統編 ${buyer?'8/8':'8/8（未登載可接受）'}`)}else detail.push('買方統編 0/8');
    if(/^20\d{2}-\d{2}-\d{2}$/.test(date)||/^20\d{2}\/\d{2}\/\d{2}$/.test(date)){parts.identity+=5;detail.push('日期 5/5')}else detail.push('日期 0/5');

    const complete=Number.isFinite(net)&&net>=0&&Number.isFinite(tax)&&tax>=0&&Number.isFinite(gross)&&gross>0;
    if(complete){parts.amounts+=10;detail.push('金額完整 10/10')}else detail.push('金額完整 0/10');
    const equation=complete&&Math.round(net+tax)===Math.round(gross);
    if(equation){parts.amounts+=15;detail.push('金額等式 15/15')}else detail.push('金額等式 0/15');
    const taxLogic=cat==='應稅'?complete&&tax>0&&Math.abs(tax-Math.round(net*.05))<=1:(cat==='零稅率'||cat==='免稅')?complete&&Math.round(tax)===0:true;
    if(taxLogic){parts.amounts+=10;detail.push('稅額邏輯 10/10')}else detail.push('稅額邏輯 0/10');

    if(CATS.includes(cat)){
      const catPoints=taxConf>=90?15:taxConf>=70?12:taxConf>=50?9:6;
      parts.taxCategory=catPoints;detail.push(`課稅別 ${catPoints}/15（${Math.round(taxConf)}%）`);
    }else detail.push('課稅別 0/15');

    const conflict=hasSourceConflicts();if(!conflict){parts.crossSource=7;detail.push('跨來源一致 7/7')}else detail.push('跨來源一致 0/7');
    parts.ocr=Math.round(Math.max(0,Math.min(8,ocrConf*.08)));detail.push(`OCR ${parts.ocr}/8（${Math.round(ocrConf)}%）`);

    let total=Object.values(parts).reduce((a,b)=>a+b,0);
    if(/金額不一致|檢查碼異常/.test(String($('conflicts')?.textContent||'')))total-=10;
    total=Math.max(0,Math.min(100,Math.round(total)));
    return {total,parts,detail,ocrConf,taxConf,cat,equation,taxLogic,complete,conflict};
  }
  function band(total){
    if(total>=95)return {label:'極高',mark:'✅'};
    if(total>=90)return {label:'高',mark:'✅'};
    if(total>=80)return {label:'良好',mark:'🟢'};
    if(total>=70)return {label:'中等',mark:'⚠️'};
    return {label:'需核對',mark:'⚠️'};
  }
  function ensureBreakdown(){
    let e=$('v154ScoreBreakdown');if(e)return e;
    e=document.createElement('div');e.id='v154ScoreBreakdown';e.className='info';e.style.marginTop='10px';
    const checks=$('checks');if(checks)checks.insertAdjacentElement('beforebegin',e);return e;
  }
  function render(){
    const r=score(),b=band(r.total),q=$('qualityScore');
    if(q&&q.textContent!==String(r.total))q.textContent=String(r.total);
    const pill=$('ocrConfidence');if(pill){pill.textContent=`${b.mark} 綜合信心 ${r.total}%｜OCR ${Math.round(r.ocrConf)}%`;pill.title=`V1.5.4 綜合辨識信心：${r.total}%。OCR 僅占 8 分；其餘由欄位格式、統編、金額等式、5% 稅額、課稅別與跨來源一致性組成。`}
    const e=ensureBreakdown();if(e){
      e.className=r.total>=90?'ok':r.total>=70?'info':'warn';
      e.textContent=`${b.mark} V1.5.4 綜合辨識信心 ${r.total}/100｜身分欄位 ${r.parts.identity}/35｜金額驗證 ${r.parts.amounts}/35｜課稅別 ${r.parts.taxCategory}/15｜跨來源 ${r.parts.crossSource}/7｜OCR ${r.parts.ocr}/8`;
    }
    window.__taxAiCompositeConfidence154={version:VERSION,build:BUILD,...r,band:b.label,at:new Date().toISOString()};
    return r;
  }
  function schedule(){clearTimeout(schedule.t);schedule.t=setTimeout(render,60)}
  function bind(){
    for(const id of ['date','track','number','seller','buyer','net','tax','gross','taxCategory']){const e=$(id);if(e&&!e.dataset.v154ScoreBound){e.dataset.v154ScoreBound='1';e.addEventListener('input',schedule);e.addEventListener('change',schedule)}}
    const q=$('qualityScore');if(q&&!q.dataset.v154ScoreObserved){q.dataset.v154ScoreObserved='1';new MutationObserver(schedule).observe(q,{childList:true,characterData:true,subtree:true})}
    for(const id of ['checks','conflicts','taxCategoryEvidenceBody']){const e=$(id);if(e&&!e.dataset.v154ScoreObserved){e.dataset.v154ScoreObserved='1';new MutationObserver(schedule).observe(e,{childList:true,characterData:true,subtree:true})}}
  }
  function patch(){bind();render()}
  patch();setTimeout(patch,200);setTimeout(patch,900);setInterval(()=>{bind();render()},1200);
  window.__taxAiConfidenceScore154Api={score,render,band};
  console.info('[TaxAI] V1.5.4 composite confidence scoring enabled',BUILD);
})();
