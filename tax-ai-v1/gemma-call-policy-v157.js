(function(){
  if(window.__taxAiGemmaCallPolicy157)return;
  window.__taxAiGemmaCallPolicy157=true;

  const BUILD='20260826-v157-stable-r9';
  const upstreamFetch=window.fetch.bind(window);
  const fakeJobs=new Map();
  const concrete=new Set(['應稅','零稅率','免稅']);
  const $=id=>document.getElementById(id);

  function urlOf(input){try{return typeof input==='string'?input:input.url}catch{return String(input||'')}}
  function isHandLike(){
    const t=String($('invoiceType')?.value||'auto');
    if(t==='hand')return true;
    if(t==='electronic')return false;
    try{if(window.__taxAiQr152)return false}catch{}
    try{if(typeof state!=='undefined'&&Array.isArray(state.qr)&&state.qr.length)return false}catch{}
    return true;
  }
  function currentCategory(){const v=String($('taxCategory')?.value||'');return concrete.has(v)?v:''}
  function fakeSubmit(payload){
    const id='tax-ai-policy-'+Date.now()+'-'+Math.random().toString(36).slice(2);
    fakeJobs.set(id,payload);
    return new Response(JSON.stringify({event_id:id}),{status:200,headers:{'content-type':'application/json','x-tax-ai-policy':BUILD}});
  }
  function fakeResult(payload){
    return new Response(`event: complete\ndata: ${JSON.stringify([payload])}\n\n`,{status:200,headers:{'content-type':'text/event-stream; charset=utf-8','x-tax-ai-policy':BUILD}});
  }
  function taxPayloadForPolicy(){
    const cat=currentCategory();
    if(cat)return {category:cat,confidence:1,evidence:'已有明確課稅別，V1.5.7 r9 略過重複 Gemma 呼叫',source:'stable-call-policy'};
    if(isHandLike()&&!window.__taxAiWholeGemmaFinished157)return {category:'待確認',confidence:0,evidence:'手開發票先完成整張 Gemma，再依缺漏補專用辨識',source:'stable-call-policy-deferred'};
    return null;
  }
  function markWholeComplete(text){
    const s=String(text||'');
    if(/event:\s*complete/i.test(s)&&(/"results"|"invoice_number"|"data"/i.test(s))){
      window.__taxAiWholeGemmaFinished157=true;
      window.__taxAiWholeGemmaFinishedAt157=Date.now();
    }
  }
  function reset(){window.__taxAiWholeGemmaFinished157=false;window.__taxAiWholeGemmaFinishedAt157=0;fakeJobs.clear()}

  window.fetch=async function(input,init){
    const url=urlOf(input),method=String(init?.method||input?.method||'GET').toUpperCase();

    const taxSubmit=url.match(/\/gradio_api\/call\/tax_category_api(?:\?.*)?$/i);
    if(taxSubmit&&method==='POST'){
      const payload=taxPayloadForPolicy();
      if(payload){
        console.info('[TaxAI r9] skip/defer redundant tax Gemma',payload);
        return fakeSubmit(payload);
      }
    }

    const fakeMatch=url.match(/\/gradio_api\/call\/tax_category_api\/(tax-ai-policy-[^/?#]+)/i);
    if(fakeMatch&&method==='GET'&&fakeJobs.has(fakeMatch[1])){
      const payload=fakeJobs.get(fakeMatch[1]);fakeJobs.delete(fakeMatch[1]);return fakeResult(payload);
    }

    const invoiceResult=/\/gradio_api\/call\/invoice_api\/[^/?#]+/i.test(url)&&method==='GET';
    const resp=await upstreamFetch(input,init);
    if(invoiceResult&&resp.ok){
      try{const text=await resp.clone().text();markWholeComplete(text)}catch{}
    }
    return resp;
  };

  for(const id of ['camera','purchase','sales']){
    const el=$(id);if(el&&!el.dataset.gemmaPolicyReset157){el.dataset.gemmaPolicyReset157='1';el.addEventListener('change',reset)}
  }
  const scan=$('scan');if(scan&&!scan.dataset.gemmaPolicyReset157){scan.dataset.gemmaPolicyReset157='1';scan.addEventListener('click',()=>{if(!window.__taxAiWholeGemmaFinishedAt157||Date.now()-window.__taxAiWholeGemmaFinishedAt157>1000)window.__taxAiWholeGemmaFinished157=false},{capture:true})}

  window.__taxAiGemmaCallPolicy157Api={BUILD,reset,isHandLike,currentCategory,taxPayloadForPolicy};
  console.info('[TaxAI] V1.5.7 stable Gemma call policy active',BUILD);
})();