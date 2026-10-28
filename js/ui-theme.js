
/* ===== v2.2: Tema ===== */
(function(){
const K='FX_QUANT_THEME',T=[['dark','Gelap'],['light','Terang'],['amoled','AMOLED Hitam'],['paper','Kertas (krem)'],['contrast','Kontras Tinggi'],['auto','Otomatis (ikuti sistem)']];
const sel=document.getElementById('th-sel');sel.innerHTML=T.map(t=>`<option value="${t[0]}">${t[1]}</option>`).join('');
const cur=()=>document.documentElement.dataset.theme||'dark';sel.value=cur();
window.setTheme=p=>{applyTheme(p);try{localStorage.setItem(K,p)}catch(e){}sel.value=p;
  const el=document.getElementById('toast');el.textContent='Tema: '+T.find(t=>t[0]===p)[1];el.className='show';clearTimeout(window._thT);window._thT=setTimeout(()=>el.className='',1800)};
window.cycleTheme=()=>setTheme(T[(T.findIndex(t=>t[0]===cur())+1)%T.length][0]);
document.addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.ctrlKey||e.metaKey)return;if(e.key==='t'||e.key==='T')cycleTheme()});
})();
