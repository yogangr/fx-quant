/* Setor / Tarik saldo (UI) */
(function () {
const g = id => document.getElementById(id), $$ = v => fmtUSD(v);
let msgT;
function msg(t, good) { const m = g('cash-msg'); m.textContent = t; m.className = 'text-[11px] ' + (good ? 'text-emerald-400' : 'text-rose-400'); }
function render() {
    const m = getAccountMetrics(), P = ownPerformance();
    g('cash-info').innerHTML = [['SALDO', $$(state.balance)], ['FREE MARGIN', $$(m.freeMargin)], ['MAKS. TARIK', $$(maxWithdrawable())]]
        .map(x => `<div class="bg-[#070b14] border border-slate-800 rounded p-2"><div class="text-[9px] text-slate-500">${x[0]}</div><div class="font-bold text-white">${x[1]}</div></div>`).join('');
    g('cash-perf').textContent = `Modal masuk ${$$(P.invested)} · Ditarik ${$$(P.withdrawn)} · P/L ${P.profit >= 0 ? '+' : ''}${$$(P.profit)} (${P.roi.toFixed(2)}%)`;
    g('cash-ledger').innerHTML = (state.ledger || []).map(r => `<tr><td class="py-1 pr-2 text-slate-500">${new Date(r.time).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td><td class="${r.type === 'DEPOSIT' ? 'text-emerald-400' : 'text-rose-400'}">${r.type === 'DEPOSIT' ? 'Setor' : 'Tarik'}</td><td class="text-right">${r.type === 'DEPOSIT' ? '+' : '-'}${$$(r.amount)}</td><td class="text-right text-slate-400">${$$(r.balance)}</td></tr>`).join('')
        || '<tr><td colspan="4" class="py-3 text-center text-slate-500">Belum ada setoran/penarikan.</td></tr>';
}
window.openCash = () => {
    if (state.tierIndex !== OWN_TIER_INDEX) { openAcct(); return; }
    g('cash-presets').innerHTML = [100, 500, 1000, 5000].map(v => `<button class="fb" onclick="document.getElementById('cash-amt').value=${v}">${$$(v).replace('.00', '')}</button>`).join('')
        + '<button class="fb" onclick="document.getElementById(\'cash-amt\').value=maxWithdrawable()">Maks. tarik</button>';
    g('cash-amt').value = ''; msg('', true); render(); g('cash-modal').classList.remove('hidden');
};
const act = fn => () => { const r = fn(g('cash-amt').value); msg(r.msg, r.ok); if (r.ok) { g('cash-amt').value = ''; renderAll(); } render(); };
window.doDeposit = act(depositFunds);
window.doWithdraw = act(withdrawFunds);
})();
