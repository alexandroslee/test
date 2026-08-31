(function(){
  if(window.__taxAiVersionLock160)return;
  window.__taxAiVersionLock160=true;
  const STABLE={
    title:'AI 超簡易營業稅申報 V1.6.0｜NVIDIA Nemotron Parse 2.0',
    sub:'V1.6.0｜NVIDIA Nemotron Parse 2.0｜文件解析＋8 格買受人統編＋空間規則＋媒體申報',
    tag:'V1.6.0｜穩定版',
    scan:'✨ 開始辨識發票',
    hero:'<b>V1.6.0 NVIDIA Document AI：</b>Nemotron Parse 2.0 先解析文字、版面與座標；Tax AI 再依空間位置、8 格買受人統編重組、統編檢查、金額等式與 5% 稅率完成對賬。'
  };
  let applying=false;
  function setText(el,value){if(el&&el.textContent!==value)el.textContent=value;}
  function apply(){
    if(applying)return;applying=true;
    try{
      if(document.title!==STABLE.title)document.title=STABLE.title;
      setText(document.querySelector('.top .muted'),STABLE.sub);
      setText(document.querySelector('.top .tag'),STABLE.tag);
      setText(document.getElementById('scan'),STABLE.scan);
      const hero=document.querySelector('.hero');if(hero&&hero.innerHTML!==STABLE.hero)hero.innerHTML=STABLE.hero;
    }finally{applying=false;}
  }
  apply();
  const targets=[document.querySelector('title'),document.querySelector('.top .muted'),document.querySelector('.top .tag'),document.getElementById('scan'),document.querySelector('.hero')].filter(Boolean);
  const mo=new MutationObserver(()=>queueMicrotask(apply));
  for(const t of targets)mo.observe(t,{childList:true,characterData:true,subtree:true});
  window.__taxAiVersionLock160Api={apply,STABLE,observer:mo};
})();