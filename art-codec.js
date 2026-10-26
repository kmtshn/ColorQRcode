/* ArtMessage v1 experiment. Local optical transfer; no network APIs. */
(() => {
  'use strict';
  const SIZE=600, GRID=16, MAX_BYTES=160, CHUNK=16;
  function crc32(bytes) {
    let crc=0xffffffff;
    for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
    return (crc^0xffffffff)>>>0;
  }
  function put32(b,i,n){for(let j=0;j<4;j++)b[i+j]=(n>>>(24-j*8))&255;}
  function get32(b,i){return ((b[i]*0x1000000)+(b[i+1]<<16)+(b[i+2]<<8)+b[i+3])>>>0;}
  function encode(text) {
    const bytes=new TextEncoder().encode(text);
    if(bytes.length>MAX_BYTES)throw Error(`最大${MAX_BYTES}バイトです（現在${bytes.length}バイト）`);
    const count=Math.max(1,Math.ceil(bytes.length/CHUNK)),id=crc32(bytes),packets=[];
    for(let index=0;index<count;index++){
      const p=new Uint8Array(32);p.set([0x41,0x52,1,count,index,bytes.length>>>8,bytes.length&255]);
      put32(p,7,id);p.set(bytes.subarray(index*CHUNK,(index+1)*CHUNK),11);
      put32(p,27,crc32(p.subarray(0,27)));p[31]=0x5a;packets.push(p);
    }
    return packets;
  }
  function parse(p) {
    if(p.length!==32||p[0]!==0x41||p[1]!==0x52||p[2]!==1||p[31]!==0x5a)return null;
    const length=p[5]*256+p[6],count=Math.max(1,Math.ceil(length/CHUNK)),index=p[4];
    if(length>MAX_BYTES||p[3]!==count||index>=count||get32(p,27)!==crc32(p.subarray(0,27)))return null;
    const used=Math.min(CHUNK,Math.max(0,length-index*CHUNK));
    if(p.subarray(11+used,27).some(v=>v!==0))return null;
    return {id:get32(p,7),length,count,index,data:p.slice(11,11+used)};
  }
  function flower(canvas,theme='flower') {
    canvas.width=canvas.height=SIZE;const c=canvas.getContext('2d');
    const bg=c.createLinearGradient(0,0,600,600);bg.addColorStop(0,'#dbe8df');bg.addColorStop(1,'#f0d9c6');c.fillStyle=bg;c.fillRect(0,0,600,600);
    if(theme==='night'){
      const g=c.createLinearGradient(0,0,0,600);g.addColorStop(0,'#414764');g.addColorStop(1,'#a2a6b3');c.fillStyle=g;c.fillRect(0,0,600,600);
      c.fillStyle='#e5dab6';c.beginPath();c.arc(430,150,56,0,Math.PI*2);c.fill();
      for(let i=0;i<28;i++){c.fillStyle='rgba(240,227,192,.5)';c.beginPath();c.arc(70+(i*79)%470,60+(i*47)%270,1.5+(i%3),0,Math.PI*2);c.fill();}
      for(let i=0;i<3;i++){c.fillStyle=['#717b82','#53686c','#3d5559'][i];c.beginPath();c.moveTo(0,600);for(let x=0;x<=600;x+=15)c.lineTo(x,390+i*55+Math.sin(x/110+i)*35);c.lineTo(600,600);c.fill();}
    }else{
      c.strokeStyle='#628778';c.lineWidth=9;c.lineCap='round';c.beginPath();c.moveTo(300,570);c.bezierCurveTo(285,430,345,355,300,240);c.stroke();
      for(const [x,y,a] of [[295,460,-.6],[313,390,.7]]){c.save();c.translate(x,y);c.rotate(a);c.fillStyle='#7f9c7a';c.beginPath();c.ellipse(-37,0,59,22,0,0,Math.PI*2);c.fill();c.restore();}
      for(let ring=0;ring<2;ring++)for(let i=0;i<9;i++){
        const a=i*Math.PI*2/9+ring*.3;c.save();c.translate(300,245);c.rotate(a);
        const g=c.createRadialGradient(0,-55,3,0,-65,95);g.addColorStop(0,ring?'#f4d5c4':'#edb9a4');g.addColorStop(1,ring?'#d69488':'#d18f82');
        c.fillStyle=g;c.beginPath();c.ellipse(0,ring?-54:-75,ring?30:37,ring?65:85,0,0,Math.PI*2);c.fill();c.restore();
      }
      c.fillStyle='#ac8053';c.beginPath();c.arc(300,245,31,0,Math.PI*2);c.fill();
      for(let i=0;i<35;i++){const a=i*2.4,r=4+Math.sqrt(i)*3.7;c.fillStyle=i%2?'#d8b87a':'#856d4e';c.beginPath();c.arc(300+Math.cos(a)*r,245+Math.sin(a)*r,2,0,Math.PI*2);c.fill();}
    }
  }
  function makeArtwork(source) {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=SIZE;
    const c=canvas.getContext('2d');c.fillStyle='#d2d2d2';c.fillRect(0,0,SIZE,SIZE);
    const sw=source.naturalWidth||source.width,sh=source.naturalHeight||source.height,side=Math.min(sw,sh);
    c.drawImage(source,(sw-side)/2,(sh-side)/2,side,side,60,60,480,480);
    const im=c.getImageData(60,60,480,480);
    // Reserve brightness headroom for both complementary states.
    for(let i=0;i<im.data.length;i+=4)for(let k=0;k<3;k++)im.data[i+k]=45+im.data[i+k]*.64;
    c.putImageData(im,60,60);return canvas;
  }
  function render(canvas,art,packet,phase=0,strength=28) {
    if(!Number.isFinite(strength)||strength<12||strength>40)throw Error('不正な強度');
    if(packet.length!==32)throw Error('不正なパケット');
    if(canvas.width!==SIZE||canvas.height!==SIZE)canvas.width=canvas.height=SIZE;
    const c=canvas.getContext('2d');c.fillStyle='#faf9f5';c.fillRect(0,0,SIZE,SIZE);c.drawImage(art,60,60,480,480,60,60,480,480);
    if(phase!==null){
    const im=c.getImageData(72,72,456,456),cell=456/GRID;
    for(let y=0;y<456;y++)for(let x=0;x<456;x++){
      const gx=Math.min(15,Math.floor(x/cell)),gy=Math.min(15,Math.floor(y/cell)),bit=gy*16+gx;
      const value=(packet[bit>>>3]>>>(7-(bit&7)))&1;
      const fx=(x/cell)%1,fy=(y/cell)%1;
      const envelope=Math.min(1,Math.min(fx,1-fx,fy,1-fy)*5);
      const delta=(value?1:-1)*(phase?-1:1)*strength*envelope,i=(y*456+x)*4;
      for(let k=0;k<3;k++)im.data[i+k]+=delta;
    }
    c.putImageData(im,72,72);
    }
    // Registration marks remain visible in the prototype; not an invisible watermark.
    for(const [x,y] of [[30,30],[570,30],[570,570],[30,570]]){
      c.fillStyle='#101010';c.fillRect(x-21,y-21,42,42);c.fillStyle='#fafafa';c.fillRect(x-15,y-15,30,30);c.fillStyle='#101010';c.fillRect(x-9,y-9,18,18);
    }
  }
  function project(c) {
    const [a,b,d,e]=c,dx=b.x-d.x,dy=b.y-d.y,ex=e.x-d.x,ey=e.y-d.y;
    const sx=a.x-b.x+d.x-e.x,sy=a.y-b.y+d.y-e.y,det=dx*ey-ex*dy;if(Math.abs(det)<1e-8)return null;
    const g=(sx*ey-ex*sy)/det,h=(dx*sy-sx*dy)/det;
    return (u,v)=>{const z=g*u+h*v+1;return {x:((b.x-a.x+g*b.x)*u+(e.x-a.x+h*e.x)*v+a.x)/z,y:((b.y-a.y+g*b.y)*u+(e.y-a.y+h*e.y)*v+a.y)/z};};
  }
  function findMarkers(gray,w,h) {
    // A five-run 1:1:3:1:1 cross, with a vertical confirmation.
    let low=255,high=0;for(let i=0;i<gray.length;i+=17){low=Math.min(low,gray[i]);high=Math.max(high,gray[i]);}
    if(high-low<50)return [];
    const threshold=Math.max(45,Math.min(180,(low+high)/2)),black=(x,y)=>x>=0&&y>=0&&x<w&&y<h&&gray[y*w+x]<threshold;
    const ratio=r=>{const n=r.reduce((a,b)=>a+b,0)/7;return n>=1.3&&r.every((v,i)=>Math.abs(v-n*(i===2?3:1))<n*.75);};
    const crossCheck=(x,y,max)=>{
      const r=[0,0,0,0,0];let up=y,down=y+1;
      while(up>=0&&black(x,up)&&r[2]<max){r[2]++;up--;}
      while(down<h&&black(x,down)&&r[2]<max){r[2]++;down++;}
      for(const k of [1,0]){while(up>=0&&black(x,up)===(k===0)&&r[k]<max){r[k]++;up--;}}
      for(const k of [3,4]){while(down<h&&black(x,down)===(k===4)&&r[k]<max){r[k]++;down++;}}
      return ratio(r)?{y:(up+r[0]+r[1]+r[2]/2+.5),size:r.reduce((a,b)=>a+b,0)}:null;
    };
    const centers=[];
    for(let y=0;y<h;y+=2){let runs=[],start=0,color=black(0,y);
      for(let x=1;x<=w;x++)if(x===w||black(x,y)!==color){
        runs.push({length:x-start,black:color});if(runs.length>5)runs.shift();
        if(runs.length===5&&runs[0].black&&runs[2].black&&runs[4].black){
          const r=runs.map(v=>v.length);
          if(ratio(r)){
            const cx=x-r[4]-r[3]-r[2]/2,v=crossCheck(Math.floor(cx),y,r.reduce((a,b)=>a+b,0)*2);
            if(v&&Math.abs(v.size-r.reduce((a,b)=>a+b,0))<v.size*.5){
              const near=centers.find(p=>Math.hypot(p.x-cx,p.y-v.y)<v.size*.4);
              if(near){near.x=(near.x*near.hits+cx)/(near.hits+1);near.y=(near.y*near.hits+v.y)/(near.hits+1);near.hits++;}
              else if(centers.length<128)centers.push({x:cx,y:v.y,size:v.size,hits:1});
            }
          }
        }
        start=x;color=!color;
      }
    }
    return centers.filter(p=>p.hits>=2).sort((a,b)=>b.hits-a.hits).slice(0,10);
  }
  function quads(markers,w,h) {
    const found=[];
    for(let a=0;a<markers.length;a++)for(let b=a+1;b<markers.length;b++)for(let c=b+1;c<markers.length;c++)for(let d=c+1;d<markers.length;d++){
      const ps=[markers[a],markers[b],markers[c],markers[d]],cx=ps.reduce((s,p)=>s+p.x,0)/4,cy=ps.reduce((s,p)=>s+p.y,0)/4;
      ps.sort((p,q)=>Math.atan2(p.y-cy,p.x-cx)-Math.atan2(q.y-cy,q.x-cx));
      const area=ps.reduce((s,p,i)=>s+p.x*ps[(i+1)%4].y-p.y*ps[(i+1)%4].x,0)/2;
      const sides=ps.map((p,i)=>Math.hypot(p.x-ps[(i+1)%4].x,p.y-ps[(i+1)%4].y));
      const sizes=ps.map(p=>p.size);
      if(area<w*h*.025||Math.min(...sides)<65||Math.max(...sides)>Math.min(...sides)*2||Math.max(...sizes)>Math.min(...sizes)*2)continue;
      if(sides.some((v,i)=>v/((sizes[i]+sizes[(i+1)%4])/2)<8||v/((sizes[i]+sizes[(i+1)%4])/2)>20))continue;
      const turns=ps.map((p,i)=>{const q=ps[(i+1)%4],r=ps[(i+2)%4];return(q.x-p.x)*(r.y-q.y)-(q.y-p.y)*(r.x-q.x);});
      if(turns.some(v=>v<=0))continue;
      found.push({corners:ps,quality:ps.reduce((s,p)=>s+p.hits,0)});
    }
    return found.sort((a,b)=>b.quality-a.quality).slice(0,3).map(v=>v.corners);
  }
  function sample(gray,w,h,corners) {
    const p=project(corners);if(!p)return null;
    const at=(u,v)=>{const q=p(u,v),x=Math.round(q.x),y=Math.round(q.y);return x<0||y<0||x>=w||y>=h?null:gray[y*w+x];};
    const black=[],white=[];
    for(const [u,v] of [[0,0],[1,0],[1,1],[0,1]]){
      black.push(at(u,v));white.push(at(u+(u?-.02222:.02222),v));
    }
    if([...black,...white].some(v=>v===null))return null;
    const lo=black.reduce((a,b)=>a+b)/4,hi=white.reduce((a,b)=>a+b)/4;
    if(hi-lo<55)return null;
    const values=new Float32Array(256);
    for(let y=0;y<16;y++)for(let x=0;x<16;x++){
      const s=[];for(const dy of [-.15,0,.15])for(const dx of [-.15,0,.15]){
        const v=at((42+(x+.5+dx)*28.5)/540,(42+(y+.5+dy)*28.5)/540);if(v===null)return null;s.push(v);
      }
      s.sort((a,b)=>a-b);values[y*16+x]=(s[4]-lo)/(hi-lo);
    }
    return values;
  }
  function decodeDifference(a,b) {
    let magnitude=0;for(let i=0;i<256;i++)magnitude+=Math.abs(a[i]-b[i]);
    if(magnitude/256<.035)return null;
    for(let rotation=0;rotation<4;rotation++)for(const invert of [false,true]){
      const bytes=new Uint8Array(32);
      for(let y=0;y<16;y++)for(let x=0;x<16;x++){
        let sx=x,sy=y;for(let r=0;r<rotation;r++){const v=sx;sx=15-sy;sy=v;}
        const index=y*16+x,value=((a[sy*16+sx]-b[sy*16+sx]>0)!==invert)?1:0;
        bytes[index>>>3]|=value<<(7-(index&7));
      }
      const packet=parse(bytes);if(packet)return packet;
    }
    return null;
  }
  function createReceiver() {
    const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
    let history=[],sessions=new Map(),lastAt=-Infinity,lastProgress=null;
    function reset(){history=[];sessions.clear();lastAt=-Infinity;lastProgress=null;}
    function ingest(source,now=performance.now()) {
      const start=performance.now(),vw=source.videoWidth||source.naturalWidth||source.width,vh=source.videoHeight||source.naturalHeight||source.height;
      if(!vw||!vh)return {reason:'empty-frame',received:0,total:0};
      if(now<lastAt||now-lastAt>5000)reset();lastAt=now;
      const scale=Math.min(1,720/Math.max(vw,vh)),w=Math.round(vw*scale),h=Math.round(vh*scale);
      if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;history=[];}
      ctx.drawImage(source,0,0,w,h);const data=ctx.getImageData(0,0,w,h).data,gray=new Uint8Array(w*h);
      for(let i=0;i<gray.length;i++)gray[i]=(data[i*4]*.299+data[i*4+1]*.587+data[i*4+2]*.114)|0;
      const markers=findMarkers(gray,w,h),candidates=quads(markers,w,h);
      let result={...lastProgress,reason:markers.length<4?'四隅の目印を探しています':'対になる表示を待っています',markers:markers.length,ms:0};
      for(const corners of candidates){
        const values=sample(gray,w,h,corners);if(!values)continue;
        // Pair only nearby geometry and recent frames; each frame is registered separately.
        for(const old of history){
          if(old.w!==w||old.h!==h||now-old.at>3500)continue;
          const displacement=corners.reduce((s,p,i)=>s+Math.hypot(p.x-old.corners[i].x,p.y-old.corners[i].y),0)/4;
          if(displacement>Math.min(w,h)*.18)continue;
          const packet=decodeDifference(values,old.values);if(!packet)continue;
          const key=packet.id+':'+packet.length;
          for(const [k,s] of sessions)if(now-s.at>60000)sessions.delete(k);
          if(!sessions.has(key)){if(sessions.size>=3)sessions.delete(sessions.keys().next().value);sessions.set(key,{parts:new Map(),at:now});}
          const s=sessions.get(key);s.at=now;s.parts.set(packet.index,packet.data);
          result={reason:'受信中',received:s.parts.size,total:packet.count,id:packet.id,markers:markers.length};
          if(s.parts.size===packet.count){
            const bytes=new Uint8Array(packet.length);for(let i=0;i<packet.count;i++)bytes.set(s.parts.get(i),i*CHUNK);
            if(crc32(bytes)===packet.id){try{result.text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);result.reason='検証完了';}catch{result.reason='UTF-8不一致';}}
            else result.reason='全体CRC不一致';
          }
          lastProgress={received:result.received,total:result.total,id:result.id};
          break;
        }
        history.push({values,corners,w,h,at:now});
        result.corners=corners.map(p=>({x:p.x/scale,y:p.y/scale}));
        if(result.received)break;
      }
      history=history.filter(v=>now-v.at<3500).slice(-16);
      if(!candidates.length)history=[];
      result.ms=performance.now()-start;return result;
    }
    return {ingest,reset};
  }
  window.ArtMessage={SIZE,MAX_BYTES,crc32,encode,parse,flower,makeArtwork,render,createReceiver};
})();
