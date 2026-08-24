(function(){
  const SPACE='https://alexandroslee-tax-ai-zerogpu-v152.hf.space';
  const REPO='https://huggingface.co/spaces/AlexandrosLee/tax-ai-zerogpu-v152';
  function apply(){
    const input=document.getElementById('hfSpaceUrl');
    if(input) input.value=SPACE;
    const card=document.getElementById('hfZeroGpuCard');
    if(card){
      const link=[...card.querySelectorAll('a')].find(a=>/Hugging Face Space/.test(a.textContent||''));
      if(link) link.href=REPO;
    }
    window.__taxAiV152Space={space:SPACE,repo:REPO};
  }
  apply();
  setTimeout(apply,50);
  setTimeout(apply,500);
  console.info('[TaxAI] V1.5.2 Space target fixed',SPACE);
})();
