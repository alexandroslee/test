const CORS={
  'Access-Control-Allow-Origin':'https://alexandroslee.github.io',
  'Access-Control-Allow-Methods':'POST,OPTIONS',
  'Access-Control-Allow-Headers':'Content-Type,X-Colab-Backend',
  'Vary':'Origin'
};
function upstream(req){
  const raw=req.headers.get('x-colab-backend')||'';
  const u=new URL(raw);
  if(u.protocol!=='https:' || !u.hostname.endsWith('.trycloudflare.com')) throw new Error('只允許 https://*.trycloudflare.com Colab Backend');
  return u.origin;
}
export default {
  async fetch(req){
    if(req.method==='OPTIONS') return new Response(null,{status:204,headers:CORS});
    if(req.method!=='POST') return Response.json({detail:'Method Not Allowed'},{status:405,headers:CORS});
    try{
      const base=upstream(req);
      const incoming=await req.formData();
      const out=new FormData();
      for(const [k,v] of incoming.entries()) out.append(k,v);
      const r=await fetch(base+'/v1/buyer-ban',{method:'POST',body:out,signal:AbortSignal.timeout(180000)});
      const text=await r.text();
      const headers={...CORS,'Content-Type':r.headers.get('content-type')||'application/json'};
      return new Response(text,{status:r.status,headers});
    }catch(e){
      return Response.json({detail:String(e?.message||e)},{status:502,headers:CORS});
    }
  }
};
