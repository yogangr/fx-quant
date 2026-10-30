
/* ===== v2.3: Riwayat Trading + Mode Modal Sendiri ===== */
(function(){
const g=id=>document.getElementById(id),$$=(a,b)=>fmtUSD(a,b);
let tT;const say=m=>{const e=g('toast');e.textContent=m;e.className='show';clearTimeout(tT);tT=setTimeout(()=>e.className='',2600)};
const OWN=OWN_TIER,isOwn=()=>state.tierIndex===OWN_TIER_INDEX;
window.closeModal=id=>g(id).classList.add('hidden');

/* --- Ganti mode akun (akun lain tetap tersimpan) --- */
const FLD=['tierIndex','balance','wallet','realizedPnL','wins','totalTrades','positions','pendingOrders','history','upgrades','quantBotActive','totalSwapPaid','deposited','withdrawn','ledger'];
function setAccount(m,bal){
  const cur=isOwn()?'own':'prop';state.acct=state.acct||{};
  if(m!==cur)state.acct[cur]=Object.fromEntries(FLD.map(k=>[k,state[k]]));
  const sv=m!==cur&&state.acct[m];
  if(sv){FLD.forEach(k=>state[k]=sv[k]);delete state.acct[m]}
  else{Object.assign(state,{balance:0,wallet:0,realizedPnL:0,wins:0,totalTrades:0,positions:[],pendingOrders:[],history:[],deposited:0,withdrawn:0,ledger:[],quantBotActive:false,totalSwapPaid:0,upgrades:{rawSpread:0,coLocation:0,macroIntel:0,quantBot:0,marginShield:0},tierIndex:m==='own'?4:0});
    if(m==='own'){state.ownStart=bal;state.balance=bal}else state.balance=PROP_TIERS[0].startBalance}
  saveGameState();renderAll();say(m==='own'?'Akun Modal Sendiri aktif: '+fmtUSD(OWN.startBalance,0):'Akun Prop-Firm aktif');
}
let pick='prop',armed=false;
const NOTE={prop:'Prop-Firm: capai target equity untuk naik tier, tetapi akun di-reset jika menyentuh batas max drawdown. Bagi hasil sesuai tier.',own:'Modal Sendiri: tanpa target & batas drawdown prop, profit 100% milikmu, tanpa bonus tier. Upgrade Lab Quant dibayar dari saldo. Akun Prop-Firm tetap tersimpan dan bisa dilanjutkan. Memulai akun modal sendiri baru akan menghapus akun modal sendiri & riwayatnya yang lama.'};
window.pickMode=m=>{pick=m;armed=false;g('am-prop').className='fb py-2'+(m==='prop'?' on':'');g('am-own').className='fb py-2'+(m==='own'?' on':'');
  g('am-own-box').classList.toggle('hidden',m!=='own');g('am-note').textContent=NOTE[m];g('am-apply').textContent='Terapkan'};
window.openAcct=()=>{g('am-cash').classList.toggle('hidden',!isOwn());g('am-bal').value=state.ownStart||1000;g('am-presets').innerHTML=[100,500,1000,5000,10000,100000].map(v=>`<button class="fb" onclick="document.getElementById('am-bal').value=${v}">${fmtUSD(v,0)}</button>`).join('');pickMode(isOwn()?'own':'prop');g('acct-modal').classList.remove('hidden')};
window.applyMode=()=>{
  const cur=isOwn()?'own':'prop';
  if(pick==='own'){const b=parseFloat(g('am-bal').value);if(!(b>=10&&b<=1e9)){say('Saldo awal harus antara $10 dan $1.000.000.000');return}
    if(cur==='own'&&!armed){armed=true;g('am-apply').textContent='Klik lagi: reset akun & riwayat dengan saldo ini';return}
    setAccount('own',b)}
  else if(cur!=='prop')setAccount('prop');
  closeModal('acct-modal');
};

/* --- Riwayat --- */
const RS={MANUAL:'Manual',SL:'Stop Loss',TP:'Take Profit',PARTIAL:'Parsial','MARGIN CALL':'Margin Call',DRAWDOWN:'Max Drawdown','TIER-UP':'Naik Tier',RESET:'Reset Akun'};
window.openHistory=()=>{g('h-clear').textContent='Hapus Riwayat';renderHistory();g('hist-modal').classList.remove('hidden')};
window.renderHistory=()=>{
  const f=g('h-filter').value,L=(state.history||[]).filter(h=>f==='all'||h.pair===f||(f==='win'&&h.pnl>0)||(f==='loss'&&h.pnl<=0));
  const sum=a=>a.reduce((s,h)=>s+h.pnl,0),W=L.filter(h=>h.pnl>0),Ls=L.filter(h=>h.pnl<=0),gp=sum(W),gl=Math.abs(sum(Ls)),net=sum(L);
  const pf=gl?(gp/gl).toFixed(2):(gp>0?'∞':'-'),pn=L.map(h=>h.pnl),c=v=>v>0?'text-emerald-400':v<0?'text-rose-400':'text-slate-300';
  g('h-mode').textContent=isOwn()?'MODAL SENDIRI':'PROP-FIRM';
  g('h-stats').innerHTML=[['TRADE',L.length,''],['WIN RATE',L.length?(W.length/L.length*100).toFixed(1)+'%':'-',''],['NET PROFIT',(net>=0?'+':'')+fmtUSD(net),c(net)],['PROFIT FACTOR',pf,''],['TERBAIK',L.length?'+'+fmtUSD(Math.max(...pn)):'-','text-emerald-400'],['TERBURUK',L.length?fmtUSD(Math.min(...pn)):'-','text-rose-400']]
    .map(x=>`<div class="bg-[#070b14] border border-slate-800 rounded p-2"><div class="text-[9px] text-slate-500">${x[0]}</div><div class="font-bold ${x[2]||'text-white'}">${x[1]}</div></div>`).join('');
  g('h-body').innerHTML=L.map(h=>{const d=PAIR_CONFIGS[h.pair].decimals;return `<tr><td class="py-1.5 px-2 text-slate-500 hidden sm:table-cell">${new Date(h.time).toLocaleString('id-ID',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</td><td class="px-2 text-white font-bold">${h.pair}</td><td class="px-2 ${h.side==='LONG'?'text-emerald-400':'text-rose-400'}">${h.side==='LONG'?'buy':'sell'}</td><td class="px-2 text-right">${fmtLot(h.pair,h.size)}</td><td class="px-2 text-right">${h.entry.toFixed(d)}</td><td class="px-2 text-right">${h.exit.toFixed(d)}</td><td class="px-2 text-right font-bold ${c(h.pnl)}">${h.pnl>=0?'+':''}${h.pnl.toFixed(2)}</td><td class="px-2 text-right text-slate-400">${h.partial&&h.reason==='PARTIAL'?'Parsial':(RS[h.reason]||h.reason)}</td></tr>`}).join('')||'<tr><td colspan="8" class="py-8 text-center text-slate-500">Belum ada transaksi yang ditutup.</td></tr>';
};
window.exportHistory=()=>{const H=state.history||[];if(!H.length){say('Riwayat kosong');return}
  const csv='waktu,pair,tipe,lot,open,close,profit,alasan\n'+H.map(h=>[new Date(h.time).toISOString(),h.pair,h.side==='LONG'?'buy':'sell',fmtLot(h.pair,h.size),h.entry,h.exit,h.pnl,h.reason].join(',')).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='riwayat-trading.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
window.clearHistory=()=>{const b=g('h-clear');if(b.textContent!=='Yakin? Klik lagi'){b.textContent='Yakin? Klik lagi';return}state.history=[];saveGameState();b.textContent='Hapus Riwayat';renderHistory()};

/* --- Sinkron tampilan KPI sesuai mode --- */
function modeSync(){
  const own=isOwn(),T=PROP_TIERS[state.tierIndex],tt=g('kpi-target-text'),lab=tt.parentElement.previousElementSibling.firstElementChild,rb=document.querySelector('button[onclick="resetPropChallenge()"]');
  g('btn-cash').classList.toggle('hidden',!own);const tb=g('tier-badge');tb.style.cursor='pointer';tb.onclick=openAcct;tb.title='Klik untuk ganti mode akun';
  lab.textContent=own?'MODAL SENDIRI':'TARGET LULUS TIER';rb.textContent=own?'[Reset Akun]':'[Reset Ujian]';
  if(!own){g('kpi-target-pct').className='text-emerald-400';return}
  const P=ownPerformance(),roi=P.roi;
  tt.textContent='Modal: '+fmtUSD(P.invested,0)+(P.withdrawn?' · Tarik '+fmtUSD(P.withdrawn,0):'');g('kpi-target-pct').textContent=(roi>=0?'+':'')+roi.toFixed(1)+'%';g('kpi-target-pct').className=roi>=0?'text-emerald-400':'text-rose-400';
  g('kpi-target-bar').style.width=Math.max(0,Math.min(100,roi))+'%';g('kpi-drawdown-floor').textContent='Tanpa batas drawdown prop';g('prop-split-label').textContent='Profit: 100% milikmu';
}
window.uiAfterRender=function(){try{modeSync()}catch(e){}};
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal('hist-modal');closeModal('acct-modal');return}
  if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.ctrlKey||e.metaKey)return;if(e.key==='h'||e.key==='H')openHistory()});

})();
