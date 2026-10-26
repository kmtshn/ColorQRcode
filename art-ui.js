/* UI for the local optical-message experiment. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id),A=window.ArtMessage;
 const canvas=$('artCanvas'),source=document.createElement('canvas');A.flower(source);
 let art=A.makeArtwork(source),packets=A.encode($('message').value),sendTimer=null,step=0,demoToken=0;
 let stream=null,receiveTimer=null,generation=0,lastVideoTime=-1,lastText=null,uploadURL=null,uploadGeneration=0;
 const receiver=A.createReceiver(),video=$('artVideo');
 function status(id,text,error=false){$(id).textContent=text;$(id).classList.toggle('error',error);}
 function count(){const n=new TextEncoder().encode($('message').value).length;$('byteCount').textContent=n;$('byteCount').style.color=n>A.MAX_BYTES?'#a33':'';return n;}
 function preview(){A.render(canvas,art,packets[0],null,Number($('strength').value));}
 function stopSend(){if(sendTimer!==null)clearInterval(sendTimer);sendTimer=null;$('startSend').disabled=false;$('stopSend').disabled=true;$('frameStatus').textContent='静止プレビュー';preview();}
 function freezeInput(){stopSend();demoToken++;status('sendStatus','内容を変更しました。送信を始めると新しい内容へ切り替わります。');}
 function prepare(){if(!count())throw Error('メッセージを入力してください。');packets=A.encode($('message').value);return packets;}
 $('message').addEventListener('input',()=>{count();freezeInput();});
 $('strength').addEventListener('input',()=>{$('strengthValue').textContent=$('strength').value;freezeInput();preview();});
 $('theme').addEventListener('change',()=>{freezeInput();uploadGeneration++;if(uploadURL)URL.revokeObjectURL(uploadURL);uploadURL=null;$('imageFile').value='';A.flower(source,$('theme').value);art=A.makeArtwork(source);preview();});
 $('imageFile').addEventListener('change',()=>{
  freezeInput();const file=$('imageFile').files[0],token=++uploadGeneration;if(!file)return;
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8*1024*1024){status('sendStatus','PNG・JPEG・WebPの8MB以下の画像を選んでください。',true);return;}
  if(uploadURL)URL.revokeObjectURL(uploadURL);const url=URL.createObjectURL(file);uploadURL=url;const image=new Image();
  image.onload=()=>{try{if(token!==uploadGeneration)return;if(image.naturalWidth*image.naturalHeight>24000000)throw Error('画像が大きすぎます。2400万画素以下にしてください。');art=A.makeArtwork(image);preview();status('sendStatus','この端末内で画像を読み込みました。');}catch(e){status('sendStatus',e.message,true);}finally{URL.revokeObjectURL(url);if(uploadURL===url)uploadURL=null;}};
  image.onerror=()=>{URL.revokeObjectURL(url);if(uploadURL===url)uploadURL=null;if(token===uploadGeneration)status('sendStatus','画像を読み込めませんでした。',true);};image.src=url;
 });
 $('startSend').addEventListener('click',()=>{
  try{stopReceive();stopSend();demoToken++;prepare();step=0;
   const show=()=>{const index=Math.floor(step/2)%packets.length,phase=step%2;A.render(canvas,art,packets[index],phase,Number($('strength').value));$('frameStatus').textContent=`断片 ${index+1} / ${packets.length}・${phase?'B':'A'}表示`;step++;};
   show();sendTimer=setInterval(show,600);$('startSend').disabled=true;$('stopSend').disabled=false;status('sendStatus','送信中です。別の端末のカメラで四隅を写してください。');
  }catch(e){status('sendStatus',e.message,true);}
 });
 $('stopSend').addEventListener('click',()=>{stopSend();status('sendStatus','送信を停止しました。');});
 $('fullscreen').addEventListener('click',async()=>{try{if(!$('stage').requestFullscreen)throw Error('このブラウザーでは全画面表示に対応していません。');await $('stage').requestFullscreen();}catch(e){status('sendStatus',e.message,true);}});
 $('localDemo').addEventListener('click',async()=>{
  stopSend();stopReceive();const token=++demoToken;
  try{prepare();const test=A.createReceiver(),frame=document.createElement('canvas');$('demoResult').textContent='';status('demoStatus','表示画像の対から復元しています…');
   let result;
   for(let i=packets.length-1;i>=0;i--)for(const phase of [1,0]){
    if(token!==demoToken)return;A.render(frame,art,packets[i],phase,Number($('strength').value));result=test.ingest(frame,performance.now());
    await new Promise(r=>setTimeout(r,20));
   }
   if(token!==demoToken)return;
   if(result?.text===undefined)throw Error('この絵と強さでは復元できませんでした。変化を強くするか、別の絵を試してください。');
   $('demoResult').textContent=result.text;status('demoStatus',`復元しました（${result.total}断片・全体CRC検証済み）。カメラを使わないローカル試験です。`);
  }catch(e){if(token===demoToken)status('demoStatus',e.message,true);}
 });
 function drawOverlay(result){
  const overlay=$('overlay'),r=video.getBoundingClientRect();overlay.width=Math.max(1,Math.round(r.width));overlay.height=Math.max(1,Math.round(r.height));
  const c=overlay.getContext('2d');if(!result.corners||!video.videoWidth)return;
  const scale=Math.max(overlay.width/video.videoWidth,overlay.height/video.videoHeight),ox=(overlay.width-video.videoWidth*scale)/2,oy=(overlay.height-video.videoHeight*scale)/2;
  c.strokeStyle=result.text!==undefined?'#8af2b0':'#e8d49b';c.lineWidth=2;c.beginPath();result.corners.forEach((p,i)=>{const x=p.x*scale+ox,y=p.y*scale+oy;i?c.lineTo(x,y):c.moveTo(x,y);});c.closePath();c.stroke();
 }
 function stopReceive(){generation++;if(receiveTimer!==null)clearTimeout(receiveTimer);receiveTimer=null;if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;lastVideoTime=-1;receiver.reset();$('startReceive').disabled=false;$('stopReceive').disabled=true;}
 $('startReceive').addEventListener('click',async()=>{
  stopSend();demoToken++;stopReceive();const token=generation;$('startReceive').disabled=true;$('stopReceive').disabled=false;
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw Error('カメラを利用できません。HTTPSで開いてください。');
   const incoming=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:1280}}});
   if(token!==generation){incoming.getTracks().forEach(t=>t.stop());return;}
   stream=incoming;video.srcObject=stream;await video.play();if(token!==generation)return;$('stopReceive').disabled=false;status('receiveStatus','四隅の目印を探しています。送信中の絵を写してください。');
   const scan=()=>{if(token!==generation)return;
    try{if(video.readyState>=2&&video.currentTime!==lastVideoTime){lastVideoTime=video.currentTime;const result=receiver.ingest(video);drawOverlay(result);
      $('diagnostics').textContent=`目印 ${result.markers||0}個・${(result.ms||0).toFixed(1)}ms・${result.reason}`;
      $('progress').max=result.total||1;$('progress').value=result.received||0;$('progressText').textContent=`${result.received||0} / ${result.total||'?'} 個の断片を受信`;
      if(result.text!==undefined){if(result.text!==lastText){lastText=result.text;$('receivedText').textContent=result.text;$('copyMessage').disabled=false;}status('receiveStatus','絵からメッセージを復元しました。全体CRCを検証済みです。');}
      else if(lastText===null)status('receiveStatus',result.reason);
    }}catch(e){status('receiveStatus','画像処理に失敗しました: '+e.message,true);}
    receiveTimer=setTimeout(scan,100);
   };scan();
  }catch(e){if(token===generation){stopReceive();status('receiveStatus','カメラを起動できませんでした: '+e.message,true);}}
 });
 $('stopReceive').addEventListener('click',()=>{stopReceive();status('receiveStatus','カメラを停止しました。');});
 $('clearReceive').addEventListener('click',()=>{receiver.reset();lastText=null;$('receivedText').textContent='まだ受信していません。';$('copyMessage').disabled=true;$('progress').value=0;$('progressText').textContent='0 個の断片を受信';status('receiveStatus',stream?'受信をクリアしました。四隅を写してください。':'受信をクリアしました。カメラは停止しています。');});
 $('copyMessage').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('receivedText').textContent);status('receiveStatus','コピーしました。');}catch{status('receiveStatus','コピーできませんでした。表示された文章を選択してください。',true);}});
 function tab(receive){stopSend();stopReceive();demoToken++;$('sendPanel').hidden=receive;$('receivePanel').hidden=!receive;$('sendTab').setAttribute('aria-selected',String(!receive));$('receiveTab').setAttribute('aria-selected',String(receive));$('sendTab').tabIndex=receive?-1:0;$('receiveTab').tabIndex=receive?0:-1;}
 $('sendTab').addEventListener('click',()=>tab(false));$('receiveTab').addEventListener('click',()=>tab(true));
 for(const id of ['sendTab','receiveTab'])$(id).addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const receive=e.key==='End'||(e.key!=='Home'&&id==='sendTab');tab(receive);$(receive?'receiveTab':'sendTab').focus();});
 function suspend(){stopSend();stopReceive();demoToken++;status('sendStatus','停止中です。送信を再開するには開始ボタンを押してください。');status('receiveStatus','カメラは停止しています。');}
 window.addEventListener('message',e=>{if(e.source===parent&&e.origin===location.origin&&e.data?.type==='art-suspend')suspend();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend();});window.addEventListener('pagehide',()=>{suspend();if(uploadURL)URL.revokeObjectURL(uploadURL);});
 count();preview();
 if(window.ResizeObserver)new ResizeObserver(()=>parent.postMessage({type:'art-height',height:Math.ceil(document.body.getBoundingClientRect().height)},location.origin)).observe(document.body);
})();
