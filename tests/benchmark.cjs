const {chromium} = require('@playwright/test');
const fs=require('node:fs');
const {spawn}=require('node:child_process');
(async()=>{
 const server=spawn(process.execPath,['tests/server.cjs'],{stdio:'ignore'});
 let browser;
 try {
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
  const page=await browser.newPage({serviceWorkers:'block'});
  for(let i=0;i<50;i++){try{await page.goto('http://127.0.0.1:8087');break;}catch{await new Promise(r=>setTimeout(r,100));}}
  const version=process.argv[2]||'baseline';
  await page.goto('http://127.0.0.1:8087/'+(version==='baseline'?'tests/baseline/index.html':'index.html'));
  await page.addScriptTag({path:'tests/fixtures.js'});
  const result=await page.evaluate(async(version)=>{
   window.fixtureLegacy=!version.endsWith('-v2');
   const conditions=['plain','left','right','up','down','small','large','rotate-15','rotate-10','rotate-5','rotate5','rotate10','rotate15','perspective','blur','noise','dark','cast','saturation','hue','blank','corrupt'];
   const payloads=['A','日本語の検証','012345678901234567890123456789','https://example.org/qr?a=6','Z'.repeat(48)];
   const cases=[];
   for(const text of payloads)for(const condition of conditions)cases.push({text,condition,split:'development'});
   for(let n=1;n<=48;n++)cases.push({text:'x'.repeat(n),condition:'plain',split:'capacity'});
   for(const text of ['未知の画像です','https://test.invalid/holdout','B7q!'.repeat(12)])for(const condition of ['rotate7','rotate-12','held-perspective','held-combined'])cases.push({text,condition,split:'holdout'});
   for(let i=0;i<24;i++)cases.push({text:i%2?'最終評価'+i:'https://example.net/'+i,condition:'sealed-'+i,split:'final-holdout'});
   for(const text of ['A','日本語の検証','Z'.repeat(48)])for(const condition of ['very-dark','severe-noise','severe-blur','occlusion','glare','clutter'])cases.push({text,condition,split:'stress'});
   const rows=[];
   for(const [index,item] of cases.entries()){
    const canvas=fixture(item.text,item.condition,123+index),start=performance.now();
    let best,error=null,decoded=null;
    try{if(version!=='baseline')ColorQRScanner.reset();best=version==='baseline'?searchBestRect(canvas,{x:80,y:80,w:240,h:240}):ColorQRScanner.scan(canvas,{x:80,y:80,w:240,h:240});if(best?.score>=12)decoded=decodeGridToText(best.grid);}catch(e){error=e.message;}
    const ms=performance.now()-start,invalid=['blank','corrupt'].includes(item.condition);
    let confirmationFrames=decoded===null?null:1,trackedMs=null;
    if(version!=='baseline'&&decoded!==null){const gate=ColorQRScanner.createConfirmation();gate.update(best);const tracked=ColorQRScanner.scan(canvas,{x:80,y:80,w:240,h:240});confirmationFrames=gate.update(tracked)?2:null;trackedMs=tracked.ms;}
    rows.push({...item,index,ms,decoded,error:error||best?.reason||null,score:best?.score??0,rect:best?.rect,corners:best?.corners,confirmationFrames,trackedMs,success:!invalid&&decoded===item.text,falsePositive:decoded!==null&&(invalid||decoded!==item.text)});
   }
   return {rows,userAgent:navigator.userAgent,memory:performance.memory?{usedJSHeapSize:performance.memory.usedJSHeapSize}:null};
  },version);
  result.version=version;result.timestamp=new Date().toISOString();result.browser=browser.version();
  const valid=result.rows.filter(r=>!['blank','corrupt'].includes(r.condition));
  const times=result.rows.map(r=>r.ms).sort((a,b)=>a-b);
  result.summary={success:valid.filter(r=>r.success).length,total:valid.length,falsePositives:result.rows.filter(r=>r.falsePositive).length,meanMs:times.reduce((a,b)=>a+b)/times.length,medianMs:times[Math.floor(times.length*.5)],p95Ms:times[Math.floor(times.length*.95)]};
  fs.writeFileSync('results/'+version+'.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result.summary));
  await page.evaluate(()=>{document.body.replaceChildren(fixture('日本語の検証','perspective'));});
  await page.screenshot({path:'results/'+version+'-perspective.png'});
 }finally{await browser?.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
