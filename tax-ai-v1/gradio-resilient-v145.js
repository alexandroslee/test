(function(){
  if(window.__taxAiGradioResilient147)return;
  window.__taxAiGradioResilient147=true;

  const nativeFetch=window.fetch.bind(window);
  const pending=new Map();
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

  function urlOf(input){
    try{return typeof input==='string'?input:input.url}catch{return String(input||'')}
  }

  function cloneHeaders(resp){
    const h=new Headers();
    try{resp.headers.forEach((v,k)=>h.set(k,v))}catch{}
    h.set('content-type','text/event-stream; charset=utf-8');
    h.set('x-tax-ai-transport','gradio-resilient-v147');
    return h;
  }

  function canonicalComplete(output,resp){
    return new Response(`event: complete\ndata: ${JSON.stringify([output])}\n\n`,{status:200,headers:cloneHeaders(resp)});
  }

  function looksLikeOutput(v){
    if(Array.isArray(v))v=v[0];
    return !!(v&&typeof v==='object'&&(
      Array.isArray(v.results)||
      Object.prototype.hasOwnProperty.call(v,'buyer_tax_id')||
      Object.prototype.hasOwnProperty.call(v,'status')||
      Object.prototype.hasOwnProperty.call(v,'model')
    ));
  }

  function parseSse(text){
    const blocks=String(text||'').split(/\r?\n\r?\n+/);
    let lastData=null,errorData=null;
    for(const block of blocks){
      if(!block.trim())continue;
      let event='';
      const dataLines=[];
      for(const line of block.split(/\r?\n/)){
        if(line.startsWith('event:'))event=line.slice(6).trim();
        else if(line.startsWith('data:'))dataLines.push(line.slice(5).trim());
      }
      if(!dataLines.length)continue;
      const raw=dataLines.join('\n');
      let parsed=null;
      try{parsed=JSON.parse(raw)}catch{}
      if(parsed!==null)lastData=parsed;
      if(event==='complete'&&parsed!==null){
        return {ok:true,payload:Array.isArray(parsed)?parsed[0]:parsed,event,raw};
      }
      if(event==='error')errorData=parsed??raw;
    }
    if(looksLikeOutput(lastData)){
      return {ok:true,payload:Array.isArray(lastData)?lastData[0]:lastData,event:'recovered-data'};
    }
    return {ok:false,lastData,errorData};
  }

  async function freshQueuedCall(base,apiName,data,signal){
    const submit=await nativeFetch(`${base}/gradio_api/call/${apiName}`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({data:Array.isArray(data)?data:[data]}),
      signal
    });
    if(!submit.ok){
      const body=await submit.text().catch(()=>"");
      throw new Error(`queue retry submit HTTP ${submit.status}${body?`：${body.slice(0,240)}`:''}`);
    }
    const sj=await submit.json();
    if(!sj.event_id)throw new Error('queue retry 沒有 event_id');
    const result=await nativeFetch(`${base}/gradio_api/call/${apiName}/${sj.event_id}`,{signal});
    if(!result.ok){
      const body=await result.text().catch(()=>"");
      throw new Error(`queue retry result HTTP ${result.status}${body?`：${body.slice(0,240)}`:''}`);
    }
    const text=await result.text();
    const parsed=parseSse(text);
    if(!parsed.ok){
      const detail=parsed.errorData||parsed.lastData||text.slice(-500);
      throw new Error(`queue retry 未取得完成結果${detail?`：${typeof detail==='string'?detail:JSON.stringify(detail).slice(0,300)}`:''}`);
    }
    return {response:result,output:parsed.payload};
  }

  window.fetch=async function(input,init){
    const url=urlOf(input);
    const method=String(init?.method||((input&&input.method)||'GET')).toUpperCase();

    const submitMatch=url.match(/^(https:\/\/[^/]+)\/gradio_api\/call\/([^/?#]+)$/i);
    if(submitMatch&&method==='POST'){
      try{
        const body=typeof init?.body==='string'?JSON.parse(init.body):null;
        if(body&&Array.isArray(body.data))pending.set(submitMatch[2],{base:submitMatch[1],data:body.data,at:Date.now()});
      }catch{}
      let r=await nativeFetch(input,init);
      if(!r.ok&&[429,502,503,504].includes(r.status)){
        await sleep(1200);
        r=await nativeFetch(input,init);
      }
      return r;
    }

    const resultMatch=url.match(/^(https:\/\/[^/]+)\/gradio_api\/call\/([^/?#]+)\/([^/?#]+)$/i);
    if(resultMatch&&method==='GET'){
      const apiName=resultMatch[2];
      const original=await nativeFetch(input,init);
      if(!original.ok)return original;

      const text=await original.clone().text();
      const parsed=parseSse(text);
      if(parsed.ok)return canonicalComplete(parsed.payload,original);

      const saved=pending.get(apiName);
      if(saved&&Date.now()-saved.at<10*60*1000){
        let lastErr=null;
        for(let attempt=1;attempt<=2;attempt++){
          try{
            await sleep(700*attempt);
            const retry=await freshQueuedCall(saved.base,apiName,saved.data,init?.signal);
            return canonicalComplete(retry.output,retry.response);
          }catch(e){
            lastErr=e;
            console.warn(`[TaxAI V1.4.7] ZeroGPU queue retry ${attempt} failed`,apiName,e);
          }
        }
        console.warn('[TaxAI V1.4.7] ZeroGPU queue retries exhausted',apiName,lastErr,parsed.errorData||parsed.lastData||text.slice(-800));
      }
      return new Response(text,{status:original.status,statusText:original.statusText,headers:original.headers});
    }

    return nativeFetch(input,init);
  };

  console.info('[TaxAI] Gradio Resilient Adapter V1.4.7 active');
})();
