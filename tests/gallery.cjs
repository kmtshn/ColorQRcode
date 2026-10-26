const {chromium}=require('@playwright/test');
const fs=require('node:fs');
(async()=>{const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge'});
try{const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1});
 await page.setContent('<html><head><meta charset="utf-8"></head><body></body></html>');
 await page.addScriptTag({content:fs.readFileSync('index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1]});
 await page.addScriptTag({path:'scanner.js'});await page.addScriptTag({path:'tests/fixtures.js'});
 const runs=['baseline','improved','improved-v2'].map(n=>JSON.parse(fs.readFileSync(`results/${n}.json`,'utf8')));
 await page.evaluate(runs=>{
  document.body.style='font:16px sans-serif;background:#edf2f7;padding:20px;margin:0';
  const title=document.createElement('h1');title.textContent='6ColorQR — synthetic image evaluation';document.body.append(title);
  const grid=document.createElement('div');grid.style='display:grid;grid-template-columns:repeat(4,1fr);gap:16px';document.body.append(grid);
  for(const condition of ['plain','rotate15','perspective','cast','held-combined','glare','clutter','sealed-3']){
    const old=runs[0].rows.find(r=>r.condition===condition&&(condition==='sealed-3'||r.text==='Z'.repeat(48)));
    if(!old)continue;
    const card=document.createElement('div');card.style='background:white;border-radius:12px;padding:16px';grid.append(card);
    const label=document.createElement('h2');label.textContent=condition;label.style='font-size:20px;margin:0 0 8px';card.append(label);
    const c=fixture(old.text,old.condition,123+old.index);c.style='width:100%;height:auto';card.append(c);
    for(const [i,run] of runs.entries()){
      const row=run.rows[old.index],p=document.createElement('p');p.style='margin:8px 0;color:'+(row.success?'#146b38':'#a52222');
      p.textContent=['Baseline','Improved / legacy','Improved / CRC32'][i]+': '+(row.success?'exact match':row.falsePositive?'WRONG ACCEPT':'rejected')+' ('+row.score+'/16)';card.append(p);
    }
  }
 },runs);
 await page.screenshot({path:'results/conditions.png',fullPage:true});
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
