const {chromium}=require('@playwright/test');
const fs=require('node:fs'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
(async()=>{const server=spawn(process.execPath,['tests/server.cjs'],{stdio:'ignore'});let browser;
try{
 browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge'});
 const context=await browser.newContext(),page=await context.newPage({viewport:{width:1100,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 for(let i=0;i<50;i++){try{await page.goto('http://127.0.0.1:8087/art.html');break;}catch{await new Promise(r=>setTimeout(r,100));}}
 const result=await page.evaluate(()=>{
  const A=ArtMessage,checks=[],measurements=[];
  function check(name,fn){try{fn();checks.push({name,pass:true});}catch(e){checks.push({name,pass:false,error:e.message});}}
  const eq=(a,b)=>{if(a!==b)throw Error(JSON.stringify(a)+' != '+JSON.stringify(b));};
  const raw=document.createElement('canvas');A.flower(raw);const art=A.makeArtwork(raw);
  let clock=0;
  function rendered(packet,phase,kind='plain',index=0,artwork=art){
   const code=document.createElement('canvas');A.render(code,artwork,packet,phase,kind==='low'?16:28);
   if(kind==='plain')return code;
   if(kind==='perspective'){
    // Independent eight-equation inverse warp, not the decoder's projector.
    const dst=[[95+index*2,45],[555,90],[535,480],[65,430]],src=[[0,0],[600,0],[600,600],[0,600]],m=[];
    dst.forEach(([x,y],i)=>{const [u,v]=src[i];m.push([x,y,1,0,0,0,-u*x,-u*y,u],[0,0,0,x,y,1,-v*x,-v*y,v]);});
    for(let col=0;col<8;col++){
     let pivot=col;for(let row=col+1;row<8;row++)if(Math.abs(m[row][col])>Math.abs(m[pivot][col]))pivot=row;
     [m[col],m[pivot]]=[m[pivot],m[col]];const scale=m[col][col];for(let j=col;j<=8;j++)m[col][j]/=scale;
     for(let row=0;row<8;row++)if(row!==col){const f=m[row][col];for(let j=col;j<=8;j++)m[row][j]-=f*m[col][j];}
    }
    const a=m.map(r=>r[8]),source=code.getContext('2d').getImageData(0,0,600,600).data,c=document.createElement('canvas');c.width=640;c.height=520;const ctx=c.getContext('2d'),im=ctx.createImageData(640,520);
    for(let y=0;y<520;y++)for(let x=0;x<640;x++){
     const d=a[6]*x+a[7]*y+1,u=Math.floor((a[0]*x+a[1]*y+a[2])/d),v=Math.floor((a[3]*x+a[4]*y+a[5])/d),i=(y*640+x)*4;
     if(u>=0&&v>=0&&u<600&&v<600){const j=(v*600+u)*4;im.data.set(source.subarray(j,j+4),i);}else im.data.set([68,77,84,255],i);
    }
    ctx.putImageData(im,0,0);return c;
   }
   const scene=document.createElement('canvas');scene.width=640;scene.height=520;const ctx=scene.getContext('2d');
   ctx.fillStyle='#36454c';ctx.fillRect(0,0,640,520);ctx.fillStyle='#fafafa';ctx.fillRect(24,15,592,490);
   ctx.save();ctx.translate(320+(kind==='moving'?index*1.5:0),260+(kind==='moving'?index:0));
   ctx.rotate((kind==='moving'?6+index*.25:kind==='rotate'?12:0)*Math.PI/180);
   const side=kind==='small'?240:420;ctx.filter=kind==='blur'?'blur(1px)':'none';ctx.drawImage(code,-side/2,-side/2,side,side);ctx.restore();
   if(kind==='camera'){
    const im=ctx.getImageData(0,0,640,520);let seed=123+index;
    for(let i=0;i<im.data.length;i+=4)for(let k=0;k<3;k++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;im.data[i+k]=255*Math.pow(im.data[i+k]/255,1.25)*[.86,.94,.8][k]+8+(seed/4294967296-.5)*8;}
    ctx.putImageData(im,0,0);
   }
   return scene;
  }
  function transfer(text,kind='plain',artwork=art){
   const packets=A.encode(text),receiver=A.createReceiver();let last,frames=0,start=performance.now();
   // Reverse order, polarity reversal and duplicate display captures.
   for(let loop=0;loop<2;loop++)for(let i=packets.length-1;i>=0;i--)for(const phase of [1,1,0,0]){
    const source=rendered(packets[i],phase,kind,frames%2,artwork);clock+=180;frames++;const r=receiver.ingest(source,clock);if(r.text!==undefined)last=r;
   }
   measurements.push({kind,bytes:new TextEncoder().encode(text).length,frames,ms:performance.now()-start,success:last?.text===text,markers:last?.markers});
   eq(last?.text,text);return last;
  }
  check('CRC32 reference and packet integrity',()=>{
   eq(A.crc32(new TextEncoder().encode('123456789')),0xcbf43926);
   for(const n of [0,1,15,16,17,48,159,160]){const ps=A.encode('x'.repeat(n));eq(ps.length,Math.max(1,Math.ceil(n/16)));for(const p of ps)eq(A.parse(p)!==null,true);}
   let rejected=false;try{A.encode('x'.repeat(161));}catch{rejected=true;}eq(rejected,true);
   const original=A.encode('hello')[0];for(let i=0;i<32;i++)for(let bit=0;bit<8;bit++){const p=original.slice();p[i]^=1<<bit;eq(A.parse(p),null);}
  });
  for(const [name,text] of [['ASCII','A'],['Japanese','花の中から、日本語と😀を受信'],['URL','https://example.org/offline'],['capacity','z'.repeat(160)]])check('optical '+name,()=>transfer(text));
  for(const kind of ['surround','small','rotate','blur','camera','moving','perspective','low'])check('optical scene '+kind,()=>transfer('画像の変化から復元します。',kind));
  check('second illustration',()=>{const c=document.createElement('canvas');A.flower(c,'night');transfer('月の絵から届く言葉','rotate',A.makeArtwork(c));});
  check('static image cannot complete transfer',()=>{
   const receiver=A.createReceiver(),packet=A.encode('static')[0],c=rendered(packet,0);for(let i=0;i<12;i++){clock+=100;eq(receiver.ingest(c,clock).text,undefined);}
  });
  check('packet corruption is not accepted',()=>{
   const receiver=A.createReceiver(),p=A.encode('broken')[0];p[14]^=16;
   for(const phase of [0,1,0,1]){clock+=150;eq(receiver.ingest(rendered(p,phase),clock).text,undefined);}
  });
  check('independent messages never combine and reset discards partial state',()=>{
   const receiver=A.createReceiver(),one=A.encode('a'.repeat(32)),two=A.encode('b'.repeat(32));
   for(const p of [one[0],two[1]])for(const phase of [0,1]){clock+=200;eq(receiver.ingest(rendered(p,phase),clock).text,undefined);}
   receiver.reset();for(const phase of [0,1]){clock+=200;eq(receiver.ingest(rendered(one[1],phase),clock).text,undefined);}
  });
  check('markerless and unrelated frames do not decode',()=>{
   const receiver=A.createReceiver();for(let i=0;i<8;i++){clock+=200;const c=document.createElement('canvas');A.flower(c,i%2?'night':'flower');eq(receiver.ingest(c,clock).text,undefined);}
  });
  return {checks,measurements};
 });
 console.log(JSON.stringify(result,null,2));
 // Full UI demo uses the same optical decoder, not a direct payload shortcut.
 await page.locator('#sendPanel details summary').click();
 await page.locator('#localDemo').click();await page.waitForFunction(()=>document.querySelector('#demoResult').textContent.length>0,{},{timeout:20000});
 assert.equal(await page.locator('#demoResult').textContent(),await page.locator('#message').inputValue());result.checks.push({name:'local optical demo UI',pass:true});
 const image=await page.locator('#artCanvas').evaluate(c=>c.toDataURL('image/png').split(',')[1]);
 await page.locator('#imageFile').setInputFiles({name:'local-art.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')});
 await page.waitForFunction(()=>document.querySelector('#sendStatus').textContent.includes('読み込みました'));
 await page.locator('#message').fill('<img src=x onerror=alert(1)>日本語');await page.locator('#localDemo').click();
 await page.waitForFunction(()=>document.querySelector('#demoResult').textContent.startsWith('<img'),{},{timeout:20000});
 assert.equal(await page.locator('#demoResult img').count(),0);result.checks.push({name:'local image import and safe text output',pass:true});
 await page.goto('http://127.0.0.1:8087/');
 await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=528;drawGridToCanvas(c,encodeToGrid('ColorQR preserved'));navigator.mediaDevices.getUserMedia=async()=>{window.fakeColorStream=c.captureStream(15);return fakeColorStream;};});
 await page.locator('[data-tab="scan"]').click();await page.locator('#btnStartScan').click();
 await page.waitForFunction(()=>document.querySelector('#video').srcObject!==null);
 await page.locator('#artFeatureButton').click();await page.waitForFunction(()=>fakeColorStream.getTracks().every(t=>t.readyState==='ended'));
 result.checks.push({name:'mode switch releases original ColorQR camera',pass:true});
 await page.frameLocator('#artFrame').locator('#message').waitFor();
 const frame=page.frame({url:/\/art.html$/});await frame.waitForFunction(()=>!!window.ArtMessage);
 await frame.evaluate(()=>{
  const raw=document.createElement('canvas');ArtMessage.flower(raw);const art=ArtMessage.makeArtwork(raw),packets=ArtMessage.encode('カメラUIで受信しました'),c=document.createElement('canvas');let step=0;
  ArtMessage.render(c,art,packets[0],0,28);window.fakeArtCanvas=c;
  window.fakeArtTimer=setInterval(()=>{step++;ArtMessage.render(c,art,packets[Math.floor(step/2)%packets.length],step%2,28);},600);
  navigator.mediaDevices.getUserMedia=async()=>{window.fakeArtStream=c.captureStream(15);return fakeArtStream;};
 });
 await frame.locator('#receiveTab').click();await frame.locator('#startReceive').click();
 await frame.waitForFunction(()=>document.querySelector('#receivedText').textContent==='カメラUIで受信しました',{},{timeout:20000});
 result.checks.push({name:'synthetic MediaStream to camera UI',pass:true});
 await page.screenshot({path:'results/art-receive-desktop.png',fullPage:true});
 await page.locator('#colorFeatureButton').click();await frame.waitForFunction(()=>fakeArtStream.getTracks().every(t=>t.readyState==='ended'));
 await frame.evaluate(()=>clearInterval(fakeArtTimer));result.checks.push({name:'mode switch releases art camera',pass:true});
 assert.equal(await page.locator('#colorMain').isVisible(),true);
 await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>{window.pendingColorGrant=()=>{const c=document.createElement('canvas');c.width=c.height=320;window.lateColorStream=c.captureStream(15);resolve(lateColorStream);};});});
 await page.locator('#btnStartScan').click();await page.locator('#artFeatureButton').click();await page.evaluate(()=>pendingColorGrant());
 await page.waitForFunction(()=>lateColorStream.getTracks().every(t=>t.readyState==='ended'));result.checks.push({name:'late original camera permission cannot restart hidden mode',pass:true});
 await frame.evaluate(()=>{navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>{window.pendingGrant=()=>{window.lateStream=fakeArtCanvas.captureStream(15);resolve(lateStream);};});});
 await frame.locator('#startReceive').click();await page.locator('#colorFeatureButton').click();await frame.evaluate(()=>pendingGrant());
 await frame.waitForFunction(()=>lateStream.getTracks().every(t=>t.readyState==='ended'));result.checks.push({name:'late camera permission cannot restart hidden mode',pass:true});
 await page.locator('#artFeatureButton').click();await frame.locator('#sendTab').click();
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'results/art-send-mobile.png',fullPage:true});
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.reload();await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
 await context.setOffline(true);await page.reload();await page.locator('#artFeatureButton').click();
 await page.frameLocator('#artFrame').locator('#message').waitFor();
 const offline=page.frame({url:/\/art.html$/});await offline.waitForFunction(()=>!!window.ArtMessage);
 assert.equal(await offline.locator('#startSend').isVisible(),true);result.checks.push({name:'new mode loads offline through service worker',pass:true});
 result.browser=browser.version();result.timestamp=new Date().toISOString();result.errors=errors;
 fs.writeFileSync('results/art-message.json',JSON.stringify(result,null,2));
 assert.deepEqual(errors,[]);assert.equal(result.checks.every(c=>c.pass),true,'Some optical tests failed');
}finally{await browser?.close();server.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
