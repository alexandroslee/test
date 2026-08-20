const CORS={
  'Access-Control-Allow-Origin':'https://alexandroslee.github.io',
  'Access-Control-Allow-Methods':'GET,OPTIONS',
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
    try{
      const base=upstream(req);
      const r=await fetch(base+'/health/vlm',{signal:AbortSignal.timeout(110000)});
      const text=await r.text();
      const headers={...CORS,'Content-Type':r.headers.get('content-type')||'application/json'};
      return new Response(text,{status:r.status,headers});
    }catch(e){
      return Response.json({status:'down',detail:String(e?.message||e)},{status:503,headers:CORS});
    }
  }
};
