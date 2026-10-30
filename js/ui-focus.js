
/* ===== v2.1: 1-Klik Trading, Mode Fokus (MT5), Layar Penuh, Responsif ===== */
(function(){
const g=id=>document.getElementById(id),UI_KEY='FX_QUANT_UI_V1',fmt=(v,d)=>Number(v).toFixed(d);
const ui={oneClick:true,autoSLTP:'off',focus:false,posCollapsed:false};
try{Object.assign(ui,JSON.parse(localStorage.getItem(UI_KEY)||'{}'))}catch(e){}
const save=()=>{try{localStorage.setItem(UI_KEY,JSON.stringify(ui))}catch(e){}};
let toastT,fpSig='',levKey='',pendSide=null;

function toast(m,t){const el=g('toast');el.textContent=String(m).replace(/<[^>]+>/g,'');el.className='show '+(t==='SL'?'t-bad':t==='TP'?'t-good':'');clearTimeout(toastT);toastT=setTimeout(()=>el.className='',3200)}
window.uiOnLog=function(m,t){if(['LONG','SHORT','TP','SL','PENDING'].includes(t))toast(m,t)};

const lotStep=()=>0.01;
window.ocLot=d=>{const el=g('input-order-size');el.value=Math.max(lotStep(),+((Number(el.value)||0)+d*lotStep()).toFixed(2));updateOrderPreview()};
window.ocLotSet=v=>{const n=parseFloat(v);if(n>0){g('input-order-size').value=n;updateOrderPreview()}};
window.ocLev=v=>{g('slider-leverage').value=v;onLeverageChange(v)};
window.toggleOcPop=()=>g('oc-pop').classList.toggle('hidden');
window.setUI=(k,v)=>{ui[k]=v;save()};

function doOneClick(side){
  g('oc-confirm').classList.add('hidden');
  const prev=currentOrderMode,f=['input-sl','input-tp','input-trail'].map(g),old=f.map(e=>e.value);
  currentOrderMode='MARKET';f.forEach(e=>e.value='');
  try{if(ui.autoSLTP!=='off'){const[a,b]=ui.autoSLTP.split(':').map(Number);applyQuickSLTP(side,a,b)}executeOrder(side)}
  finally{currentOrderMode=prev;f.forEach((e,i)=>{if(ui.autoSLTP==='off')e.value=old[i]});}
}
window.oneClick=side=>{
  if(ui.oneClick){doOneClick(side);return}
  pendSide=side;const c=PAIR_CONFIGS[state.activePair],{bid,ask}=getBidAsk(state.activePair);
  g('oc-cf-txt').textContent=`${side==='LONG'?'BUY':'SELL'} ${g('input-order-size').value} lot ${c.name} @ ${fmt(side==='LONG'?ask:bid,c.decimals)}`;
  g('oc-confirm').classList.remove('hidden');
};
window.ocConfirm=ok=>{g('oc-confirm').classList.add('hidden');if(ok&&pendSide)doOneClick(pendSide);pendSide=null};

function applyUI(){
  document.body.classList.toggle('focus-mode',ui.focus);
  g('oc-chk').checked=ui.oneClick;g('oc-sltp').value=ui.autoSLTP;g('fpos').classList.toggle('collapsed',ui.posCollapsed);
  g('oc-pop').classList.add('hidden');requestAnimationFrame(()=>renderCandlestickChart());
}
window.toggleFocus=()=>{ui.focus=!ui.focus;save();applyUI()};
window.toggleFocusPos=()=>{ui.posCollapsed=!ui.posCollapsed;save();applyUI()};
window.focusClose=(id,fr)=>closePositionById(id,fr<1?'PARTIAL':'MANUAL',fr);

window.toggleFullscreen=()=>{
  const d=document,e=d.documentElement;
  try{
    if(d.fullscreenElement||d.webkitFullscreenElement){(d.exitFullscreen||d.webkitExitFullscreen).call(d);return}
    const r=e.requestFullscreen||e.webkitRequestFullscreen;
    if(!r){toast('Browser ini tidak mendukung layar penuh. Di iPhone: Share → Tambah ke Layar Utama.');return}
    const p=r.call(e);if(p&&p.catch)p.catch(()=>toast('Layar penuh diblokir oleh browser.'));
  }catch(x){toast('Layar penuh tidak tersedia.')}
};
function syncFs(){const on=!!(document.fullscreenElement||document.webkitFullscreenElement);document.querySelectorAll('.fs-ic').forEach(i=>i.className='fs-ic fa-solid '+(on?'fa-compress':'fa-expand'));requestAnimationFrame(()=>renderCandlestickChart())}
['fullscreenchange','webkitfullscreenchange'].forEach(ev=>document.addEventListener(ev,syncFs));
document.addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.ctrlKey||e.metaKey)return;if(e.key==='f'||e.key==='F')toggleFullscreen();if(e.key==='m'||e.key==='M')toggleFocus()});

function renderFocusPos(){
  const m=getAccountMetrics(),P=state.positions,O=state.pendingOrders||[];
  const sig=P.map(p=>[p.id,p.size,p.stopLoss,p.takeProfit].join(':')).join(',')+'|'+O.map(o=>[o.id,o.triggerPrice,o.size].join(':')).join(',');
  if(sig!==fpSig){fpSig=sig;
    g('fp-body').innerHTML=P.map(p=>{const d=PAIR_CONFIGS[p.pair].decimals;return `<tr><td>${p.pair}</td><td class="${p.side==='LONG'?'t-buy':'t-sell'}">${p.side==='LONG'?'buy':'sell'}</td><td>${fmtLot(p.pair,p.size)}</td><td>${fmt(p.entryPrice,d)}</td><td class="hs">${p.stopLoss?fmt(p.stopLoss,d):'—'}</td><td class="hs">${p.takeProfit?fmt(p.takeProfit,d):'—'}</td><td id="fpx-${p.id}"></td><td id="fpl-${p.id}"></td><td class="act"><button onclick="focusClose(${p.id},.5)" title="Tutup 50%">½</button><button onclick="focusClose(${p.id},1)" title="Tutup posisi">✕</button></td></tr>`}).join('')
    +O.map(o=>{const d=PAIR_CONFIGS[o.pair].decimals;return `<tr><td>${o.pair}</td><td class="t-pend">${o.orderType.toLowerCase()}</td><td>${fmtLot(o.pair,o.size)}</td><td>${fmt(o.triggerPrice,d)}</td><td class="hs">${o.stopLoss||'—'}</td><td class="hs">${o.takeProfit||'—'}</td><td>—</td><td class="t-pend">pending</td><td class="act"><button onclick="cancelPendingOrder(${o.id})">✕</button></td></tr>`}).join('')
    ||'<tr><td colspan="9" class="empty">Belum ada posisi terbuka</td></tr>';
  }
  P.forEach(p=>{const x=g('fpx-'+p.id),l=g('fpl-'+p.id);if(!x)return;const{bid,ask}=getBidAsk(p.pair),pnl=calculatePositionPnL(p);x.textContent=fmt(p.side==='LONG'?bid:ask,PAIR_CONFIGS[p.pair].decimals);l.textContent=(pnl>=0?'+':'')+pnl.toFixed(2);l.className=pnl>=0?'t-buy':'t-sell'});
  g('fp-sum').textContent=P.length+' posisi'+(O.length?' · '+O.length+' pending':'');
  const f=g('fp-pnl');f.textContent=(m.floatingPnL>=0?'+':'')+fmtUSD(m.floatingPnL);f.className=m.floatingPnL>=0?'t-buy':'t-sell';
  g('fp-eq').textContent=fmtUSD(m.equity);g('fp-ml').textContent=isFinite(m.marginLevel)?m.marginLevel.toFixed(0)+'%':'∞';
}
function syncUI(){
  const id=state.activePair,c=PAIR_CONFIGS[id],{bid,ask}=getBidAsk(id),cur=g('slider-leverage').value;
  g('oc-bid').textContent=fmt(bid,c.decimals);g('oc-ask').textContent=fmt(ask,c.decimals);g('oc-unit').textContent='LOT';
  const l=g('oc-lot');if(document.activeElement!==l)l.value=g('input-order-size').value;
  if(levKey!==id+cur){levKey=id+cur;g('oc-lev').innerHTML=[...new Set([...c.presetLeverages,+cur])].sort((a,b)=>a-b).map(v=>`<option value="${v}">1:${v}</option>`).join('');g('oc-lev').value=cur}
  ['XAUUSD','BTCUSD'].forEach(p=>{g('fp-'+p).className='fb'+(p===id?' on':'');g('fp-px-'+p).textContent=state.markets[p].price.toLocaleString('en-US',{maximumFractionDigits:2})});
  ['M1','M5','M15','H1'].forEach(t=>g('ftf-'+t).className='fb'+(t===activeTimeframe?' on':''));
  g('fspd').value=String(simSpeed);
  renderFocusPos();
}
window.uiSyncOrder=function(){try{syncUI()}catch(e){}};
window.uiSyncSpeed=function(){try{g('fspd').value=String(simSpeed)}catch(e){}};

/* Responsif: chart ikut ukuran container + sentuhan (geser & cubit) */
const cv=g('trading-canvas');
if(window.ResizeObserver)new ResizeObserver(()=>requestAnimationFrame(()=>renderCandlestickChart())).observe(g('chart-container'));


(window.__ui=window.__ui||[]).push(()=>{applyUI();syncFs()});
})();
