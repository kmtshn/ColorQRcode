// Independent inverse projective renderer. Seeded noise makes both runs identical.
window.fixture = function(text, condition, seed=123) {
  const grid = encodeToGrid(text, {legacy:window.fixtureLegacy!==false}), size=400, canvas=document.createElement('canvas');
  canvas.width=canvas.height=size;
  Object.defineProperties(canvas,{videoWidth:{value:size},videoHeight:{value:size}});
  const ctx=canvas.getContext('2d'), im=ctx.createImageData(size,size);
  let a=0, scale=1, tx=0,ty=0,p=0,q=0;
  let rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  if(condition.startsWith('rotate')) a=Number(condition.slice(6))*Math.PI/180;
  if(condition==='left') tx=-26;
  if(condition==='right') tx=26;
  if(condition==='up') ty=-26;
  if(condition==='down') ty=26;
  if(condition==='small') scale=.8;
  if(condition==='large') scale=1.2;
  if(condition==='perspective') {p=.18;q=-.12;a=.08;}
  if(condition==='held-perspective') {p=-.14;q=.19;a=-.11;}
  if(condition==='held-combined') {a=.19;scale=.91;tx=13;ty=-17;p=.07;}
  if(condition.startsWith('sealed-')) {a=(rand()-.5)*.65;scale=.8+rand()*.35;tx=(rand()-.5)*44;ty=(rand()-.5)*44;p=(rand()-.5)*.3;q=(rand()-.5)*.3;}
  const c=Math.cos(a),s=Math.sin(a), side=240*scale;
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const dx=(x-200-tx)/side,dy=(y-200-ty)/side;
    const u=c*dx+s*dy,v=-s*dx+c*dy,den=1-p*u-q*v;
    const gx=u/den+.5,gy=v/den+.5;
    let rgb=[245,245,245];
    if(gx>=0&&gx<1&&gy>=0&&gy<1) rgb=COLORS[grid[Math.floor(gy*16)][Math.floor(gx*16)]].rgb;
    // Match the generator's outer black border, including the white finder edge.
    if(gx>=-.004&&gx<=1.004&&gy>=-.004&&gy<=1.004&&(gx<0||gx>1||gy<0||gy>1)) rgb=[0,0,0];
    rgb=rgb.slice();
    if(condition==='dark') rgb=rgb.map(v=>v*.3+8);
    if(condition==='very-dark') rgb=rgb.map(v=>v*.07+8);
    if(condition==='cast') rgb=rgb.map((v,i)=>v*[.72,1,.84][i]+[20,4,12][i]);
    if(condition==='saturation') {const m=rgb.reduce((a,b)=>a+b)/3;rgb=rgb.map(v=>m+(v-m)*.48);}
    if(condition==='hue') {const [r,g,b]=rgb;rgb=[.9*r+.1*g,.9*g+.1*b,.9*b+.1*r];}
    if(condition==='noise'||condition==='held-combined') rgb=rgb.map(v=>v+(rand()-.5)*46);
    if(condition==='severe-noise') rgb=rgb.map(v=>v+(rand()-.5)*160);
    if(condition.startsWith('sealed-')) rgb=rgb.map((v,i)=>v*[.84,.92,.79][i]+[8,5,12][i]+(rand()-.5)*24);
    const i=(y*size+x)*4;
    im.data.set([...rgb.map(v=>Math.max(0,Math.min(255,v))),255],i);
  }
  ctx.putImageData(im,0,0);
  if(condition==='blur'||condition==='severe-blur') {const tmp=document.createElement('canvas');tmp.width=tmp.height=size;tmp.getContext('2d').drawImage(canvas,0,0);ctx.filter=condition==='blur'?'blur(1.6px)':'blur(5px)';ctx.drawImage(tmp,0,0);ctx.filter='none';}
  if(condition==='occlusion'||condition==='glare') {ctx.fillStyle='#fff';ctx.fillRect(130,100,70,condition==='glare'?110:35);}
  if(condition==='clutter') {ctx.fillStyle='#777';ctx.fillRect(0,0,90,280);ctx.fillStyle='#333';ctx.fillRect(300,310,100,90);}
  if(condition==='blank') {ctx.fillStyle='#eee';ctx.fillRect(0,0,size,size);}
  if(condition==='corrupt') {ctx.fillStyle='#2563eb';ctx.fillRect(175,80,30,15);}
  return canvas;
};
