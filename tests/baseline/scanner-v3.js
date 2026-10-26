/* Browser-only legacy 16x16 scanner. No frame or payload leaves this device. */
(() => {
  'use strict';
  const work = document.createElement('canvas');
  const ctx = work.getContext('2d', {willReadFrequently:true});
  let previous = null;
  const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  function hull(points) {
    points.sort((a,b)=>a.x-b.x||a.y-b.y);
    const half=pts=>{const h=[];for(const p of pts){while(h.length>1&&cross(h[h.length-2],h[h.length-1],p)<=0)h.pop();h.push(p);}return h;};
    const lo=half(points),hi=half(points.slice().reverse());lo.pop();hi.pop();return lo.concat(hi);
  }
  function quadrilateral(points) {
    const h=hull(points);
    while(h.length>4){let best=Infinity,index=0;for(let i=0;i<h.length;i++){
      const area=Math.abs(cross(h[(i+h.length-1)%h.length],h[i],h[(i+1)%h.length]));
      if(area<best){best=area;index=i;}
    }h.splice(index,1);}
    return h.length===4?h:null;
  }
  // Map unit square to a detected convex quadrilateral (projective, not bilinear).
  function projector(c) {
    const [a,b,d,e]=c, dx=b.x-d.x,dy=b.y-d.y,ex=e.x-d.x,ey=e.y-d.y;
    const sx=a.x-b.x+d.x-e.x,sy=a.y-b.y+d.y-e.y,det=dx*ey-ex*dy;
    if(Math.abs(det)<1e-8)return null;
    const g=(sx*ey-ex*sy)/det,h=(dx*sy-sx*dy)/det;
    return (u,v)=>{const z=g*u+h*v+1;return {x:((b.x-a.x+g*b.x)*u+(e.x-a.x+h*e.x)*v+a.x)/z,y:((b.y-a.y+g*b.y)*u+(e.y-a.y+h*e.y)*v+a.y)/z};};
  }
  function detect(data,w,h) {
    const bg=[0,0,0];let n=0;
    for(let y=0;y<h;y+=8)for(const x of [0,w-1]){const i=(y*w+x)*4;for(let k=0;k<3;k++)bg[k]+=data[i+k];n++;}
    for(let k=0;k<3;k++)bg[k]/=n;
    const mask=new Uint8Array(w*h),queue=new Int32Array(w*h);
    const threshold=Math.max(18,Math.max(...bg)*.22);
    for(let i=0;i<mask.length;i++){
      const j=i*4;
      if(Math.max(Math.abs(data[j]-bg[0]),Math.abs(data[j+1]-bg[1]),Math.abs(data[j+2]-bg[2]))>threshold)mask[i]=1;
    }
    // Close subpixel breaks in the thin generated outline before components.
    const original=mask.slice();
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++)if(original[y*w+x]){
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)mask[(y+dy)*w+x+dx]=1;
    }
    const found=[];
    for(let start=0;start<mask.length;start++){
      if(!mask[start])continue;
      let head=0,tail=1;queue[0]=start;mask[start]=0;const boundary=[];
      let minX=w,maxX=0,minY=h,maxY=0;
      while(head<tail){const i=queue[head++],x=i%w,y=(i/w)|0;let edge=false;
        minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
        for(const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1],[x-1,y-1],[x+1,y-1],[x-1,y+1],[x+1,y+1]]){
          if(nx<0||ny<0||nx>=w||ny>=h){edge=true;continue;}
          const j=ny*w+nx;if(mask[j]){mask[j]=0;queue[tail++]=j;}else if(Math.max(Math.abs(data[j*4]-bg[0]),Math.abs(data[j*4+1]-bg[1]),Math.abs(data[j*4+2]-bg[2]))<=threshold)edge=true;
        }
        if(edge)boundary.push({x:x+.5,y:y+.5});
      }
      if(maxX-minX<40||maxY-minY<40||tail<100||boundary.length<4)continue;
      const corners=quadrilateral(boundary);
      if(corners){const area=Math.abs(corners.reduce((sum,p,i)=>sum+p.x*corners[(i+1)%4].y-p.y*corners[(i+1)%4].x,0))/2;
        if(area>w*h*.015&&area<w*h*.95)found.push({corners,area});}
    }
    return found.sort((a,b)=>b.area-a.area).slice(0,8).map(v=>v.corners);
  }
  function read(data,w,h,corners) {
    const project=projector(corners);if(!project)return null;
    const sample=(gx,gy)=>{
      const values=[[],[],[]];
      for(const dy of [-.17,0,.17])for(const dx of [-.17,0,.17]){
        const p=project((gx+.5+dx)/16,(gy+.5+dy)/16),x=Math.floor(p.x),y=Math.floor(p.y);
        if(x<0||y<0||x>=w||y>=h)return null;
        const i=(y*w+x)*4;for(let k=0;k<3;k++)values[k].push(data[i+k]);
      }
      return values.map(v=>v.sort((a,b)=>a-b)[4]);
    };
    const mean=pts=>{const samples=pts.map(p=>sample(...p));if(samples.some(v=>!v))return null;return [0,1,2].map(k=>samples.reduce((s,v)=>s+v[k],0)/samples.length);};
    const black=mean([[0,0],[1,0],[0,1],[1,1]]),white=mean([[14,0],[15,0],[14,1],[15,1]]);
    if(!black||!white||white.some((v,k)=>v-black[k]<25))return null;
    const normalize=rgb=>rgb.map((v,k)=>(v-black[k])/(white[k]-black[k]));
    const palette=COLORS.map(c=>c.rgb.map(v=>v/255));
    const red=mean([[0,14],[1,14],[0,15],[1,15]]),blue=mean([[14,14],[15,14],[14,15],[15,15]]);
    if(!red||!blue)return null;
    palette[2]=normalize(red);palette[5]=normalize(blue);
    const classify=rgb=>{const v=normalize(rgb);let best=Infinity,result=0;for(let i=0;i<6;i++){
      const distance=palette[i].reduce((s,p,k)=>s+(v[k]-p)**2,0);if(distance<best){best=distance;result=i;}
    }return result;};
    const grid=Array.from({length:16},()=>Array(16).fill(0));let score=0;
    // Reject most candidates using only the 16 finder cells.
    for(let y=0;y<16;y++)for(let x=0;x<16;x++)if(isFinder(x,y)){
      const rgb=sample(x,y);if(!rgb)return null;grid[y][x]=classify(rgb);if(grid[y][x]===finderValue(x,y))score++;
    }
    if(score<14)return {score,grid,reason:'finder'};
    for(let y=0;y<16;y++)for(let x=0;x<16;x++)if(!isFinder(x,y)){
      const rgb=sample(x,y);if(!rgb)return null;grid[y][x]=classify(rgb);
    }
    let text=null,reason=null;
    try{text=decodeGridToText(grid);}catch(e){reason=e.message;}
    const stream=[...cellIterator()].map(p=>grid[p.y][p.x]);
    const format=tripleToNum(stream.slice(0,3))>=64?'v2-crc32':'legacy-xor';
    return {grid,score,text,reason,format};
  }
  function scan(source,baseRect) {
    const start=performance.now(),vw=source.videoWidth||source.width,vh=source.videoHeight||source.height;
    if(!vw||!vh)return {score:0,reason:'empty-frame',ms:0};
    const scale=Math.min(1,640/Math.max(vw,vh)),w=Math.round(vw*scale),h=Math.round(vh*scale);
    if(work.width!==w||work.height!==h){work.width=w;work.height=h;}
    ctx.drawImage(source,0,0,w,h);const data=ctx.getImageData(0,0,w,h).data;
    let best={score:0,reason:'no-region'},candidates=0;
    const attempt=c=>{
      candidates++;const r=read(data,w,h,c);if(!r)return false;
      if(r.score>best.score||(r.text!==null&&r.text!==undefined)){
        const corners=c.map(p=>({x:p.x/scale,y:p.y/scale}));
        const xs=corners.map(p=>p.x),ys=corners.map(p=>p.y);
        best={...r,corners,rect:{x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)}};
      }
      if(r.text!==null&&r.text!==undefined){previous={corners:c,w,h};return true;}return false;
    };
    let success=false;
    if(previous?.w===w&&previous?.h===h)success=attempt(previous.corners);
    if(!success){previous=null;
      outer:for(const quad of detect(data,w,h))for(let rotation=0;rotation<4;rotation++){
        const c=quad.slice(rotation).concat(quad.slice(0,rotation));
        // Raster border and mild blur can move the contour by a pixel.
        for(const offset of [0,-.7,.7]){
          const center={x:c.reduce((s,p)=>s+p.x,0)/4,y:c.reduce((s,p)=>s+p.y,0)/4};
          const expanded=c.map(p=>{const d=Math.hypot(p.x-center.x,p.y-center.y);return {x:p.x+(p.x-center.x)*offset/d,y:p.y+(p.y-center.y)*offset/d};});
          if(attempt(expanded)){success=true;break outer;}
        }
      }
    }
    // Guide based fallback for legacy codes whose outline is not connected.
    if(!success&&baseRect){
      outer:for(const factor of [1,.9,1.1,.8,1.2])for(const dx of [0,-.06,.06,-.12,.12])for(const dy of [0,-.06,.06,-.12,.12]){
        const bw=baseRect.w*scale,bh=baseRect.h*scale,x=(baseRect.x+baseRect.w/2)*scale+bw*dx-bw*factor/2,y=(baseRect.y+baseRect.h/2)*scale+bh*dy-bh*factor/2;
        if(attempt([{x,y},{x:x+bw*factor,y},{x:x+bw*factor,y:y+bh*factor},{x,y:y+bh*factor}])){success=true;break outer;}
      }
    }
    return {...best,ms:performance.now()-start,candidates,checksum:success?'pass':'unverified'};
  }
  function createConfirmation(required=2) {
    let last=null,count=0;
    return {reset(){last=null;count=0;},update(result){
      if(result?.text===null||result?.text===undefined){last=null;count=0;return false;}
      if(result.text===last)count++;else{last=result.text;count=1;}
      return count>=required;
    }};
  }
  window.ColorQRScanner={scan,reset(){previous=null;},createConfirmation};
})();
