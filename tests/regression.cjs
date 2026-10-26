const {chromium}=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {spawn}=require('node:child_process');
(async()=>{
 const server=spawn(process.execPath,['tests/server.cjs'],{stdio:'ignore'});let browser;
 try{
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge'});
  const context=await browser.newContext(),page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(let i=0;i<50;i++){try{await page.goto('http://127.0.0.1:8087');break;}catch{await new Promise(r=>setTimeout(r,100));}}
  await page.addScriptTag({path:'tests/fixtures.js'});
  const checks=await page.evaluate(()=>{
   const checks=[];
   function test(name,fn){fn();checks.push(name);}
   const eq=(a,b)=>{if(a!==b)throw Error(`${a} != ${b}`);};
   const rejects=fn=>{let threw=false;try{fn();}catch{threw=true;}if(!threw)throw Error('expected rejection');};
   const scan=c=>{ColorQRScanner.reset();return ColorQRScanner.scan(c,{x:80,y:80,w:240,h:240});};
   test('all byte lengths 0..48 and Japanese',()=>{
    for(let n=0;n<=48;n++)for(const legacy of [true,false])eq(decodeGridToText(encodeToGrid('x'.repeat(n),{legacy})),'x'.repeat(n));
    eq(decodeGridToText(encodeToGrid('日本語と😀')),'日本語と😀');rejects(()=>encodeToGrid('x'.repeat(49)));
   });
   const positions=[...cellIterator()];
   function byteAt(grid,index,value){const quad=byteTo6Quad(value);quad.forEach((v,k)=>{const {x,y}=positions[7+index*4+k];grid[y][x]=v;});}
   test('noncanonical radix values cannot wrap to byte',()=>{
    const g=encodeToGrid('A');byteAt(g,0,321);rejects(()=>decodeGridToText(g));
   });
   test('malformed grid, length, padding and invalid UTF8 reject',()=>{
    rejects(()=>decodeGridToText([]));
    let g=encodeToGrid('A'),p=positions[239];g[p.y][p.x]=2;rejects(()=>decodeGridToText(g));
    g=encodeToGrid('A');byteAt(g,0,255);
    const chk=byteTo6Quad(computeChecksum(new Uint8Array([255])));chk.forEach((v,k)=>{const p=positions[3+k];g[p.y][p.x]=v;});
    rejects(()=>decodeGridToText(g));
   });
   test('document XOR collision honestly: swapped bytes pass legacy checksum',()=>{
    const g=encodeToGrid('AB',{legacy:true});byteAt(g,0,66);byteAt(g,1,65);eq(decodeGridToText(g),'BA');
   });
   test('CRC32 rejects swapped bytes and glare collision at full capacity',()=>{
    eq(computeCRC32(new TextEncoder().encode('AB')),0xf9799d01); // independently checked with Python zlib
    const g=encodeToGrid('AB');byteAt(g,0,66);byteAt(g,1,65);rejects(()=>decodeGridToText(g));
    window.fixtureLegacy=false;const r=scan(fixture('Z'.repeat(48),'glare'));eq(r.text,null);window.fixtureLegacy=true;
   });
   test('v2 rejects every single stream-symbol substitution (1200 cases)',()=>{
    const original=encodeToGrid('検証用の文字列ABC123');
    for(const {x,y} of positions)for(let value=0;value<6;value++)if(value!==original[y][x]){
      const g=original.map(r=>r.slice());g[y][x]=value;rejects(()=>decodeGridToText(g));
    }
   });
   test('actual generator output and nine transforms',()=>{
    const source=document.createElement('canvas');source.width=source.height=400;
    drawGridToCanvas(source,encodeToGrid('実際の生成画像'));
    for(const angle of [0,-15,-10,-5,5,10,15,90,180]){
      const c=document.createElement('canvas');c.width=c.height=540;const ctx=c.getContext('2d');
      ctx.fillStyle='#eee';ctx.fillRect(0,0,540,540);ctx.translate(270,270);ctx.rotate(angle*Math.PI/180);ctx.drawImage(source,-200,-200);
      eq(scan(c).text,'実際の生成画像');
    }
   });
   test('invalid large region cannot suppress valid smaller candidate',()=>{
    const c=document.createElement('canvas');c.width=800;c.height=400;const ctx=c.getContext('2d');ctx.fillStyle='#f5f5f5';ctx.fillRect(0,0,800,400);
    ctx.drawImage(fixture('bad','corrupt'),0,0,400,400);ctx.drawImage(fixture('good','rotate10'),440,40,320,320);
    eq(scan(c).text,'good');
   });
   test('two consecutive equal frames, failure/different payload reset',()=>{
    const gate=ColorQRScanner.createConfirmation();
    eq(gate.update({text:'A'}),false);eq(gate.update({text:'A'}),true);
    eq(gate.update({text:null}),false);eq(gate.update({text:'A'}),false);
    eq(gate.update({text:'B'}),false);eq(gate.update({text:'B'}),true);gate.reset();eq(gate.update({text:''}),false);eq(gate.update({text:''}),true);
   });
   test('no-region invalidates tracked position',()=>{scan(fixture('A','plain'));eq(ColorQRScanner.scan(fixture('A','blank'),{x:80,y:80,w:240,h:240}).text,undefined);});
   return checks;
  });
  // Exercise real video scheduling/UI with a local synthetic MediaStream.
  await page.evaluate(()=>{
   window.cameraCanvas=fixture('動画フレーム確認','rotate10');
   window.cameraTimer=setInterval(()=>{const ctx=cameraCanvas.getContext('2d');ctx.drawImage(cameraCanvas,0,0);},60);
   navigator.mediaDevices.getUserMedia=async()=>cameraCanvas.captureStream(15);
  });
  await page.locator('[data-tab="scan"]').click();await page.locator('#btnStartScan').click();
  await page.waitForFunction(()=>document.querySelector('#decodedText').textContent==='動画フレーム確認',{},{timeout:10000});
  assert.match(await page.locator('#scanStatus').textContent(),/2フレーム確認/);
  await page.locator('#btnDebug').click();await page.waitForTimeout(250);
  await page.screenshot({path:'results/scanner-synthetic-video.png',fullPage:true});
  await page.locator('#btnStopScan').click();await page.evaluate(()=>clearInterval(cameraTimer));
  checks.push('synthetic MediaStream drives camera scheduling and result UI');
  await page.locator('[data-tab="encode"]').click();
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await page.reload();await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
  await page.setViewportSize({width:390,height:844});
  await page.locator('#inputText').fill('日本語とCRC-32の検証');await page.locator('#btnGenerate').click();
  await page.screenshot({path:'results/app-mobile.png',fullPage:true});
  await context.setOffline(true);await page.reload();
  assert.equal(await page.evaluate(()=>typeof ColorQRScanner.scan),'function');checks.push('PWA reloads engine offline');
  assert.deepEqual(errors,[]);
  const result={timestamp:new Date().toISOString(),browser:browser.version(),checks,passed:checks.length,errors};
  fs.writeFileSync('results/regression.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 }finally{await browser?.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
