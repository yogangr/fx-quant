/* Tutorial singkat: tur terpandu dengan sorotan (spotlight). Otomatis sekali untuk pengguna baru. */
(function () {
const g = id => document.getElementById(id), q = s => document.querySelector(s), KEY = 'FX_QUANT_TOUR_V1';
const STEPS = [
    { t: 'Selamat datang di FX-QUANT', x: 'Simulator trading XAU/USD & BTC/USD. Tur singkat ini (±1 menit) menunjukkan bagian terpenting. Bisa dilewati, dan dibuka lagi lewat tombol ?.' },
    { el: () => g('kpi-balance') && g('kpi-balance').parentElement, t: 'Saldo & equity', x: 'Saldo = uang yang sudah terealisasi. Equity = saldo + untung/rugi mengambang. Perhatikan juga margin level di kartu lain.' },
    { el: () => g('pair-tabs-row'), t: 'Pilih instrumen', x: 'Ganti antara XAU/USD dan BTC/USD. Harga bergerak otomatis (simulasi berbasis seed).' },
    { el: () => g('spd-select'), t: 'Kecepatan waktu', x: '1x = waktu nyata: candle M1 benar-benar 1 menit, M5 = 5 menit, H1 = 1 jam. Percepat sampai 3600x (1 jam per detik) untuk berlatih, atau Jeda kapan saja.' },
    { el: () => g('chart-tb1'), t: 'Timeframe & indikator', x: 'Pilih M1–H1, nyalakan indikator, dan zoom. Geser chart untuk melihat masa lalu. Di HP: geser 1 jari, cubit 2 jari.' },
    { el: () => g('oc'), t: 'Panel 1 klik', x: 'SELL/BUY langsung dari chart tanpa scroll. Isi volume dalam lot (1 lot XAU = 100 oz). Tombol ⚙: mode konfirmasi, leverage, SL/TP otomatis.' },
    { el: () => g('chart-container'), t: 'Chart interaktif', x: 'Garis SL, TP, dan order pending bisa digeser dengan mouse atau jari. Kotak kecil di bawah harga (sisi kanan) adalah hitung mundur penutupan candle. Pilih alat gambar di toolbar untuk garis bantu.' },
    { el: () => g('order-aside'), t: 'Panel order lengkap', x: 'Market/Limit/Stop, SL, TP, trailing stop, leverage, dan tombol MAX margin. Biasakan selalu memasang SL.' },
    { el: () => g('bottom-area'), t: 'Posisi, pending & log', x: 'Pantau posisi terbuka, tutup penuh atau parsial, dan baca log eksekusi di sini.' },
    { el: () => q('[onclick="toggleFocus()"]'), t: 'Mode Fokus', x: 'Tampilan ala MetaTrader 5: hanya chart, timeframe, dan posisi terbuka. Pintasan: tekan M. Tombol layar penuh ada di sebelahnya (pintasan F).' },
    { el: () => q('[onclick="openAcct()"]'), t: 'Mode akun & saldo awal', x: 'Pilih Prop-Firm (ada target & batas drawdown) atau Modal Sendiri (bebas, dengan saldo awal pilihan Anda). Di Modal Sendiri tersedia setor/tarik saldo.' },
    { el: () => q('[onclick="openHistory()"]'), t: 'Riwayat trading', x: 'Semua transaksi tercatat: win rate, profit factor, filter, dan ekspor CSV. Pintasan: H.' },
    { el: () => q('[onclick="cycleTheme()"]'), t: 'Tema', x: 'Gelap, Terang, AMOLED, Kertas, Kontras Tinggi, atau Otomatis. Pintasan: T.' },
    { el: () => q('[onclick="openShare()"]'), t: 'Bagikan hasil', x: 'Buat tautan (seed + ringkasan) atau gambar hasil untuk dibandingkan dengan teman.' },
    { t: 'Siap mencoba!', x: 'Tips: mulai dengan lot kecil (0,01–0,05), pasang SL, dan jangan memakai seluruh margin. Tur ini bisa dibuka lagi kapan saja lewat tombol ?.' }
];
let i = 0, steps = [], hl, card, block;
const vis = el => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
function end(done) { [hl, card, block].forEach(n => n && n.remove()); hl = card = block = null; document.removeEventListener('keydown', onKey, true); window.removeEventListener('resize', place); if (done) { try { localStorage.setItem(KEY, '1'); } catch (e) {} } }
function place() {
    if (!card) return; const s = steps[i], el = s.el && s.el();
    card.innerHTML = `<div class="tour-t">${s.t}</div><div class="tour-x">${s.x}</div><div class="tour-f"><span>${i + 1}/${steps.length}</span><span class="flex-1"></span>`
        + (i ? '<button class="fb tour-prev">Kembali</button>' : '') + `<button class="fb on tour-next">${i === steps.length - 1 ? 'Selesai' : 'Lanjut'}</button>`
        + (i < steps.length - 1 ? '<button class="fb tour-skip">Lewati</button>' : '') + '</div>';
    card.querySelector('.tour-next').onclick = () => (i === steps.length - 1 ? end(true) : go(1));
    const pv = card.querySelector('.tour-prev'); if (pv) pv.onclick = () => go(-1);
    const sk = card.querySelector('.tour-skip'); if (sk) sk.onclick = () => end(true);
    const cw = Math.min(340, innerWidth - 24); card.style.width = cw + 'px'; let top, left;
    if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'instant' }); const r = el.getBoundingClientRect(), ch = card.offsetHeight;
        hl.style.cssText = `display:block;left:${r.left - 4}px;top:${r.top - 4}px;width:${r.width + 8}px;height:${r.height + 8}px`;
        top = r.bottom + 12; if (top + ch > innerHeight - 8) top = r.top - ch - 12; if (top < 8) top = innerHeight - ch - 12;
        left = Math.max(12, Math.min(r.left, innerWidth - cw - 12));
    } else { hl.style.display = 'none'; top = Math.max(12, (innerHeight - card.offsetHeight) / 2); left = (innerWidth - cw) / 2; }
    card.style.top = top + 'px'; card.style.left = left + 'px';
}
function go(d) { i = Math.max(0, Math.min(steps.length - 1, i + d)); place(); }
function onKey(e) { if (e.key === 'Escape') end(true); else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); i === steps.length - 1 ? end(true) : go(1); } else if (e.key === 'ArrowLeft') go(-1); }
window.startTour = () => {
    end(false); if (document.body.classList.contains('focus-mode')) toggleFocus();
    ['hist-modal', 'acct-modal', 'share-modal', 'cash-modal', 'shared-modal'].forEach(closeModal);
    steps = STEPS.filter(s => !s.el || vis(s.el())); i = 0;
    block = document.createElement('div'); block.className = 'tour-block'; hl = document.createElement('div'); hl.className = 'tour-hl'; card = document.createElement('div'); card.className = 'tour-card';
    document.body.append(block, hl, card); document.addEventListener('keydown', onKey, true); window.addEventListener('resize', place); place();
};
(window.__ui = window.__ui || []).push(() => {
    let done = false; try { done = !!localStorage.getItem(KEY); } catch (e) {}
    if (!done && !location.hash.startsWith('#r=')) setTimeout(startTour, 900);
});
})();
