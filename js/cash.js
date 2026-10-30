/* Setor & tarik saldo (khusus mode Modal Sendiri) + performa yang adil terhadap arus kas */
const CASH_MAX_TOTAL = 1e9;
const isOwnAccount = () => state.tierIndex === OWN_TIER_INDEX;
const ownInvested = () => (state.ownStart || 0) + (state.deposited || 0);

/* Profit sebenarnya = equity + total ditarik - total modal masuk. Setoran/penarikan tidak mengubah ROI. */
function ownPerformance() {
    const invested = ownInvested(), withdrawn = state.withdrawn || 0, profit = getAccountMetrics().equity + withdrawn - invested;
    return { invested, withdrawn, profit, roi: invested ? profit / invested * 100 : 0 };
}
/* Hanya saldo bebas yang bisa ditarik: bukan margin terpakai dan bukan profit mengambang */
function maxWithdrawable() {
    if (!isOwnAccount()) return 0;
    return Math.max(0, Math.floor(Math.min(state.balance, getAccountMetrics().freeMargin) * 100) / 100);
}
function recordCash(type, amount) {
    (state.ledger = state.ledger || []).unshift({ time: Date.now(), tick: state.tickCount, type, amount, balance: Number(state.balance.toFixed(2)) });
    if (state.ledger.length > 200) state.ledger.length = 200;
}
function depositFunds(raw) {
    if (!isOwnAccount()) return { ok: false, msg: 'Setor/tarik hanya tersedia di mode Modal Sendiri.' };
    const a = Math.round(Number(raw) * 100) / 100;
    if (!(a >= 1)) return { ok: false, msg: 'Jumlah minimal $1.' };
    if (ownInvested() + a > CASH_MAX_TOTAL) return { ok: false, msg: 'Total modal melebihi batas $1.000.000.000.' };
    state.balance += a; state.deposited = (state.deposited || 0) + a; recordCash('DEPOSIT', a);
    addLog(`SETOR <b>${fmtUSD(a)}</b> ke akun modal sendiri.`, 'INFO'); saveGameState();
    return { ok: true, msg: `Setor ${fmtUSD(a)} berhasil.` };
}
function withdrawFunds(raw) {
    if (!isOwnAccount()) return { ok: false, msg: 'Setor/tarik hanya tersedia di mode Modal Sendiri.' };
    const a = Math.round(Number(raw) * 100) / 100, max = maxWithdrawable();
    if (!(a >= 1)) return { ok: false, msg: 'Jumlah minimal $1.' };
    if (a > max) return { ok: false, msg: `Maksimal ${fmtUSD(max)} (margin terpakai & profit yang belum terealisasi tidak bisa ditarik).` };
    state.balance -= a; state.withdrawn = (state.withdrawn || 0) + a; recordCash('WITHDRAW', a);
    addLog(`TARIK <b>${fmtUSD(a)}</b> dari akun modal sendiri.`, 'INFO'); saveGameState();
    return { ok: true, msg: `Tarik ${fmtUSD(a)} berhasil.` };
}
