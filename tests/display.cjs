const {chromium}=require('@playwright/test');
const fs=require('node:fs');
(async()=>{const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge'});try{
 const page=await browser.newPage();await page.setContent('<canvas></canvas>');
 await page.addScriptTag({content:fs.readFileSync('index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1]});
 await page.addScriptTag({path:process.argv[2]==='before'?'tests/baseline/scanner-v3.js':'scanner.js'});
 const rows=await page.evaluate(()=>{
  const rows=[];
  for(const text of ['Hello, 6ColorQR!','画面からの読み取り','Z'.repeat(48)])for(const size of [180,260,340])for(const angle of [-10,0,10]){
   const code=document.createElement('canvas');code.width=code.height=528;drawGridToCanvas(code,encodeToGrid(text));
   const scene=document.createElement('canvas');scene.width=640;scene.height=480;
   const ctx=scene.getContext('2d');ctx.fillStyle='#303438';ctx.fillRect(0,0,640,480);
   ctx.fillStyle='#aaa';ctx.fillRect(35,20,570,430);ctx.fillStyle='#fff';ctx.fillRect(70,45,500,380);
   ctx.save();ctx.translate(320,235);ctx.rotate(angle*Math.PI/180);ctx.filter='blur(0.7px)';ctx.drawImage(code,-size/2,-size/2,size,size);ctx.restore();
   ColorQRScanner.reset();const r=ColorQRScanner.scan(scene,{x:190,y:105,w:260,h:260});
   if(text==='Hello, 6ColorQR!'&&size===180&&angle===10){window.exampleScene=scene;window.exampleResult=r;}
   rows.push({text,size,angle,success:r.text===text,score:r.score,reason:r.reason,ms:r.ms});
  }return rows;
 });
 const out={rows,success:rows.filter(r=>r.success).length,total:rows.length,browser:browser.version()};
 fs.writeFileSync('results/display-'+(process.argv[2]||'current')+'.json',JSON.stringify(out,null,2));console.log(JSON.stringify({success:out.success,total:out.total}));
 await page.evaluate(()=>{document.body.replaceChildren(exampleScene);const p=document.createElement('p');p.textContent='Synthetic display scene: '+(exampleResult.text!=null?'decoded':'rejected');document.body.append(p);});
 await page.screenshot({path:'results/display-'+(process.argv[2]||'current')+'.png'});
 if(process.argv[2]!=='before'&&out.success!==out.total)throw Error('Display regression: not all scenes decoded');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
