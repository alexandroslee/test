const CORS={
  'Access-Control-Allow-Origin':'https://alexandroslee.github.io',
  'Access-Control-Allow-Methods':'GET,OPTIONS',
  'Access-Control-Allow-Headers':'Content-Type,X-Colab-Backend',
  'Vary':'Origin'
};
export default {
  async fetch(req){
    if(req.method==='OPTIONS') return new Response(null,{status:204,headers:CORS});
    return Response.json({
      status:'ok',version:'1.2.0',backend:'vercel-free-https-proxy',
      vlm:'colab-gemma4-e4b',vercel_ai_gateway:false,openai_api:false,
      api_compat:'api-ocr-2025'
    },{headers:CORS});
  }
};
