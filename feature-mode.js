/* Keep the original ColorQR app and experimental art receiver isolated. */
(() => {
 const frame=document.getElementById('artFrame');
 function select(art){
  window.dispatchEvent(new Event('colorqr-suspend'));
  if(frame.contentWindow)frame.contentWindow.postMessage({type:'art-suspend'},location.origin);
  if(art&&!frame.getAttribute('src'))frame.src=frame.dataset.src;
  document.getElementById('colorMain').hidden=art;document.getElementById('colorTabs').hidden=art;document.getElementById('artFeature').hidden=!art;
  document.getElementById('colorFeatureButton').setAttribute('aria-pressed',String(!art));document.getElementById('artFeatureButton').setAttribute('aria-pressed',String(art));
  document.body.classList.toggle('scan-mode',!art&&document.getElementById('panel-scan').classList.contains('active'));
 }
 document.getElementById('artFeatureButton').addEventListener('click',()=>select(true));
 document.getElementById('colorFeatureButton').addEventListener('click',()=>select(false));
 window.addEventListener('message',e=>{if(e.source!==frame.contentWindow||e.origin!==location.origin||e.data?.type!=='art-height')return;const h=e.data.height;if(Number.isFinite(h))frame.style.height=Math.max(500,Math.min(12000,h))+'px';});
 window.addEventListener('DOMContentLoaded',()=>{if(new URLSearchParams(location.search).get('feature')==='art')select(true);});
})();
