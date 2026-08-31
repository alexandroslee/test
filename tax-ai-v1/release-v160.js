(function(){
  if(window.__taxAiRelease160)return;
  window.__taxAiRelease160=true;
  const $=id=>document.getElementById(id);
  const SLOT='https://alexandroslee-tax-ai-zerogpu-v152.hf.space';
  const VERSION='V1.6.0';
  function apply(){
    document.title='AI 超簡易營業稅申報 V1.6.0｜NVIDIA Nemotron Parse 2.0';
    const sub=document.querySelector('.top .muted');
    if(sub)sub.textContent='V1.6.0｜NVIDIA Nemotron Parse 2.0｜文件解析＋8 格買受人統編＋空間規則＋媒體申報';
    const hero=document.querySelector('.hero');
    if(hero)hero.innerHTML='<b>V1.6.0 NVIDIA Document AI：</b>Nemotron Parse 2.0 先解析文字、版面與座標；Tax AI 再依空間位置、8 格買受人統編重組、統編檢查、金額等式與 5% 稅率完成對賬。';
    const tag=document.querySelector('.top .tag');
    if(tag)tag.textContent='V1.6.0｜穩定版';
    const old=$('hfZeroGpuCard');if(old)old.style.display='none';
    const input=$('nemotron160Url');if(input&&/tax-ai-nemotron-v160/.test(input.value))input.value=SLOT;
    const scan=$('scan');if(scan)scan.textContent='✨ 開始辨識發票';
    const mediaTitle=$('v156Media')?.querySelector('h2');if(mediaTitle)mediaTitle.textContent='💾 5. 營業稅媒體申報資料建立';
  }
  apply();
  window.__taxAiRelease160Api={apply,SLOT,VERSION};
})();