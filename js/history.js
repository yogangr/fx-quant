/* Riwayat trading, statistik & kodek tautan bagikan (logika murni, tanpa DOM) */
function recordTrade(pos, size, exitPrice, pnl, reason, partial) {
    const d = PAIR_CONFIGS[pos.pair].decimals;
    if (!Array.isArray(state.history)) state.history = [];
    state.history.unshift({
        time: Date.now(), tick: state.tickCount, pair: pos.pair, side: pos.side,
        size: Number(Number(size).toFixed(4)), entry: pos.entryPrice,
        exit: Number(Number(exitPrice).toFixed(d)), pnl: Number(Number(pnl).toFixed(2)),
        reason: reason || 'MANUAL', partial: !!partial
    });
    if (state.history.length > 500) state.history.length = 500;
}

/* Menutup paksa semua posisi terbuka (margin call, drawdown, naik tier, reset) dan mencatatnya ke riwayat */
function archiveOpenPositions(reason, countAsTrades) {
    for (const pos of state.positions) {
        const { bid, ask } = getBidAsk(pos.pair);
        const pnl = calculatePositionPnL(pos);
        recordTrade(pos, pos.size, pos.side === 'LONG' ? bid : ask, pnl, reason, false);
        if (countAsTrades) { state.totalTrades += 1; if (pnl > 0) state.wins += 1; }
    }
    state.positions = [];
}

function tradeStats(h) {
    const W = h.filter(x => x.pnl > 0), Ls = h.filter(x => x.pnl <= 0), n = h.length, pn = h.map(x => x.pnl);
    const gp = W.reduce((s, x) => s + x.pnl, 0), gl = Math.abs(Ls.reduce((s, x) => s + x.pnl, 0));
    return { n, wins: W.length, winRate: n ? W.length / n * 100 : 0, net: gp - gl, grossProfit: gp, grossLoss: gl,
             pf: gl ? gp / gl : (gp > 0 ? Infinity : 0), best: n ? Math.max(...pn) : 0, worst: n ? Math.min(...pn) : 0 };
}

function encodeShare(d) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(d)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decodeShare(str) {
    try {
        const j = JSON.parse(decodeURIComponent(escape(atob(String(str).replace(/-/g, '+').replace(/_/g, '/')))));
        const fin = k => Number.isFinite(j[k]);
        if (j.v !== 1 || typeof j.seed !== 'string' || !/^[A-Za-z0-9_\- ]{1,32}$/.test(j.seed) || !['own', 'prop'].includes(j.mode)
            || !['start', 'equity', 'roi', 'n', 'wr', 'net', 'tick'].every(fin)) return null;
        return { v: 1, seed: j.seed, mode: j.mode, start: j.start, equity: j.equity, roi: j.roi, n: j.n, wr: j.wr, pf: Number.isFinite(j.pf) ? j.pf : null, net: j.net, tick: j.tick };
    } catch (e) { return null; }
}
