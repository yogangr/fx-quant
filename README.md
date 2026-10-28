# FX-QUANT Terminal v3

Simulator trading XAU/USD & BTC/USD: mode **Prop-Firm** dan **Modal Sendiri**.

## Menjalankan
Buka `index.html` di browser (perlu internet untuk Tailwind CDN & Font Awesome).
Atau `python3 build-single.py` untuk membuat satu file HTML mandiri.

## Struktur
| Berkas | Isi |
|---|---|
| `css/base.css` | gaya dasar, panel 1-klik, Mode Fokus (memakai variabel CSS) |
| `css/themes.css` | palet tema eksplisit: Gelap, Terang, AMOLED, Kertas, Kontras Tinggi |
| `js/core.js` | PRNG, audio, konfigurasi pair/tier, helper lot, state awal |
| `js/engine.js` | kalkulasi, harga, order, penutupan, margin call, Lab Quant |
| `js/history.js` | riwayat, statistik, kodek tautan bagikan (tanpa DOM) |
| `js/chart.js` | kanvas chart, pointer events (mouse + sentuhan), tema kanvas |
| `js/render.js` | sinkronisasi UI |
| `js/storage.js` | IndexedDB (fallback localStorage, migrasi otomatis) |
| `js/persist.js` | modal simpan/ekspor/impor, seed |
| `js/ui-*.js` | panel 1-klik & Mode Fokus, tema, akun & riwayat, bagikan |
| `tests/` | tes engine (`node tests/run-node.js` atau buka `tests/index.html`) |

## Tes
`node tests/run-node.js` — memeriksa lot↔unit, PnL, margin, SL/TP, tutup parsial, margin call, drawdown, seed, dan kodek bagikan.
