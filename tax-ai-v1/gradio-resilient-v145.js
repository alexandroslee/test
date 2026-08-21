(function(){
  if(window.__taxAiGradioResilient146)return;
  window.__taxAiGradioResilient146=true;

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
    h.set('x-tax-ai-transport','gradio-resilient-v146');
    return h;
  }

  function canonicalComplete(output,resp){
    return new Response(`event: complete\ndata: ${JSON.stringify([output])}\n\n`,{
      status:200,
      headers:cloneHeaders(resp)
    });
  }

  function parseCompleteSse(text){
    const blocks=String(text||'').split(/\r?\n\r?\n+/);
    let lastData=null, errorData=null;
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
    return {ok:false,lastData,errorData};
  }

  async function directRun(base,apiName,data,signal){
    const payload=Array.isArray(data)?data:[data];
    const r=await nativeFetch(`${base}/gradio_api/run/${apiName}`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({data:payload}),
      signal
    });
    if(!r.ok){
      const body=await r.text().catch(()=>"");
      throw new Error(`direct run HTTP ${r.status}${body?`：${body.slice(0,300)}`:''}`);
    }
    const j=await r.json();
    let output;
    if(Object.prototype.hasOwnProperty.call(j,'output'))output=j.output;
    else if(Array.isArray(j.data)&&j.data.length)output=j.data[0];
    else throw new Error('direct run 沒有 output/data');
    return {response:r,output};
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
      const parsed=parseCompleteSse(text);
      if(parsed.ok)return canonicalComplete(parsed.payload,original);

      const saved=pending.get(apiName);
      if(saved&&Date.now()-saved.at<10*60*1000){
        try{
          const direct=await directRun(saved.base,apiName,saved.data,init?.signal);
          return canonicalComplete(direct.output,direct.response);
        }catch(e){
          console.warn('[TaxAI V1.4.6] Gradio fallback failed',apiName,e,parsed.errorData||parsed.lastData||text.slice(-800));
        }
      }
      return new Response(text,{status:original.status,statusText:original.statusText,headers:original.headers});
    }

    return nativeFetch(input,init);
  };

  console.info('[TaxAI] Gradio Resilient Adapter V1.4.6 active');
})();
