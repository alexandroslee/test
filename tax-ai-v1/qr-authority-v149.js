(function(){
  if(window.__taxAiQrAuthority149)return;
  window.__taxAiQrAuthority149=true;

  const nativeFetch=window.fetch.bind(window);
  const synthetic=new Map();
  const $=id=>document.getElementById(id);

  function clean(s){return String(s||'').trim()}
  function parseTaiwanQr(raw){
    let q=clean(raw).toUpperCase();
    const pos=q.search(/[A-Z]{2}\d{8}/);
    if(pos>0)q=q.slice(pos);
    if(q.length<53||!/^[A-Z]{2}\d{8}/.test(q))return null;
    const inv=q.slice(0,10),roc=q.slice(10,17),netHex=q.slice(21,29),grossHex=q.slice(29,37);
    const buyer=q.slice(37,45),seller=q.slice(45,53);
    if(!/^\d{7}$/.test(roc)||!/^[0-9A-F]{8}$/.test(netHex)||!/^[0-9A-F]{8}$/.test(grossHex))return null;
    if(!/^\d{8}$/.test(buyer)||!/^\d{8}$/.test(seller))return null;
    const y=parseInt(roc.slice(0,3),10)+1911,m=roc.slice(3,5),d=roc.slice(5,7);
    const net=parseInt(netHex,16),gross=parseInt(grossHex,16);
    if(!Number.isFinite(net)||!Number.isFinite(gross)||gross<net)return null;
    return {raw:q,track:inv.slice(0,2),number:inv.slice(2),date:`${y}-${m}-${d}`,seller,buyer:/^0{8}$/.test(buyer)?'':buyer,net,gross,tax:gross-net};
  }

  function setField(id,value,source){
    const el=$(id);if(!el)return;
    const v=value==null?'':String(value);
    if(el.dataset.humanEdited==='1'&&clean(el.value)!==''&&clean(el.value)!==v)return;
    el.value=v;el.dataset.qrAuthority='1';el.dataset.aiSource=source;
    try{if(typeof addCandidate==='function'&&v!=='')addCandidate(id,v,source,500)}catch{}
    try{if(typeof setSource==='function')setSource(id,source)}catch{}
  }

  function ensurePanel(){
    let p=$('qrAuthority149');if(p)return p;
    p=document.createElement('div');p.id='qrAuthority149';p.className='info';p.style.marginTop='10px';
    p.innerHTML='<b>📱 電子發票 QR 權威資料</b><div id="qrAuthority149Body" style="margin-top:6px">等待標準電子發票第一個 QR。</div>';
    const card=$('hfZeroGpuCard');
    if(card){const status=$('hfStatus');if(status)status.insertAdjacentElement('afterend',p);else card.appendChild(p)}
    else document.querySelector('.card')?.appendChild(p);
    return p;
  }

  function render(p,sourceLabel){
    const panel=ensurePanel();panel.className='ok';
    const body=$('qrAuthority149Body');if(!body)return;
    body.innerHTML=`<b>${p.track}-${p.number}</b>　日期 ${p.date}<br>賣方統編 <b>${p.seller}</b>　買方統編 <b>${p.buyer||'未登載'}</b><br><span style="font-size:1.12em">未稅／銷售額 <b>${p.net.toLocaleString('zh-TW')}</b>　稅額 <b>${p.tax.toLocaleString('zh-TW')}</b>　含稅總額 <b>${p.gross.toLocaleString('zh-TW')}</b></span><br><small>${sourceLabel}｜QR 為電子發票權威來源；這一步不需要 ZeroGPU。</small>`;
  }

  function showDirectSuccess(p){
    setTimeout(()=>{
      const badge=$('hfBadge'),status=$('hfStatus'),meta=$('hfMeta');
      if(badge)badge.textContent='QR 完成';
      if(status){status.className='ok';status.textContent=`✓ 電子發票 QR 直接解析完成：未稅 ${p.net.toLocaleString('zh-TW')}、稅額 ${p.tax.toLocaleString('zh-TW')}、含稅總額 ${p.gross.toLocaleString('zh-TW')}。不需等待 ZeroGPU。`;}
      if(meta)meta.textContent='來源＝台灣電子發票第一個 QR｜Gemma 4 E4B 可按「交叉辨識」另行驗證';
    },80);
  }

  function apply(p,sourceLabel='QR Code（直接解析）'){
    if(!p)return null;
    setField('track',p.track,sourceLabel);setField('number',p.number,sourceLabel);setField('date',p.date,sourceLabel);
    setField('seller',p.seller,sourceLabel);
    if(p.buyer)setField('buyer',p.buyer,sourceLabel);else{const el=$('buyer');if(el&&el.dataset.humanEdited!=='1')el.value='';try{if(typeof setSource==='function')setSource('buyer','QR Code：未登載')}catch{}}
    setField('net',p.net,sourceLabel+'：銷售額');setField('tax',p.tax,sourceLabel+'：總額－銷售額');setField('gross',p.gross,sourceLabel+'：總額');
    try{if(typeof validateRecognition==='function')validateRecognition()}catch{}
    render(p,sourceLabel);showDirectSuccess(p);
    window.__taxAiLastQrAuthority=p;
    return p;
  }

  function fromState(){
    try{for(const q of (state?.qr||[])){const p=parseTaiwanQr(q);if(p)return apply(p,'QR Code（原始資料直接解析）')}}catch{}
    return null;
  }

  function scanCanvas(c){
    if(!window.jsQR||!c?.width||!c?.height)return null;
    const ctx=c.getContext('2d',{willReadFrequently:true}),W=c.width,H=c.height;
    const regions=[[0,0,W,H],[0,0,Math.ceil(W*.58),H],[0,0,W,Math.ceil(H*.58)],[0,Math.floor(H*.35),Math.ceil(W*.6),Math.ceil(H*.65)],[0,0,Math.ceil(W*.55),Math.ceil(H*.55)],[Math.floor(W*.45),0,Math.ceil(W*.55),Math.ceil(H*.55)],[0,Math.floor(H*.45),Math.ceil(W*.55),Math.ceil(H*.55)],[Math.floor(W*.45),Math.floor(H*.45),Math.ceil(W*.55),Math.ceil(H*.55)]];
    for(const [x,y,w0,h0] of regions){
      const w=Math.min(w0,W-x),h=Math.min(h0,H-y);if(w<60||h<60)continue;
      try{const im=ctx.getImageData(x,y,w,h);const r=jsQR(im.data,w,h,{inversionAttempts:'attemptBoth'});if(r?.data){const p=parseTaiwanQr(r.data);if(p)return {p,raw:r.data}}}catch{}
    }
    return null;
  }

  function fromPreview(){
    const img=$('preview');if(!img||!img.complete)return null;
    const W=img.naturalWidth||img.width,H=img.naturalHeight||img.height;if(W<50||H<50)return null;
    const scale=Math.min(1,1600/Math.max(W,H)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(W*scale));c.height=Math.max(1,Math.round(H*scale));
    c.getContext('2d',{willReadFrequently:true}).drawImage(img,0,0,c.width,c.height);
    const hit=scanCanvas(c);if(!hit)return null;
    try{if(typeof state!=='undefined'&&Array.isArray(state.qr)&&!state.qr.includes(hit.raw))state.qr.unshift(hit.raw)}catch{}
    return apply(hit.p,'QR Code（正向影像重新掃描）');
  }

  function resolveQr(){return fromState()||fromPreview()||window.__taxAiLastQrAuthority||null}

  function payloadFor(p){
    return {count:1,results:[{data:{invoice_type:'電子發票',invoice_number:`${p.track}-${p.number}`,invoice_date:p.date,seller_tax_id:p.seller,buyer_tax_id:p.buyer,seller_name:'',sales_amount:p.net,tax_amount:p.tax,total_amount:p.gross},confidence:1,source:'taiwan-einvoice-qr-authority',raw_text:`QR authority: ${p.track}-${p.number}; sales=${p.net}; tax=${p.tax}; total=${p.gross}`,warnings:[],elapsed_ms:0,amount_semantics:{sales_amount:'QR 銷售額＝未稅',tax_amount:'QR 總額－銷售額',total_amount:'QR 含稅總額',printed_values_preferred:true}}],model:'Taiwan e-Invoice QR',checksum_used:false,qr_authoritative:true};
  }

  window.fetch=async function(input,init){
    const url=typeof input==='string'?input:(input?.url||String(input||'')),method=String(init?.method||input?.method||'GET').toUpperCase();
    const submit=url.match(/^(https:\/\/[^/]+)\/gradio_api\/call\/invoice_api(?:\?.*)?$/i);
    if(submit&&method==='POST'){
      const p=resolveQr();
      if(p){const id='qr149-'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);synthetic.set(id,payloadFor(p));return new Response(JSON.stringify({event_id:id}),{status:200,headers:{'content-type':'application/json','x-tax-ai-source':'qr-authority-v149'}});}
    }
    const result=url.match(/\/gradio_api\/call\/invoice_api\/(qr149-[^/?#]+)/i);
    if(result&&method==='GET'&&synthetic.has(result[1])){
      const payload=synthetic.get(result[1]);synthetic.delete(result[1]);
      return new Response(`event: complete\ndata: ${JSON.stringify([payload])}\n\n`,{status:200,headers:{'content-type':'text/event-stream; charset=utf-8','x-tax-ai-source':'qr-authority-v149'}});
    }
    return nativeFetch(input,init);
  };

  window.__taxAiQrAuthority={resolve:resolveQr,parse:parseTaiwanQr,apply};
  ensurePanel();
  console.info('[TaxAI] V1.4.9 QR Authority active');
})();
