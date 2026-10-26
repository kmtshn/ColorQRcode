const fs=require('node:fs');
const names=['baseline','improved','improved-v2'];
const runs=names.map(n=>JSON.parse(fs.readFileSync(`results/${n}.json`,'utf8')));
const fmt=n=>n.toFixed(1);
let md='# 実測比較\n\n旧形式の同一画像は baseline と improved で比較する。improved-v2 は同じ文字列・変形・乱数種を新形式へ適用した結果で、セル配列は異なる。全件、コールド探索で測定した。\n\n';
md+='|指標|現行版・旧形式|改善版・旧形式|改善版・CRC32形式|\n|---|---:|---:|---:|\n';
const line=(title,fn)=>{md+=`|${title}|${runs.map(fn).join('|')}|\n`;};
line('正しく復元 / 有効画像',r=>`${r.summary.success}/${r.summary.total} (${fmt(r.summary.success/r.summary.total*100)}%)`);
line('誤った内容の受理 / 全画像',r=>`${r.summary.falsePositives}/${r.rows.length}`);
for(const [label,key] of [['平均 ms','meanMs'],['中央値 ms','medianMs'],['p95 ms','p95Ms']])line(label,r=>fmt(r.summary[key]));
md+='\n|条件|現行版|改善版・旧形式|改善版・CRC32|\n|---|---:|---:|---:|\n';
for(const condition of [...new Set(runs[0].rows.map(r=>r.condition).filter(c=>!c.startsWith('sealed-')))]){
 line(condition,r=>{const rows=r.rows.filter(x=>x.condition===condition);return `${rows.filter(x=>x.success).length}/${rows.length}`;});
}
md+='\n|分割|現行版|改善版・旧形式|改善版・CRC32|\n|---|---:|---:|---:|\n';
for(const split of [...new Set(runs[0].rows.map(r=>r.split))])line(split,r=>{const rows=r.rows.filter(x=>x.split===split&&!['blank','corrupt'].includes(x.condition));return `${rows.filter(x=>x.success).length}/${rows.length}`;});
md+='\nblank / corrupt は負例なので上表の復元成功は0が期待値。負例の判定は JSON の falsePositive を参照。occlusion / glare は元の内容を復元できた場合のみ成功とする。\n\n';
for(const r of runs){const successes=r.rows.filter(x=>x.success);const tracked=successes.filter(x=>x.trackedMs!==null).map(x=>x.trackedMs).sort((a,b)=>a-b);
 md+=`- ${r.version}: ${r.timestamp}, Edge ${r.browser}, 成功時の確認フレーム ${[...new Set(successes.map(x=>x.confirmationFrames))].join(',')}`;
 if(tracked.length)md+=`, 追跡時の中央値 ${fmt(tracked[Math.floor(tracked.length/2)])}ms`;
 md+='\n';
}
md+='\nフレーム数は同じ合成画像を別の scan 呼び出しで与えた試験。カメラ動画の成功フレーム数や撮影から表示までの待ち時間ではない。処理時間は描画・画素取得・検出・復元を含み、画像生成と2回目の追跡処理を除く。全212件（有効202件、負例10件）を1回ずつ測定。JIT・GC・実行順序の影響は除去していない。\n';
fs.writeFileSync('results/COMPARISON.md',md);
console.log(md);
