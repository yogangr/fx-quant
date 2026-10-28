/* Tes engine: dijalankan di Node (run-node.js) dan di browser (tests/index.html) */
const __T = [];
function test(name, fn) { __T.push([name, fn]); }
function ok(c, m) { if (!c) throw new Error(m || 'assertion gagal'); }
function eq(a, b, m) { if (a !== b) throw new Error((m || '') + ` diharapkan ${b}, didapat ${a}`); }
function near(a, b, tol, m) { if (!(Math.abs(a - b) <= (tol === undefined ? 0.01 : tol))) throw new Error((m || '') + ` diharapkan ≈${b}, didapat ${a}`); }
function fresh(own, bal) {
    state = createFreshState('TEST-SEED');
    if (own) { state.tierIndex = OWN_TIER_INDEX; state.ownStart = bal || 10000; state.balance = state.ownStart; }
    ['input-sl', 'input-tp', 'input-trail', 'input-limit-price'].forEach(id => { __el(id).value = ''; });
    __el('slider-leverage').value = 20; __el('input-order-size').value = '0.1';
    currentOrderMode = 'MARKET'; state.activePair = 'XAUUSD';
}
function addPos(o) {
    const p = Object.assign({ id: state.nextPosId++, pair: 'XAUUSD', side: 'LONG', entryPrice: state.markets.XAUUSD.price, size: 10, leverage: 100, stopLoss: null, takeProfit: null, trailingDistance: 0 }, o);
    if (p.margin === undefined) p.margin = p.size * p.entryPrice / p.leverage;
    state.positions.push(p); return p;
}
const shiftPrice = (d, pair = 'XAUUSD') => { state.markets[pair].price += d; };

test('lot <-> unit (MT5: 1 lot XAU = 100 oz, 1 lot BTC = 1 BTC)', () => {
    eq(lotsToUnits('XAUUSD', 0.1), 10); eq(unitsToLots('XAUUSD', 250), 2.5); eq(lotsToUnits('BTCUSD', 0.1), 0.1); eq(fmtLot('XAUUSD', 2), '0.02');
});
test('input lot dibulatkan 0.01 dan tidak boleh di bawah minimum', () => {
    fresh(); const i = __el('input-order-size');
    i.value = '0.005'; eq(readOrderUnits('XAUUSD'), 1); i.value = '0.037'; eq(readOrderUnits('XAUUSD'), 4);
    i.value = ''; eq(readOrderUnits('XAUUSD'), PAIR_CONFIGS.XAUUSD.defaultSize);
});
test('PnL long & short', () => {
    fresh(); const l = { pair: 'XAUUSD', side: 'LONG', entryPrice: 2600, size: 10 }, s = { ...l, side: 'SHORT' };
    near(calculatePositionPnL(l, 2610), 100); near(calculatePositionPnL(l, 2590), -100);
    near(calculatePositionPnL(s, 2590), 100); near(calculatePositionPnL(s, 2610), -100);
});
test('metrik akun: equity, free margin, margin level konsisten', () => {
    fresh(); const p = addPos({ size: 10, leverage: 20 }); shiftPrice(-8);
    const m = getAccountMetrics(), used = p.margin, pnl = calculatePositionPnL(p);
    near(m.floatingPnL, pnl); near(m.equity, state.balance + pnl); near(m.freeMargin, m.equity - used); near(m.marginLevel, m.equity / used * 100, 0.01);
});
test('order market: volume lot -> unit, margin = nilai kontrak / leverage', () => {
    fresh(); executeOrder('LONG'); eq(state.positions.length, 1); const p = state.positions[0];
    eq(p.size, 10); near(p.margin, p.size * p.entryPrice / 20, 0.05);
});
test('order ditolak bila margin tidak cukup', () => {
    fresh(); __el('input-order-size').value = '5'; executeOrder('LONG'); eq(state.positions.length, 0);
});
test('Stop Loss menutup posisi & tercatat di riwayat', () => {
    fresh(true); const p = addPos({ size: 10 }); p.stopLoss = p.entryPrice - 5; shiftPrice(-20); evaluateOpenPositions();
    eq(state.positions.length, 0); const h = state.history[0]; eq(h.reason, 'SL'); ok(h.pnl < 0, 'pnl harus negatif'); near(h.pnl, state.realizedPnL, 0.01); eq(state.totalTrades, 1);
});
test('Take Profit menutup posisi, menaikkan wins', () => {
    fresh(true); const p = addPos({ size: 10 }); p.takeProfit = p.entryPrice + 5; shiftPrice(20); evaluateOpenPositions();
    eq(state.positions.length, 0); eq(state.history[0].reason, 'TP'); ok(state.history[0].pnl > 0); eq(state.wins, 1);
});
test('tutup parsial: ukuran & PnL terbagi tepat, tidak dihitung trade selesai', () => {
    fresh(); const p = addPos({ size: 4, leverage: 20 }); shiftPrice(10); closePositionById(p.id, 'PARTIAL', 0.5);
    eq(state.positions[0].size, 2); const h = state.history[0]; eq(h.partial, true); eq(h.size, 2);
    near(h.pnl, calculatePositionPnL(state.positions[0]), 0.02); eq(state.totalTrades, 0);
});
test('margin call melikuidasi semua posisi dan mencatat riwayat (mode modal sendiri)', () => {
    fresh(true, 10000); addPos({ size: 250, leverage: 100 }); shiftPrice(-30); evaluateOpenPositions();
    eq(state.positions.length, 0); eq(state.history.length, 1); eq(state.history[0].reason, 'MARGIN CALL'); ok(state.history[0].pnl < -7000);
    eq(state.totalTrades, 1); ok(state.balance > 0 && state.balance < 4000, 'saldo = sisa equity'); eq(state.tierIndex, OWN_TIER_INDEX);
});
test('pelanggaran max drawdown prop me-reset akun & tercatat', () => {
    fresh(); addPos({ size: 100, leverage: 100 }); shiftPrice(-15); evaluateOpenPositions();
    eq(state.positions.length, 0); eq(state.history[0].reason, 'DRAWDOWN'); eq(state.balance, PROP_TIERS[0].startBalance); eq(state.tierIndex, 0);
});
test('mode modal sendiri: tidak ada naik tier / drawdown prop', () => {
    fresh(true, 1000); state.balance = 1e6; evaluateOpenPositions(); eq(state.tierIndex, OWN_TIER_INDEX); eq(state.balance, 1e6);
});
test('seed deterministik', () => {
    const a = JSON.stringify(createFreshState('A').markets.XAUUSD.candles.slice(0, 5)), b = JSON.stringify(createFreshState('A').markets.XAUUSD.candles.slice(0, 5)), c = JSON.stringify(createFreshState('B').markets.XAUUSD.candles.slice(0, 5));
    eq(a, b); ok(a !== c, 'seed berbeda harus beda');
});
test('statistik trade & kodek tautan bagikan', () => {
    const st = tradeStats([{ pnl: 100 }, { pnl: -50 }, { pnl: 50 }]); eq(st.n, 3); eq(st.wins, 2); near(st.winRate, 66.67, 0.01); near(st.net, 100); near(st.pf, 3);
    const d = { v: 1, seed: 'QUANT-2026', mode: 'own', start: 1000, equity: 1234.5, roi: 23.45, n: 7, wr: 57.1, pf: 1.8, net: 234.5, tick: 99 };
    eq(JSON.stringify(decodeShare(encodeShare(d))), JSON.stringify(d)); eq(decodeShare('bukan-base64!!'), null);
    eq(decodeShare(encodeShare({ ...d, seed: '<img onerror=x>' })), null);
});
function runAll() {
    const results = __T.map(([n, f]) => { try { f(); return { n, ok: true }; } catch (e) { return { n, ok: false, err: e.message }; } });
    return { results, passed: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length };
}
