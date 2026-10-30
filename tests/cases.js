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
test('setor menambah saldo & modal; ledger tercatat', () => {
    fresh(true, 10000); const r = depositFunds(1000); ok(r.ok); eq(state.balance, 11000); eq(ownInvested(), 11000); eq(state.ledger[0].type, 'DEPOSIT'); eq(state.ledger[0].balance, 11000);
});
test('tarik dibatasi free margin & ditolak jika melebihi', () => {
    fresh(true, 10000); addPos({ size: 10, leverage: 20 }); shiftPrice(-100);
    const m = getAccountMetrics(); near(maxWithdrawable(), m.freeMargin, 0.01); ok(m.freeMargin < state.balance, 'free margin < saldo saat rugi mengambang');
    const bad = withdrawFunds(maxWithdrawable() + 1); eq(bad.ok, false); const good = withdrawFunds(1000); ok(good.ok); eq(state.balance, 9000);
});
test('setor/tarik ditolak di mode prop-firm & input tidak valid ditolak', () => {
    fresh(); eq(depositFunds(100).ok, false); eq(withdrawFunds(100).ok, false);
    fresh(true); eq(depositFunds(0).ok, false); eq(depositFunds(-5).ok, false); eq(depositFunds(NaN).ok, false); eq(withdrawFunds(0.5).ok, false); eq(state.balance, 10000);
});
test('performa modal sendiri: setor/tarik tidak mengubah ROI', () => {
    fresh(true, 10000); depositFunds(1000); withdrawFunds(500); const p = ownPerformance();
    near(p.profit, 0, 0.001); near(p.roi, 0, 0.001); eq(p.invested, 11000); eq(p.withdrawn, 500);
    state.balance += 1100; near(ownPerformance().roi, 10, 0.001, 'untung 1100 dari modal 11000');
});
test('jam pasar: 1 candle M1 = 60 tick (1 menit), tepat satu candle baru per 60 tick', () => {
    fresh(); const m = state.markets.XAUUSD, id0 = m.lastCandleId;
    for (let i = 0; i < 60; i++) stepSimulation(false); eq(m.lastCandleId, id0 + 1);
    for (let i = 0; i < 60; i++) stepSimulation(false); eq(m.lastCandleId, id0 + 2);
    eq(TF_SECONDS.M5, 5 * TICKS_PER_M1 * 1); ok(TICKS_PER_M1 === 60);
});
test('M5/M15/H1 = 5/15/60 candle M1 dengan batas tetap (tidak bergeser saat riwayat dipangkas)', () => {
    fresh(); const before = getAggregatedCandles('XAUUSD', 'M5'); for (let i = 0; i < 60; i++) stepSimulation(false); const after = getAggregatedCandles('XAUUSD', 'M5');
    ok(after.every((c, i) => i === 0 || (c.id - 1) % 5 === 0), 'id awal bucket M5 harus kelipatan 5');
    ok(after.every((c, i) => i === 0 || c.endId - c.id <= 4));
    for (let i = 1; i < before.length - 1; i++) eq(JSON.stringify(after[i - (after.length < before.length ? 1 : 0)]), JSON.stringify(before[i]), 'candle M5 lengkap tidak boleh berubah');
    eq(TIMEFRAME_FACTORS.M5 * 60, TF_SECONDS.M5); eq(TIMEFRAME_FACTORS.M15 * 60, TF_SECONDS.M15); eq(TIMEFRAME_FACTORS.H1 * 60, TF_SECONDS.H1);
    eq(getAggregatedCandles('XAUUSD', 'H1').length >= 23, true, 'riwayat 24 jam => ~24 candle H1');
});
test('volatilitas penutupan candle M1 sama dengan engine lama (tick lebih halus, rentang sama)', () => {
    state = createFreshState('VOLTEST'); const cl = [];
    for (let k = 0; k < 1500 * TICKS_PER_M1; k++) { stepSimulation(false); if (state.candleTick === TICKS_PER_M1) cl.push(state.markets.XAUUSD.price); }
    const r = []; for (let i = 1; i < cl.length; i++) r.push(Math.log(cl[i] / cl[i - 1]));
    const mean = r.reduce((a, b) => a + b, 0) / r.length, sd = Math.sqrt(r.reduce((a, b) => a + (b - mean) ** 2, 0) / r.length) * 100;
    ok(sd > 0.5 && sd < 0.85, 'sd per candle M1 (%) = ' + sd.toFixed(3) + ', baseline lama 0.658');
});
test('kecepatan: jumlah tick mengikuti jam dinding (1x = 1 tick/detik; 60x = 60 tick/detik)', () => {
    fresh(); const t0 = state.tickCount; simSpeed = 1; simLast = 0; simCarry = 0;
    eq(simFrame(1000), 1); eq(simFrame(3500), 2); eq(simFrame(4000), 1, 'sisa pecahan 0.5 + 0.5 detik');
    simSpeed = 60; eq(simFrame(5000), 60); simSpeed = 3600; eq(simFrame(6000), SIM_MAX_CATCHUP === 3600 ? 3600 : SIM_MAX_CATCHUP);
    simSpeed = 1; simFrame(1e9); eq(state.tickCount - t0 > 0, true); simSpeed = 0; eq(simFrame(2e9), 0);
});
test('batas catch-up: tab tertidur lama tidak memproses waktu tanpa batas', () => {
    fresh(); simSpeed = 1; simLast = 0; simCarry = 0; const t0 = state.tickCount; simFrame(1e7); eq(state.tickCount - t0, SIM_MAX_CATCHUP); simSpeed = 1;
});
test('save lama (10 tick/candle) dikonversi ke jam pasar baru', () => {
    fresh(); const old = JSON.parse(JSON.stringify(state)); delete old.clockV2; old.candleTick = 7; old.fundingCountdown = 10; old.upcomingNews.ticksLeft = 20;
    ok(applyLoadedState(old)); eq(state.candleTick, 1); eq(state.fundingCountdown, 60); eq(state.upcomingNews.ticksLeft, 120); eq(state.clockV2, true);
});
test('hitung mundur candle: turun 1 per tick, 0 di tick penutupan, lalu kembali penuh (M1/M5/M15/H1)', () => {
    fresh(); const tfs = ['M1', 'M5', 'M15', 'H1']; let prev = tfs.map(tf => candleSecondsLeft('XAUUSD', tf));
    eq(prev[0], 59, 'M1 pada tick pertama');
    for (let i = 0; i < 3700; i++) {
        stepSimulation(false);
        tfs.forEach((tf, k) => { const f = TF_SECONDS[tf], now = candleSecondsLeft('XAUUSD', tf);
            ok(now >= 0 && now <= f - 1, `${tf} di luar rentang: ${now}`); eq(now, prev[k] === 0 ? f - 1 : prev[k] - 1, `${tf} langkah ${i}`); prev[k] = now; });
    }
});
function runAll() {
    const results = __T.map(([n, f]) => { try { f(); return { n, ok: true }; } catch (e) { return { n, ok: false, err: e.message }; } });
    return { results, passed: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length };
}
