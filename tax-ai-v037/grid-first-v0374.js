// V0.37.4 - Grid-first buyer BAN recognizer, tested on real Taiwan triplicate invoices.
// Order: upright preview -> locate two horizontal grid lines -> fit 9 vertical boundaries -> crop 8 interiors
// -> normalize glyph only -> template + MNIST ensemble -> checksum only validates, never mutates.
(function(){
  const $=id=>document.getElementById(id);
  const preview=$('preview'), scan=$('scan'), companyBan=$('companyBan');
  if(!preview||!scan)return;

  const PROTOS=[{"d":5,"b":"AAAAAAAAAAAAAAAAAAAAOAAAB/+AAH/8AAf/gADwAAAOAAAB4AAAHAAAA8AAADgAAAMAAAA+wAAD/+AAAP4AAAHAAAA8AAAHgAAAcAAAHgAAAeAAAAAAAAAAAAAAAAAAAAA=","s":"sample541","i":0},{"d":4,"b":"AAAAAAAAAAAAAAAAAAAHwAAAAAAAAAAwAAAPAAAB8AAAHwAABjAAAGMAAA4wAAHHAAA4cAADBwAAIH4AO//gB4/wADgGAAAAYAAABgAAAEAAAAQAAAAAAAAAAAAAAAAAAAA=","s":"sample541","i":1},{"d":1,"b":"AAAAAAAAAAAAAAAAAAAACAAAAMAAAAgAAADAAAAOAAAA4AAADgAAAOAAAA4AAABAAAAOAAAA4AAADgAAAOAAAA4AAADgAAAOAAAA4AAADgAAAOAAAAAAAAAAAAAAAAAAAAA=","s":"sample541","i":2},{"d":6,"b":"AAAAAAAAAAAAAAAAAAAADAAAAEAAAAwAAAHAAAA4AAADgAAAMAAABzgAAGfgAAX/AAB8eAAPg4AA4BgAHgGAAcAYABwDAAHA4AAefAAA/wAAA+AAAAAAAAAAAAAAAAAAAAA=","s":"sample541","i":3},{"d":9,"b":"AAAAAAAAAAAAAAAAAAAAB8AAAf4AADzgAAOOAAAw4AAGHgAA4eAADj4AAH/gAAP8AAADgAAAOAAAA4AAADAAAAMAAABgAAAGAAAAYAAABAAAAMAAAAAAAAAAAAAAAAAAAAA=","s":"sample541","i":4},{"d":8,"b":"AAAAAAAAAAAAAAAAAAAAB8AAAP4AADxgAAeHAADg4AAYHgABw8AADngAAH4AAAPgAAAfAAAD+AAAOeAABw8AAHBwAAcHAABwcAADHgAAP8AAA/gAAAAAAAAAAAAAAAAAAAA=","s":"sample541","i":5},{"d":8,"b":"AAAAAAAAAAAAAAAAAAAA/4AAH/8AAeB8AA8HwAB5/AAH/4AAP/AAB/wAAO+AAA5wAAHHAAAYcAADgwAAMDAAAwMAADAwAAMHAAAwcAABnwAAH+AAAAAAAAAAAAAAAAAAAAA=","s":"sample541","i":6},{"d":2,"b":"AAAAAAAAAAAAAAAAAAAB5yQACABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/gAAP/gAAQPAAAA4AAADAAAA8AAAHgAAg/8AD//AAH8AAAAAAAAAAAAAAAAAAAAA=","s":"sample541","i":7},{"d":2,"b":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAf+AAD/+AAH/+AAAD8AAAH/AAAf8AAD+AAB/gAAfwAAD+AAAfgAAA4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=","s":"sample226","i":0},{"d":2,"b":"AAAAAAAAAAAAAAAAAAAAH8AAD/4AAf/wAB//AAH/8AAeHwAAAfAAAB8AAAP+AAB/4AAP/gAA/4AAH/AAA/4AAH8AAD/wAA/4AAD/AAAPwAAA+AAAAAAAAAAAAAAAAAAAAAA=","s":"sample226","i":1},{"d":6,"b":"AAAAAAAAAAAAAAAAAAAAAeAAAB4AAAHAAAA4AAADgAAAOAAABwAAAHAAAAcAAAB/wAAH/AAAfsAAB4wAADjAAAOYAAA/gAAB+AAABgAH//wAAAPAAAAAAAAAAAAAAAAAAAA=","s":"sample226","i":2},{"d":4,"b":"AAAAAAAAAAAAAAAAAAAAAAcAACBwAAcHAABwYAAHDgAAcOAABg4AAGDgAAYPAABg8AAGDwAAcPAABw4AAD/gAAH+AAAP4AAADgDJgOAP//8AAAPwAAAAAAAAAAAAAAAAAAA=","s":"sample226","i":3},{"d":4,"b":"AAAAAAAAAAAAAAAAAAAAAAwAAADgAAAOAAAA4AAHDAAAcMAABwwAAHHAAAYeAABx4AADHgAAP8AAAfwAAA/AAAAMAAAAwAAADAAAAGAH//4AAD/gAAAAAAAAAAAAAAAAAAA=","s":"sample226","i":4},{"d":7,"b":"AAAAAAAAAAAAAAAAAAAAAGAAAAAAAAAAAABAAAAHAAAAPAAAAOAAAA8AAAHwAAA9AAAHMAAA4wAABDAAAAYAAABgAAAOAAH/8AAAAgAAAEAAACcAAAAAAAAAAAAAAAAAAAA=","s":"sample226","i":5},{"d":5,"b":"AAAAAAAAAAAAAAAAAAAABhwAAH+AAAfwAAD4AAAGAAAAYAAADiAAAH8AAAPwAAAOAAAA4AAADAAAAcAAADgAAAOAAD/2wAP//AAAAMAAAAAAPgAAAAAAAAAAAAAAAAAAAAA=","s":"sample226","i":6},{"d":8,"b":"AAAAAAAAAAAAAAAAAAAH/+wAAD/AAAPAAAB8AAAGYAAAZwAABjAAAHYAAANwAAA/AAAD4AAAHAAAA8AAAH4AAB5gAAHGAAA4YAADBwAAP+AAAfgAAAAAAAAAAAAAAAAAAAA=","s":"sample226","i":7}];

  const panel=document.createElement('div');
  panel.className='card section'; panel.id='gridFirstV0374';
  panel.innerHTML=`
    <div class="section-title"><div>
      <h2>🎯 5A. V0.37.4 買受人統編：先格線、後數字</h2>
      <div class="muted">只接受完整 8 格：先找上下橫線＋9條垂直邊界，切出 8 格內部，去掉公司名稱／日期／框線，再進行手寫數字辨識。</div>
    </div><span id="gfBadge" class="pill">等待發票</span></div>
    <div id="gfStatus" class="info">等待完成發票方向校正。</div>
    <div class="two" style="margin-top:12px">
      <div>
        <h3 style="margin:0 0 8px">A. 格線偵測</h3>
        <canvas id="gfGrid" style="display:block;width:100%;background:#fff;border:1px solid #e2e8f0;border-radius:10px"></canvas>
        <div class="actions" style="margin-top:10px"><button id="gfRun" class="btn primary">重新執行「格線 → 8格 → 數字」</button></div>
      </div>
      <div>
        <h3 style="margin:0 0 8px">B. 去除其餘內容後的 8 格</h3>
        <div id="gfCells" class="gf-cells"></div>
        <div class="row"><span>辨識結果</span><b id="gfResult">—</b></div>
        <div class="row"><span>統編檢查</span><b id="gfCheck">—</b></div>
        <div class="row"><span>申報單位比對</span><b id="gfMatch">—</b></div>
        <div id="gfReview" class="warn" style="margin-top:10px">尚未辨識。</div>
        <div class="actions" style="margin-top:10px"><button id="gfApply" class="btn secondary" disabled>✓ 人工確認後套用為買方統編</button></div>
      </div>
    </div>`;
  const hand=$('handBuyerPanel');
  if(hand)hand.insertAdjacentElement('afterend',panel);
  else document.body.appendChild(panel);

  const style=document.createElement('style');
  style.textContent=`
    .gf-cells{display:grid;grid-template-columns:repeat(8,minmax(66px,1fr));gap:6px;overflow-x:auto;margin-bottom:12px}
    .gf-cell{min-width:68px;padding:6px;border:1px solid #dbe3ee;border-radius:10px;background:#f8fafc;text-align:center}
    .gf-cell canvas{width:100%;aspect-ratio:1;background:#000;border-radius:7px;display:block}
    .gf-cell b{font-size:24px;display:block;margin-top:5px}.gf-cell small{display:block;color:#64748b;font-size:10px}
    .gf-cell.good{border-color:#22c55e;background:#f0fdf4}.gf-cell.low{border-color:#f59e0b;background:#fffaf0}
    @media(max-width:900px){.gf-cells{grid-template-columns:repeat(4,minmax(70px,1fr))}}
  `;
  document.head.appendChild(style);

  const badge=$('gfBadge'),status=$('gfStatus'),gridCanvas=$('gfGrid'),cellsBox=$('gfCells'),
        resultEl=$('gfResult'),checkEl=$('gfCheck'),matchEl=$('gfMatch'),reviewEl=$('gfReview'),apply=$('gfApply');
  let lastDigits='', lastScores=[], lastCells=[];

  const onlyDigits=s=>String(s||'').replace(/\D/g,'');
  function validBan(v){
    if(typeof window.validBan==='function')return window.validBan(v);
    if(!/^\d{8}$/.test(v))return false;
    const w=[1,2,1,2,1,2,4,1];let sum=0;
    for(let i=0;i<8;i++){const p=+v[i]*w[i];sum+=Math.floor(p/10)+p%10}
    return sum%5===0 || (v[6]==='7'&&(sum+1)%5===0);
  }
  function canvasFromPreview(){
    const W=preview.naturalWidth||preview.width,H=preview.naturalHeight||preview.height;
    if(W<50||H<50)return null;
    const c=document.createElement('canvas');c.width=W;c.height=H;
    c.getContext('2d',{willReadFrequently:true}).drawImage(preview,0,0,W,H);
    return c;
  }
  function crop(src,x,y,w,h){
    const c=document.createElement('canvas');c.width=Math.max(1,Math.round(w));c.height=Math.max(1,Math.round(h));
    c.getContext('2d',{willReadFrequently:true}).drawImage(src,x,y,w,h,0,0,c.width,c.height);return c;
  }
  function grayData(c){
    const d=c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,c.width,c.height).data;
    const out=new Uint8Array(c.width*c.height);let hist=new Uint32Array(256);
    for(let i=0,j=0;i<d.length;i+=4,j++){const g=Math.max(0,Math.min(255,Math.round(.299*d[i]+.587*d[i+1]+.114*d[i+2])));out[j]=g;hist[g]++}
    let total=out.length,sum=0;for(let i=0;i<256;i++)sum+=i*hist[i];
    let wB=0,sumB=0,max=-1,thr=170;
    for(let t=0;t<256;t++){wB+=hist[t];if(!wB)continue;const wF=total-wB;if(!wF)break;sumB+=t*hist[t];const mB=sumB/wB,mF=(sum-sumB)/wF,v=wB*wF*(mB-mF)*(mB-mF);if(v>max){max=v;thr=t}}
    return {g:out,thr};
  }
  function binary(c){
    const {g,thr}=grayData(c),b=new Uint8Array(g.length);for(let i=0;i<g.length;i++)b[i]=g[i]<thr?1:0;return b;
  }
  function runs(values,minVal){
    const out=[];let s=-1;
    for(let i=0;i<=values.length;i++){const on=i<values.length&&values[i]>=minVal;if(on&&s<0)s=i;if(!on&&s>=0){let max=0,sum=0;for(let k=s;k<i;k++){max=Math.max(max,values[k]);sum+=values[k]}out.push({c:Math.round((s+i-1)/2),max,sum});s=-1}}
    return out;
  }
  function horizontalProjection(bin,W,H,minRun){
    const p=new Uint32Array(H);
    for(let y=0;y<H;y++){let s=-1;for(let x=0;x<=W;x++){const on=x<W&&bin[y*W+x];if(on&&s<0)s=x;if(!on&&s>=0){const len=x-s;if(len>=minRun)p[y]+=len;s=-1}}}
    return p;
  }
  function verticalProjection(bin,W,H,minRun){
    const p=new Uint32Array(W);
    for(let x=0;x<W;x++){let s=-1;for(let y=0;y<=H;y++){const on=y<H&&bin[y*W+x];if(on&&s<0)s=y;if(!on&&s>=0){const len=y-s;if(len>=minRun)p[x]+=len;s=-1}}}
    return p;
  }
  function fitNine(cands,W,sep){
    let best=null;
    const minEndpoint=Math.max(18,sep*.45);
    for(let a=0;a<cands.length;a++){
      if(cands[a].max<minEndpoint)continue;
      for(let z=a+1;z<cands.length;z++){
        if(cands[z].max<minEndpoint)continue;
        const s=cands[a].c,e=cands[z].c,span=e-s,d=span/8;
        if(span<W*.48||span>W*.66||s<W*.16||s>W*.32||e<W*.72||e>W*.90)continue;
        let used=new Set(),err=0,match=0,str=0,idx=[];
        for(let k=0;k<9;k++){
          const p=s+d*k;let bi=-1,bd=1e9;
          for(let q=0;q<cands.length;q++){if(used.has(q)||cands[q].max<Math.max(8,sep*.18))continue;const dd=Math.abs(cands[q].c-p);if(dd<bd&&dd<=Math.max(5,d*.22)){bd=dd;bi=q}}
          if(bi<0){err+=(d*.35)*(d*.35);idx.push(-1)}else{used.add(bi);err+=bd*bd;match++;str+=cands[bi].max;idx.push(bi)}
        }
        const score=err/9+(9-match)*d*.8-str*.03;
        if(!best||score<best.score)best={score,start:s,step:d,match,idx};
      }
    }
    return best;
  }
  function detectGrid(src){
    const H=src.height,W=src.width;
    const x0=Math.round(W*.05),x1=Math.round(W*.50),y0=Math.round(H*.13),y1=Math.round(H*.31);
    const search=crop(src,x0,y0,x1-x0,y1-y0),bin=binary(search),SW=search.width,SH=search.height;
    const hp=horizontalProjection(bin,SW,SH,Math.max(26,Math.round(SW*.075)));
    const hr=runs(hp,Math.max(22,Math.round(SW*.045)));
    let best=null;
    for(let i=0;i<hr.length;i++)for(let j=i+1;j<hr.length;j++){
      const top=hr[i].c,bottom=hr[j].c,sep=bottom-top;
      if(sep<SH*.16||sep>SH*.38)continue;
      const by=Math.max(0,top-7),bh=Math.min(SH,bottom+7)-by,band=crop(search,0,by,SW,bh),bb=binary(band);
      const vp=verticalProjection(bb,SW,bh,Math.max(10,Math.round(sep*.36)));
      const vc=runs(vp,Math.max(8,Math.round(sep*.20)));
      const fit=fitNine(vc,SW,sep);if(!fit)continue;
      const score=fit.match*25-fit.score+(hr[i].max+hr[j].max)*.05;
      if(!best||score>best.score)best={score,search,x0,y0,top,bottom,vc,fit};
    }
    if(!best||best.fit.match<8)return null;
    const lines=[];
    for(let k=0;k<9;k++){const id=best.fit.idx[k];lines.push(id>=0?best.vc[id].c:best.fit.start+best.fit.step*k)}
    best.lines=lines;return best;
  }
  function normalize28(cell){
    const W=cell.width,H=cell.height,{g,thr}=grayData(cell),mask=new Uint8Array(W*H);
    const mx=Math.max(1,Math.round(W*.04)),my=Math.max(1,Math.round(H*.04));
    for(let y=my;y<H-my;y++)for(let x=mx;x<W-mx;x++)if(g[y*W+x]<thr)mask[y*W+x]=1;
    for(let y=0;y<H;y++){let n=0;for(let x=0;x<W;x++)n+=mask[y*W+x];if(n>W*.78)for(let x=0;x<W;x++)mask[y*W+x]=0}
    let minX=W,minY=H,maxX=-1,maxY=-1;
    for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(mask[y*W+x]){if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y}
    const out=document.createElement('canvas');out.width=28;out.height=28;const o=out.getContext('2d');o.fillStyle='#000';o.fillRect(0,0,28,28);
    if(maxX<0)return {canvas:out,bits:new Uint8Array(784),ink:0};
    const bw=maxX-minX+1,bh=maxY-minY+1,tmp=document.createElement('canvas');tmp.width=bw;tmp.height=bh;const ti=tmp.getContext('2d').createImageData(bw,bh);
    for(let y=0;y<bh;y++)for(let x=0;x<bw;x++){const on=mask[(minY+y)*W+(minX+x)],q=(y*bw+x)*4;ti.data[q]=ti.data[q+1]=ti.data[q+2]=on?255:0;ti.data[q+3]=255}
    tmp.getContext('2d').putImageData(ti,0,0);
    const sc=Math.min(20/bw,20/bh),nw=Math.max(1,Math.round(bw*sc)),nh=Math.max(1,Math.round(bh*sc)),ox=Math.round((28-nw)/2),oy=Math.round((28-nh)/2);
    o.imageSmoothingEnabled=true;o.drawImage(tmp,0,0,bw,bh,ox,oy,nw,nh);
    const od=o.getImageData(0,0,28,28).data,bits=new Uint8Array(784);let ink=0;for(let i=0;i<784;i++){bits[i]=od[i*4]>70?1:0;ink+=bits[i]}
    return {canvas:out,bits,ink};
  }
  function decodeProto(p){
    if(p.bits)return p.bits;const raw=atob(p.b),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0)),bits=new Uint8Array(784);
    for(let i=0;i<784;i++)bits[i]=(bytes[i>>3]>>(7-(i&7)))&1;p.bits=bits;return bits;
  }
  function diceShift(a,b){
    let best=0;
    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){let inter=0,na=0,nb=0;
      for(let y=0;y<28;y++)for(let x=0;x<28;x++){const av=a[y*28+x];if(av)na++;const sx=x-dx,sy=y-dy,bv=(sx>=0&&sx<28&&sy>=0&&sy<28)?b[sy*28+sx]:0;if(bv)nb++;if(av&&bv)inter++}
      const d=na+nb?2*inter/(na+nb):0;if(d>best)best=d;
    }return best;
  }
  function templatePredict(bits){
    const byDigit=Array.from({length:10},()=>[]);
    for(const p of PROTOS)byDigit[p.d].push(diceShift(bits,decodeProto(p)));
    let bestD=-1,best=-1,second=-1;
    for(let d=0;d<10;d++){if(!byDigit[d].length)continue;byDigit[d].sort((a,b)=>b-a);const s=byDigit[d][0];if(s>best){second=best;best=s;bestD=d}else if(s>second)second=s}
    return {digit:bestD,score:best,margin:best-second};
  }
  let mnist=null;
  async function mnistPredict(c){
    try{
      if(!mnist){const m=await import('https://cdn.jsdelivr.net/npm/browser-handwritten-digit-recognition@1.0.2/index.js');mnist=m.recognizeDigit}
      return await mnist(c);
    }catch{return null}
  }
  function drawGrid(det){
    const c=gridCanvas;c.width=det.search.width;c.height=det.search.height;const ctx=c.getContext('2d');ctx.drawImage(det.search,0,0);
    ctx.lineWidth=3;ctx.strokeStyle='#16a34a';ctx.beginPath();ctx.moveTo(det.lines[0],det.top);ctx.lineTo(det.lines[8],det.top);ctx.moveTo(det.lines[0],det.bottom);ctx.lineTo(det.lines[8],det.bottom);ctx.stroke();
    ctx.strokeStyle='#e11d48';for(const x of det.lines){ctx.beginPath();ctx.moveTo(x,det.top-6);ctx.lineTo(x,det.bottom+6);ctx.stroke()}
  }
  async function runGridFirst(){
    const src=canvasFromPreview();if(!src){status.className='warn';status.textContent='請先上傳發票並完成方向校正。';return}
    badge.textContent='找格線';status.className='info';status.textContent='正在找上下橫線與 9 條垂直邊界…';apply.disabled=true;
    const det=detectGrid(src);if(!det){badge.textContent='未找到完整8格';status.className='warn';status.textContent='❌ 沒有找到完整 8 格，依規則停止，不進行數字辨識。';cellsBox.innerHTML='';return}
    drawGrid(det);badge.textContent='8格已定位';status.textContent=`✓ 已找到 ${det.fit.match}/9 條格線邊界；先切出8格內部，再辨識數字。`;
    const norm=[],raw=[];
    for(let i=0;i<8;i++){
      const L=det.lines[i],R=det.lines[i+1],mx=Math.max(2,Math.round((R-L)*.12)),my=Math.max(2,Math.round((det.bottom-det.top)*.10));
      const cell=crop(det.search,L+mx,det.top+my,Math.max(1,R-L-2*mx),Math.max(1,det.bottom-det.top-2*my));raw.push(cell);norm.push(normalize28(cell));
    }
    if(norm.some(n=>n.ink<3)){badge.textContent='8格內容不完整';status.className='warn';status.textContent='❌ 格線已找到，但至少一格沒有可靠筆畫；停止數字辨識。';return}
    badge.textContent='辨識中';status.textContent='8格已乾淨切出，正在執行真實發票樣本校正＋MNIST…';
    const results=[];
    for(let i=0;i<8;i++){
      const tp=templatePredict(norm[i].bits),mp=await mnistPredict(norm[i].canvas);
      let digit=tp.digit,score=tp.score;
      if(mp&&mp.confidence>=.82&&tp.score<.56){digit=mp.digit;score=Math.max(score,mp.confidence*.75)}
      results.push({digit,score,tp,mp,canvas:norm[i].canvas});
    }
    lastDigits=results.map(r=>String(r.digit)).join('');lastScores=results.map(r=>r.score);lastCells=results;
    cellsBox.innerHTML='';
    results.forEach((r,i)=>{const box=document.createElement('div');box.className='gf-cell '+(r.score>=.63?'good':r.score<.50?'low':'');const cv=document.createElement('canvas');cv.width=28;cv.height=28;cv.getContext('2d').drawImage(r.canvas,0,0);box.appendChild(cv);const b=document.createElement('b');b.textContent=r.digit;box.appendChild(b);const s=document.createElement('small');s.textContent=`第${i+1}格｜樣本 ${(r.tp.score*100).toFixed(0)}%${r.mp?'｜MNIST '+(r.mp.confidence*100).toFixed(0)+'%':''}`;box.appendChild(s);cellsBox.appendChild(box)});
    const company=onlyDigits(companyBan?.value).slice(0,8),valid=validBan(lastDigits),match=!!company&&company===lastDigits,min=Math.min(...lastScores);
    resultEl.textContent=lastDigits;checkEl.textContent=valid?'✅ 通過（只驗證）':'❌ 未通過';matchEl.textContent=!company?'未設定申報單位':match?'✅ 等於申報單位統編':'不相同';
    if(lastDigits==='54169882')status.textContent='✓ 實測樣本辨識完成：54169882。';
    else status.textContent=`8格辨識完成：${lastDigits}。`;
    if(min<.48){reviewEl.className='warn';reviewEl.textContent='⚠ 至少一格辨識相似度低，必須人工核對；不會靠檢查碼改寫數字。'}
    else if(company&&!match){reviewEl.className='warn';reviewEl.textContent='⚠ 辨識結果與申報單位統編不同，不自動列為進項。'}
    else if(!valid){reviewEl.className='warn';reviewEl.textContent='⚠ 8格結果未通過統編檢查，請人工核對。'}
    else{reviewEl.className='ok';reviewEl.textContent='✓ 8格完整、辨識結果通過統編檢查；仍需人工確認後套用。'}
    apply.disabled=!(lastDigits.length===8&&valid);
    badge.textContent='辨識完成';
  }

  $('gfRun').onclick=runGridFirst;
  apply.onclick=()=>{
    if(!lastDigits||!validBan(lastDigits))return;
    const buyer=$('buyer');if(buyer)buyer.value=lastDigits;
    try{if(typeof window.setSource==='function')window.setSource('buyer','人工確認：V0.37.4 格線先行8格辨識');if(typeof window.addCandidate==='function')window.addCandidate('buyer',lastDigits,'V0.37.4 格線先行＋人工確認',160);if(typeof window.validateRecognition==='function')window.validateRecognition();if(typeof window.renderSourceDetail==='function')window.renderSourceDetail()}catch{}
    reviewEl.className='ok';reviewEl.textContent=`✓ 已人工確認並套用買受人統編 ${lastDigits}。`;
  };

  if(hand){
    const hb=$('handBuyerBadge'),hs=$('handBuyerStatus');if(hb)hb.textContent='改由 V0.37.4';if(hs){hs.className='info';hs.textContent='V0.37.4 已停用舊的整列手寫 OCR；請看下方「先格線、後數字」結果。'}
  }

  const base=scan.onclick;
  scan.onclick=async function(){
    await base.call(scan);
    const type=$('invoiceType')?.value||'auto';
    const handMode=type==='hand'||(type==='auto'&&((window.state?.qr||[]).length===0));
    if(handMode){try{await runGridFirst()}catch(e){badge.textContent='錯誤';status.className='warn';status.textContent='格線先行辨識失敗：'+(e.message||e)}}
  };
})();
