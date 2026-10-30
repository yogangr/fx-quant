# FX-QUANT Terminal v3

Simulator trading XAU/USD & BTC/USD: mode **Prop-Firm** dan **Modal Sendiri**.

## Menjalankan
Buka `index.html` di browser (perlu internet untuk Tailwind CDN & Font Awesome).
Atau `python3 build-single.py` untuk membuat satu file HTML mandiri.

## Jam pasar & kecepatan
- **1 tick = 1 detik waktu pasar; 1 candle M1 = 60 tick.** Pada kecepatan **1x (waktu nyata)** candle M1 benar-benar 1 menit, M5 = 5 menit, M15 = 15 menit, H1 = 1 jam.
- Percepatan berlaku untuk semua timeframe sekaligus: 2x, 5x, 10x, 30x, 60x (1 menit/detik), 300x (5 menit/detik), 900x (15 menit/detik), 3600x (1 jam/detik), serta Jeda.
- Pengatur waktu memakai jam dinding (`performance.now()`), jadi akurat walau tab melambat; sisa waktu setelah tab tertidur dibatasi 3600 tick.
- **Hitung mundur candle** (gaya TradingView) tampil di sumbu kanan chart, tepat di bawah tag harga, mengikuti timeframe aktif (M1/M5/M15/H1).
- Riwayat 24 jam candle M1 disimpan (H1 = 24 candle). Candle M5/M15/H1 dibentuk dari ID candle sehingga batasnya tetap.
- Volatilitas per candle sama dengan versi sebelumnya (tick lebih halus); sumbu candle ±15% lebih panjang karena harga disampel 60x per menit.
- Seed yang sama menghasilkan pasar yang berbeda dari versi sebelum jam pasar (jumlah tick per candle berubah); hasil lama tidak sebanding. Save lama dikonversi otomatis.

## Struktur
| Berkas | Isi |
|---|---|
| `css/base.css` | gaya dasar, panel 1-klik, Mode Fokus (memakai variabel CSS) |
| `css/themes.css` | palet tema eksplisit: Gelap, Terang, AMOLED, Kertas, Kontras Tinggi |
| `js/core.js` | PRNG, audio, konfigurasi pair/tier, helper lot, state awal |
| `js/engine.js` | kalkulasi, harga, order, penutupan, margin call, Lab Quant |
| `js/history.js` | riwayat, statistik, kodek tautan bagikan (tanpa DOM) |
| `js/cash.js` | setor/tarik & performa modal sendiri (tanpa DOM) |
| `js/chart.js` | kanvas chart, pointer events (mouse + sentuhan), tema kanvas |
| `js/render.js` | sinkronisasi UI |
| `js/storage.js` | IndexedDB (fallback localStorage, migrasi otomatis) |
| `js/persist.js` | modal simpan/ekspor/impor, seed |
| `js/ui-*.js` | panel 1-klik & Mode Fokus, tema, akun & riwayat, setor/tarik, bagikan, tutorial |
| `tests/` | tes engine (`node tests/run-node.js` atau buka `tests/index.html`) |

## Tes
- `node tests/run-node.js` — 25 tes engine: lot↔unit, PnL, margin, SL/TP, tutup parsial, margin call, drawdown, seed, kodek bagikan, setor/tarik.
- `node tests/browser.js` — 20 tes di Chromium sungguhan (Playwright): IndexedDB & migrasi, 5 tema (CSS + piksel chart), sentuhan via CDP (ketuk, geser SL, geser chart, cubit-zoom), Mode Fokus, riwayat, setor/tarik, tutorial. Perlu `npm i playwright && npx playwright install chromium`.
  Tailwind/Font Awesome CDN diganti stub saat tes, jadi tes ini memeriksa logika, bukan tampilan visual akhir.
