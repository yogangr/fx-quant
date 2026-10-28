/* Bagikan hasil: tautan (#r=...) + kartu gambar PNG. Semua dilakukan di browser. */
(function () {
const g = id => document.getElementById(id), fmt$ = v => Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function snapshot() {
    const T = getTier(), m = getAccountMetrics(), st = tradeStats(state.history || []);
    return { v: 1, seed: state.seed, mode: state.tierIndex === OWN_TIER_INDEX ? 'own' : 'prop', start: T.startBalance,
        equity: +m.equity.toFixed(2), roi: +((m.equity - T.startBalance) / T.startBalance * 100).toFixed(2), n: st.n,
        wr: +st.winRate.toFixed(1), pf: Number.isFinite(st.pf) ? +st.pf.toFixed(2) : null, net: +st.net.toFixed(2), tick: state.tickCount };
}
const link = () => location.href.split('#')[0] + '#r=' + encodeShare(snapshot());
function draw(c, d) {
    c.width = 1080; c.height = 566; const x = c.getContext('2d');
    const gr = x.createLinearGradient(0, 0, 1080, 566); gr.addColorStop(0, '#0b1120'); gr.addColorStop(1, '#10302c'); x.fillStyle = gr; x.fillRect(0, 0, 1080, 566);
    x.fillStyle = '#34d399'; x.font = 'bold 30px monospace'; x.fillText('FX-QUANT  //  ' + (d.mode === 'own' ? 'MODAL SENDIRI' : 'PROP-FIRM'), 48, 70);
    x.fillStyle = '#94a3b8'; x.font = '22px monospace'; x.fillText('Seed: ' + d.seed + '   ·   ' + d.tick + ' tick', 48, 108);
    const up = d.roi >= 0; x.fillStyle = up ? '#34d399' : '#fb7185'; x.font = 'bold 120px monospace'; x.fillText((up ? '+' : '') + d.roi.toFixed(2) + '%', 48, 250);
    x.fillStyle = '#e2e8f0'; x.font = '26px monospace'; x.fillText('Equity $' + fmt$(d.equity) + '  (modal awal $' + fmt$(d.start) + ')', 48, 310);
    [['TRADE', d.n], ['WIN RATE', d.n ? d.wr + '%' : '-'], ['PROFIT FACTOR', d.pf == null ? (d.n ? '∞' : '-') : d.pf], ['NET PROFIT', (d.net >= 0 ? '+' : '-') + '$' + fmt$(Math.abs(d.net))]].forEach((c2, i) => {
        const cx = 48 + i * 250; x.fillStyle = '#64748b'; x.font = '18px monospace'; x.fillText(c2[0], cx, 400); x.fillStyle = '#fff'; x.font = 'bold 34px monospace'; x.fillText(String(c2[1]), cx, 448); });
    x.fillStyle = '#475569'; x.font = '18px monospace'; x.fillText('Coba kalahkan hasil ini dengan seed yang sama.', 48, 520);
}
const say = t => { g('sh-msg').textContent = t; };
window.openShare = () => { draw(g('sh-canvas'), snapshot()); g('sh-link').value = link(); g('share-modal').classList.remove('hidden'); };
window.copyShareLink = () => { const i = g('sh-link'); i.select(); (navigator.clipboard ? navigator.clipboard.writeText(i.value) : Promise.reject()).then(() => say('Tautan disalin.'), () => { document.execCommand('copy'); say('Tautan disalin.'); }); };
window.downloadShareImage = () => g('sh-canvas').toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'fx-quant-hasil.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); });
window.nativeShare = () => g('sh-canvas').toBlob(async b => {
    const d = snapshot(), f = new File([b], 'fx-quant-hasil.png', { type: 'image/png' }), t = 'FX-QUANT: ROI ' + d.roi + '% (seed ' + d.seed + ')';
    try { if (navigator.canShare && navigator.canShare({ files: [f] })) await navigator.share({ files: [f], title: 'FX-QUANT', text: t + '\n' + link() });
          else if (navigator.share) await navigator.share({ title: 'FX-QUANT', text: t, url: link() }); else downloadShareImage(); } catch (e) {}
});
window.useSharedSeed = () => { const s = window.__sharedSeed; closeModal('shared-modal'); if (s) { openSeedModal(); g('input-seed-str').value = s; } };
(window.__ui = window.__ui || []).push(() => {
    if (!location.hash.startsWith('#r=')) return;
    const d = decodeShare(location.hash.slice(3)); if (!d) return;
    window.__sharedSeed = d.seed;
    g('shd-body').textContent = '';
    [['Mode', d.mode === 'own' ? 'Modal Sendiri' : 'Prop-Firm'], ['Seed', d.seed], ['ROI', (d.roi >= 0 ? '+' : '') + d.roi + '%'], ['Equity', '$' + fmt$(d.equity)], ['Trade', d.n + ' (win rate ' + d.wr + '%)'], ['Net profit', '$' + fmt$(d.net)]].forEach(r => {
        const p = document.createElement('div'); p.textContent = r[0] + ': ' + r[1]; g('shd-body').appendChild(p); });
    g('shared-modal').classList.remove('hidden');
});
})();
