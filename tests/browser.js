// Uji di browser sungguhan (Chromium via Playwright), termasuk sentuhan (CDP), IndexedDB, tema, tutorial, setor/tarik.
// Jalankan: npm i playwright && npx playwright install chromium && node tests/browser.js
const { chromium, devices } = require('playwright');
const path = require('path'), URL = 'file://' + path.resolve(__dirname, '../index.html');
const R = []; const rec = (n, ok, info = '') => { R.push(ok); console.log((ok ? '  ✓ ' : '  ✗ ') + n + (ok ? '' : '  → ' + info)); };
const T = async (n, fn) => { try { const r = await fn(); rec(n, r === undefined || r === true, String(r)); } catch (e) { rec(n, false, e.message.split('\n')[0]); } };
const eqs = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function newPage(browser, o = {}) {
    const { tour, ...ctxOpts } = o;
    const ctx = await browser.newContext(ctxOpts);
    await ctx.route(/cdn\.tailwindcss\.com|cdnjs\.cloudflare\.com/, r => r.fulfill({ status: 200, contentType: r.request().url().endsWith('.css') ? 'text/css' : 'application/javascript', body: '' }));
    await ctx.addInitScript(skip => { if (skip) { try { localStorage.setItem('FX_QUANT_TOUR_V1', '1'); } catch (e) {} } document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.hidden{display:none!important}'; document.head.appendChild(s); }); }, !tour);
    const page = await ctx.newPage(); page.errs = [];
    page.on('pageerror', e => page.errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') page.errs.push(m.text()); });
    await page.goto(URL); await ready(page); return page;
}
const ready = p => p.waitForFunction(() => typeof lastChartTransform !== 'undefined' && lastChartTransform && state && state.tickCount >= 0, null, { timeout: 8000 });
const openLong = p => p.evaluate(() => { document.getElementById('input-order-size').value = '0.02'; executeOrder('LONG'); const q = state.positions[state.positions.length - 1]; q.stopLoss = +(q.entryPrice - 8).toFixed(2); q.takeProfit = +(q.entryPrice + 12).toFixed(2); renderAll(); return { id: q.id, sl: q.stopLoss }; });
const settle = async p => { await p.evaluate(() => document.getElementById('trading-canvas').scrollIntoView({ block: 'center', behavior: 'instant' })); await p.evaluate(() => new Promise(res => { let last = -1, n = 0; const f = () => { n = scrollY === last ? n + 1 : 0; last = scrollY; n >= 4 ? res() : requestAnimationFrame(f); }; f(); })); };
const slGeom = async p => { await settle(p); return slGeom0(p); };
const slGeom0 = p => p.evaluate(() => { const dl = lastChartTransform.draggableLines.find(l => l.kind === 'SL'); const r = document.getElementById('trading-canvas').getBoundingClientRect(); const vv = window.visualViewport; return dl && { x: r.left + r.width * 0.6 - vv.offsetLeft, y: r.top + dl.y - vv.offsetTop, h: r.height, dy: dl.y }; });

(async () => {
    const browser = await chromium.launch();
    // ================= DESKTOP =================
    let p = await newPage(browser, { viewport: { width: 1280, height: 800 } });
    await T('desktop: halaman termuat tanpa error JS & simulasi berjalan', async () => {
        const t0 = await p.evaluate(() => state.tickCount); await p.waitForTimeout(2600); const t1 = await p.evaluate(() => state.tickCount);
        if (p.errs.length) return p.errs.join(' | '); return t1 > t0 || `tick tidak naik (${t0}->${t1})`;
    });
    await T('kecepatan waktu pasar: 1x ~ 1 tick/detik, 60x ~ 60/detik, 3600x tetap responsif, jeda, & tersimpan', async () => {
        const run = async (s, ms) => { await p.evaluate(v => setSimSpeed(v), s); await p.waitForTimeout(150); const a = await p.evaluate(() => state.tickCount); await p.waitForTimeout(ms); return (await p.evaluate(() => state.tickCount)) - a; };
        const opts = await p.evaluate(() => document.getElementById('spd-select').options.length);
        const d1 = await run(1, 3300), d60 = await run(60, 1000), d3600 = await run(3600, 1000), d0 = await run(0, 1500);
        await p.evaluate(() => setSimSpeed(30)); await p.waitForTimeout(1200); await p.reload(); await ready(p);
        const saved = await p.evaluate(() => document.getElementById('spd-select').value);
        await p.evaluate(() => setSimSpeed(1));
        return (opts === 10 && d1 >= 2 && d1 <= 4 && d60 >= 45 && d60 <= 80 && d3600 >= 2500 && d0 === 0 && saved === '30' && !p.errs.length) || JSON.stringify({ opts, d1, d60, d3600, d0, saved, errs: p.errs });
    });
    await T('hitung mundur candle di sisi kanan chart: teks benar untuk tiap timeframe & kotak berwarna aksen', async () => {
        await p.evaluate(() => setSimSpeed(0));
        const rd = tf => p.evaluate(t => { setTimeframe(t); const drawn = [], o = CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText = function (s) { drawn.push(String(s)); return o.apply(this, arguments); };
            renderCandlestickChart(); CanvasRenderingContext2D.prototype.fillText = o; const exp = fmtClock(candleSecondsLeft(state.activePair, t)); const lt = lastChartTransform, y = lt.priceToY(state.markets[state.activePair].price);
            const gx = document.getElementById('trading-canvas').getContext('2d'), at = dy => gx.getImageData(Math.round((lt.chartW + 60) * devicePixelRatio), Math.round((y + dy) * devicePixelRatio), 1, 1).data; const h = PAIR_CONFIGS[state.activePair].accentColor, want = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const close = d => Math.abs(d[0] - want[0]) + Math.abs(d[1] - want[1]) + Math.abs(d[2] - want[2]) < 12;
            return { exp, has: drawn.includes(exp), color: close(at(16)) || close(at(-16)) }; }, tf);
        const out = []; for (const tf of ['M1', 'M5', 'M15', 'H1']) out.push([tf, await rd(tf)]);
        await p.evaluate(() => { setTimeframe('M1'); setSimSpeed(1); }); const bad = out.filter(([, r]) => !r.has || !r.color);
        return !bad.length || JSON.stringify(bad);
    });
    await T('IndexedDB: posisi tersimpan, bertahan setelah reload, localStorage kosong', async () => {
        await p.click('#oc-buy'); const n = await p.evaluate(() => state.positions.length); if (n !== 1) return 'posisi tidak terbuka via 1-klik: ' + n;
        const id = await p.evaluate(() => state.positions[0].id); await p.waitForTimeout(800); await p.reload(); await ready(p);
        const r = await p.evaluate(async () => ({ n: state.positions.length, id: state.positions[0] && state.positions[0].id, ls: localStorage.getItem(SAVE_KEY), idb: !!(await idbGet(SAVE_KEY)) }));
        return (r.n === 1 && r.id === id && r.ls === null && r.idb) || JSON.stringify(r);
    });
    await T('IndexedDB: migrasi otomatis dari localStorage versi lama', async () => {
        await p.evaluate(async () => { window.saveGameState = () => {}; window.flushSave = () => Promise.resolve(); const s = JSON.parse(JSON.stringify(state)); s.balance = 10500; s.positions = []; await idbDelete(SAVE_KEY); localStorage.setItem(SAVE_KEY, JSON.stringify(s)); });
        await p.reload(); await ready(p); await p.waitForTimeout(900);
        const r = await p.evaluate(async () => ({ bal: Math.round(state.balance), ls: localStorage.getItem(SAVE_KEY), idb: (await idbGet(SAVE_KEY) || {}).balance }));
        return (r.bal === 10500 && r.ls === null && Math.round(r.idb) === 10500) || JSON.stringify(r);
    });
    const EXP = { dark: ['dark', [7, 11, 20]], light: ['light', [244, 246, 250]], amoled: ['amoled', [0, 0, 0]], paper: ['paper', [243, 234, 216]], contrast: ['contrast', [0, 0, 0]] };
    for (const [th, [eff, px]] of Object.entries(EXP)) await T(`tema ${th}: variabel CSS, piksel chart & kelas Tailwind`, async () => {
        const r = await p.evaluate(t => { setTheme(t); renderCandlestickChart(); const d = document.createElement('div'); d.className = 'bg-[#0b1120] text-slate-200'; d.id = '__probe'; document.body.appendChild(d);
            const cs = getComputedStyle(d), c = document.getElementById('trading-canvas').getContext('2d').getImageData(3, 3, 1, 1).data; const o = { eff: document.documentElement.dataset.eff, px: [c[0], c[1], c[2]], bg: cs.backgroundColor, tx: cs.color }; d.remove(); return o; }, th);
        if (r.eff !== eff || !eqs(r.px, px)) return JSON.stringify(r);
        const want = { light: ['rgb(255, 255, 255)', 'rgb(15, 23, 42)'] }[th];
        return !want || (r.bg === want[0] && r.tx === want[1]) || JSON.stringify(r);
    });
    await T('tema otomatis mengikuti sistem & tema tersimpan setelah reload', async () => {
        await p.emulateMedia({ colorScheme: 'light' }); await p.evaluate(() => setTheme('auto')); const a = await p.evaluate(() => document.documentElement.dataset.eff);
        await p.emulateMedia({ colorScheme: 'dark' }); await p.waitForTimeout(100); const b = await p.evaluate(() => document.documentElement.dataset.eff);
        await p.evaluate(() => setTheme('paper')); await p.reload(); await ready(p); const c = await p.evaluate(() => document.documentElement.dataset.eff);
        return (a === 'light' && b === 'dark' && c === 'paper') || [a, b, c].join(',');
    });
    await p.evaluate(() => setTheme('dark'));
    await T('mouse: geser garis SL di chart', async () => {
        await p.evaluate(() => { state.positions = []; renderAll(); }); const { sl } = await openLong(p); const g = await slGeom(p); if (!g) return 'garis SL tidak ada di chart';
        await p.mouse.move(g.x, g.y); await p.mouse.down(); await p.mouse.move(g.x, g.y - 30, { steps: 6 }); await p.mouse.up();
        const sl2 = await p.evaluate(() => state.positions[0].stopLoss); return sl2 > sl || `SL tetap ${sl} -> ${sl2}`;
    });
    await T('Mode Fokus: chart besar + tabel posisi terisi', async () => {
        await p.evaluate(() => { if (!document.body.classList.contains('focus-mode')) toggleFocus(); }); await p.waitForTimeout(250);
        const r = await p.evaluate(() => ({ h: document.getElementById('chart-container').getBoundingClientRect().height, rows: document.querySelectorAll('#fp-body tr').length, vis: getComputedStyle(document.getElementById('fpos')).display !== 'none' }));
        await p.evaluate(() => toggleFocus()); return (r.h > 300 && r.rows >= 1 && r.vis) || JSON.stringify(r);
    });
    await T('riwayat: SL yang kena tercatat dengan alasan SL', async () => {
        await p.evaluate(() => { const q = state.positions[0]; state.markets.XAUUSD.price = q.stopLoss - 5; }); await p.waitForTimeout(2200);
        const h = await p.evaluate(() => state.history[0] && state.history[0].reason); return h === 'SL' || 'riwayat: ' + h;
    });
    await T('setor/tarik (modal sendiri): UI, batas, dan tersimpan setelah reload', async () => {
        await p.evaluate(() => openAcct()); await p.click('#am-own'); await p.fill('#am-bal', '5000'); await p.click('#am-apply');
        const own = await p.evaluate(() => ({ t: state.tierIndex, b: Math.round(state.balance), cash: !document.getElementById('btn-cash').classList.contains('hidden') })); if (own.t !== 4 || own.b !== 5000 || !own.cash) return JSON.stringify(own);
        await p.evaluate(() => openCash()); await p.fill('#cash-amt', '1000'); await p.click('text=Setor >> nth=0').catch(() => p.evaluate(() => doDeposit()));
        await p.evaluate(() => { document.getElementById('cash-amt').value = '99999'; doWithdraw(); }); const rej = await p.evaluate(() => Math.round(state.balance));
        await p.evaluate(() => { document.getElementById('cash-amt').value = '500'; doWithdraw(); }); await p.waitForTimeout(800); await p.reload(); await ready(p);
        const r = await p.evaluate(() => ({ b: Math.round(state.balance), dep: state.deposited, wd: state.withdrawn, led: state.ledger.length }));
        return (rej === 6000 && r.b === 5500 && r.dep === 1000 && r.wd === 500 && r.led === 2) || JSON.stringify({ rej, ...r });
    });
    await p.context().close();

    // ================= TUTORIAL (pengguna baru) =================
    p = await newPage(browser, { viewport: { width: 1280, height: 800 }, tour: true });
    await T('tutorial: otomatis muncul untuk pengguna baru, semua langkah terlihat di layar, tidak muncul lagi', async () => {
        await p.waitForSelector('.tour-card', { timeout: 4000 }); let n = 0, bad = [];
        for (let g = 0; g < 30; g++) {
            const o = await p.evaluate(() => { const c = document.querySelector('.tour-card').getBoundingClientRect(), h = document.querySelector('.tour-hl'), hr = h.style.display === 'block' ? h.getBoundingClientRect() : null;
                return { c: [c.left, c.top, c.right, c.bottom], hr: hr && [hr.left, hr.top, hr.right, hr.bottom], w: innerWidth, h: innerHeight, last: document.querySelector('.tour-next').textContent === 'Selesai', t: document.querySelector('.tour-t').textContent }; });
            n++; if (o.c[0] < 0 || o.c[1] < 0 || o.c[2] > o.w + 1 || o.c[3] > o.h + 1) bad.push(o.t + ' (kartu keluar layar)'); if (o.hr && (o.hr[2] < 0 || o.hr[3] < 0 || o.hr[0] > o.w || o.hr[1] > o.h)) bad.push(o.t + ' (sorotan di luar layar)');
            await p.click('.tour-next'); if (o.last) break;
        }
        const gone = await p.$('.tour-card') === null, flag = await p.evaluate(() => localStorage.getItem('FX_QUANT_TOUR_V1'));
        await p.reload(); await ready(p); await p.waitForTimeout(1500); const again = await p.$('.tour-card') !== null;
        return (n >= 10 && gone && flag === '1' && !again && !bad.length) || JSON.stringify({ n, gone, flag, again, bad });
    });
    await p.context().close();

    // ================= HP (sentuhan nyata via CDP) =================
    p = await newPage(browser, { ...devices['Pixel 7'], tour: false });
    const cdp = await p.context().newCDPSession(p);
    const tp = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((q, i) => ({ x: q[0], y: q[1], id: i + 1 })) });
    await T('HP: ketuk tombol BUY panel 1 klik membuka posisi', async () => { await p.tap('#oc-buy'); return (await p.evaluate(() => state.positions.length)) === 1 || 'posisi tidak terbuka'; });
    await T('HP: geser garis SL dengan jari', async () => {
        await p.evaluate(() => { state.positions = []; renderAll(); }); const { sl } = await openLong(p); const g = await slGeom(p); if (!g) return 'garis SL tidak ada'; const y = g.y + 14;   // jari menyentuh sedikit di luar garis
        await tp('touchStart', [[g.x, y]]); for (let k = 1; k <= 8; k++) await tp('touchMove', [[g.x, y - k * 6]]); await tp('touchEnd', []);
        const sl2 = await p.evaluate(() => state.positions[0].stopLoss); return sl2 > sl || `SL tetap ${sl} -> ${sl2}`;
    });
    await T('HP: geser 1 jari menggeser chart, cubit 2 jari melakukan zoom', async () => {
        await p.evaluate(() => { state.positions = []; renderAll(); viewPanOffset = 0; }); await settle(p); const r2 = await p.evaluate(() => { const b = document.getElementById('trading-canvas').getBoundingClientRect(); const vv = window.visualViewport; return { x: b.left + b.width * 0.5 - vv.offsetLeft, y: b.top + b.height * 0.5 - vv.offsetTop }; });
        await tp('touchStart', [[r2.x, r2.y]]); for (let k = 1; k <= 8; k++) await tp('touchMove', [[r2.x + k * 15, r2.y]]); await tp('touchEnd', []);
        const pan = await p.evaluate(() => viewPanOffset); const z0 = await p.evaluate(() => viewZoomCandles);
        await tp('touchStart', [[r2.x - 20, r2.y], [r2.x + 20, r2.y]]); for (let k = 1; k <= 8; k++) await tp('touchMove', [[r2.x - 20 - k * 12, r2.y], [r2.x + 20 + k * 12, r2.y]]); await tp('touchEnd', []);
        const z1 = await p.evaluate(() => viewZoomCandles); return (pan > 0 && z1 < z0) || JSON.stringify({ pan, z0, z1 });
    });
    await T('HP: tidak ada error JS selama pengujian sentuhan', async () => p.errs.length === 0 || p.errs.join(' | '));
    await p.context().close(); await browser.close();
    const ok = R.filter(Boolean).length; console.log(`\n${ok}/${R.length} lulus`); process.exit(ok === R.length ? 0 : 1);
})();
