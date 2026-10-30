
        /******************************************************************
         * 1. DETERMINISTIC SEEDED PRNG (Mulberry32 + Box-Muller Normal)
         ******************************************************************/
        let prngState = 1337420;

        function hashSeedString(str) {
            let h = 2166136261 >>> 0;
            for (let i = 0; i < str.length; i++) {
                h ^= str.charCodeAt(i);
                h = Math.imul(h, 16777619);
            }
            return h >>> 0;
        }

        function seededRandom() {
            let t = (prngState += 0x6D2B79F5);
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        }

        function seededNormal() {
            let u = 0, v = 0;
            while (u === 0) u = seededRandom();
            while (v === 0) v = seededRandom();
            return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
        }

        /******************************************************************
         * 2. WEB AUDIO API SYNTHESIZER (Zero External MP3 Dependencies)
         ******************************************************************/
        const AudioSynth = {
            ctx: null,
            muted: false,

            init() {
                if (!this.ctx) {
                    const AudioCtx = window.AudioContext || window.webkitAudioContext;
                    if (AudioCtx) this.ctx = new AudioCtx();
                }
                if (this.ctx && this.ctx.state === 'suspended') {
                    this.ctx.resume();
                }
            },

            play(type) {
                if (this.muted) return;
                try {
                    this.init();
                    if (!this.ctx) return;
                    const now = this.ctx.currentTime;

                    if (type === 'order') {
                        const osc = this.ctx.createOscillator();
                        const gain = this.ctx.createGain();
                        osc.type = 'triangle';
                        osc.frequency.setValueAtTime(540, now);
                        osc.frequency.exponentialRampToValueAtTime(760, now + 0.065);
                        gain.gain.setValueAtTime(0.08, now);
                        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
                        osc.connect(gain);
                        gain.connect(this.ctx.destination);
                        osc.start(now);
                        osc.stop(now + 0.07);
                    } else if (type === 'pending_fill') {
                        [660, 880].forEach((freq, idx) => {
                            const osc = this.ctx.createOscillator();
                            const gain = this.ctx.createGain();
                            osc.type = 'triangle';
                            osc.frequency.setValueAtTime(freq, now + idx * 0.05);
                            gain.gain.setValueAtTime(0.07, now + idx * 0.05);
                            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.09);
                            osc.connect(gain);
                            gain.connect(this.ctx.destination);
                            osc.start(now + idx * 0.05);
                            osc.stop(now + idx * 0.05 + 0.09);
                        });
                    } else if (type === 'tp') {
                        [587.33, 783.99, 1046.50].forEach((freq, idx) => {
                            const osc = this.ctx.createOscillator();
                            const gain = this.ctx.createGain();
                            osc.type = 'sine';
                            osc.frequency.setValueAtTime(freq, now + idx * 0.055);
                            gain.gain.setValueAtTime(0.09, now + idx * 0.055);
                            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.055 + 0.16);
                            osc.connect(gain);
                            gain.connect(this.ctx.destination);
                            osc.start(now + idx * 0.055);
                            osc.stop(now + idx * 0.055 + 0.16);
                        });
                    } else if (type === 'sl') {
                        const osc = this.ctx.createOscillator();
                        const gain = this.ctx.createGain();
                        osc.type = 'sawtooth';
                        osc.frequency.setValueAtTime(220, now);
                        osc.frequency.linearRampToValueAtTime(130, now + 0.15);
                        gain.gain.setValueAtTime(0.07, now);
                        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
                        osc.connect(gain);
                        gain.connect(this.ctx.destination);
                        osc.start(now);
                        osc.stop(now + 0.16);
                    } else if (type === 'margin_call') {
                        [320, 210, 320, 180].forEach((freq, idx) => {
                            const osc = this.ctx.createOscillator();
                            const gain = this.ctx.createGain();
                            osc.type = 'sawtooth';
                            osc.frequency.setValueAtTime(freq, now + idx * 0.09);
                            gain.gain.setValueAtTime(0.09, now + idx * 0.09);
                            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.08);
                            osc.connect(gain);
                            gain.connect(this.ctx.destination);
                            osc.start(now + idx * 0.09);
                            osc.stop(now + idx * 0.09 + 0.08);
                        });
                    } else if (type === 'news') {
                        [880, 1174.66].forEach((freq, idx) => {
                            const osc = this.ctx.createOscillator();
                            const gain = this.ctx.createGain();
                            osc.type = 'square';
                            osc.frequency.setValueAtTime(freq, now + idx * 0.07);
                            gain.gain.setValueAtTime(0.04, now + idx * 0.07);
                            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.06);
                            osc.connect(gain);
                            gain.connect(this.ctx.destination);
                            osc.start(now + idx * 0.07);
                            osc.stop(now + idx * 0.07 + 0.06);
                        });
                    }
                } catch (e) {}
            }
        };

        /******************************************************************
         * 3. PAIR, TIMEFRAME & PROP-FIRM TIER CONFIGURATIONS
         ******************************************************************/
        const PAIR_CONFIGS = {
            XAUUSD: {
                id: 'XAUUSD',
                name: 'XAU/USD',
                subtitle: 'GOLD SPOT',
                unitName: 'Troy Oz',
                lotUnits: 100,
                minLot: 0.01,
                basePrice: 2650.00,
                baseSpread: 0.40,
                maxLeverage: 100,
                presetLeverages: [5, 20, 50, 100],
                defaultSize: 2,
                decimals: 2,
                volatility: 0.0011,
                meanReversionStrength: 0.035,
                accentColor: '#f59e0b'
            },
            BTCUSD: {
                id: 'BTCUSD',
                name: 'BTC/USD',
                subtitle: 'BITCOIN PERP',
                unitName: 'BTC',
                lotUnits: 1,
                minLot: 0.01,
                basePrice: 72000.00,
                baseSpread: 22.00,
                maxLeverage: 25,
                presetLeverages: [2, 5, 10, 25],
                defaultSize: 0.10,
                decimals: 2,
                volatility: 0.0028,
                meanReversionStrength: 0.008,
                accentColor: '#f97316'
            }
        };

        const TIMEFRAME_FACTORS = {
            M1: 1,
            M5: 5,
            M15: 15,
            H1: 60
        };

        const PROP_TIERS = [
            {
                tier: 1,
                name: 'TIER 1: EVALUASI PROP-FIRM $10K',
                startBalance: 10000,
                targetEquity: 11000,
                maxDrawdownEquity: 9000,
                profitSplitBonus: 500,
                splitPct: 20
            },
            {
                tier: 2,
                name: 'TIER 2: JUNIOR FUNDED $50K',
                startBalance: 50000,
                targetEquity: 56000,
                maxDrawdownEquity: 45000,
                profitSplitBonus: 2000,
                splitPct: 50
            },
            {
                tier: 3,
                name: 'TIER 3: SENIOR PROP DESK $250K',
                startBalance: 250000,
                targetEquity: 285000,
                maxDrawdownEquity: 225000,
                profitSplitBonus: 8500,
                splitPct: 75
            },
            {
                tier: 4,
                name: 'TIER 4: INSTITUTIONAL WHALE $1M',
                startBalance: 1000000,
                targetEquity: 1150000,
                maxDrawdownEquity: 900000,
                profitSplitBonus: 35000,
                splitPct: 90
            }
        ];

        /* ===== JAM PASAR: 1 tick = 1 detik waktu pasar. 1 candle M1 = 60 tick = 1 menit. =====
           Kecepatan 1x = waktu nyata (M1 = 1 menit sungguhan, M5 = 5 menit, H1 = 1 jam). Parameter per-tick
           diskalakan dari engine lama (10 tick/candle) agar rentang candle & dampak berita tetap sama. */
        const TICKS_PER_M1 = 60;
        const TICK_MULT = TICKS_PER_M1 / 10;
        const TICK_SCALE = 1 / TICK_MULT;
        const DRIFT_DECAY = Math.pow(0.82, TICK_SCALE);
        const VOL_DECAY = Math.pow(0.88, TICK_SCALE);
        const DRIFT_SCALE = (1 - DRIFT_DECAY) / (1 - 0.82);
        const MAX_M1_CANDLES = 1440;   // riwayat 24 jam (H1 = 24 candle)
        const TF_SECONDS = { M1: 60, M5: 300, M15: 900, H1: 3600 };
        const SIM_SPEEDS = [[0, '⏸ Jeda'], [1, '1x · waktu nyata'], [2, '2x'], [5, '5x'], [10, '10x'], [30, '30x'], [60, '60x · 1 menit/detik'], [300, '300x · 5 menit/detik'], [900, '900x · 15 menit/detik'], [3600, '3600x · 1 jam/detik']];
        const _p2 = n => String(n).padStart(2, '0');
        function fmtHMS(sec) { sec = Math.max(0, Math.floor(sec)); return `${_p2(Math.floor(sec / 3600) % 24)}:${_p2(Math.floor(sec % 3600 / 60))}:${_p2(sec % 60)}`; }
        function fmtClock(sec) { sec = Math.max(0, Math.floor(sec)); const h = Math.floor(sec / 3600); return h ? `${h}:${_p2(Math.floor(sec % 3600 / 60))}:${_p2(sec % 60)}` : `${_p2(Math.floor(sec / 60))}:${_p2(sec % 60)}`; }
        function fmtMarketTime(sec) { sec = Math.max(0, Math.floor(sec)); return `Hari ${Math.floor(sec / 86400) + 1} ${fmtHMS(sec)}`; }

        /* Akun modal sendiri = tier khusus (indeks 4): tanpa target, tanpa drawdown prop, 100% profit */
        const OWN_TIER_INDEX = 4;
        const OWN_TIER = {
            tier: 0,
            get name() { return 'MODAL SENDIRI ' + fmtUSD(this.startBalance, 0); },
            get startBalance() { return state.ownStart || 1000; },
            targetEquity: Infinity, maxDrawdownEquity: 0, profitSplitBonus: 0, splitPct: 0
        };
        function getTier() { return state.tierIndex === OWN_TIER_INDEX ? OWN_TIER : PROP_TIERS[state.tierIndex]; }

        /* Lot <-> unit kontrak. Engine memakai UNIT; antarmuka memakai LOT (MT5: 1 lot XAU = 100 oz, 1 lot BTC = 1 BTC) */
        function unitsToLots(pairId, units) { return units / PAIR_CONFIGS[pairId].lotUnits; }
        function lotsToUnits(pairId, lots) { return Number((lots * PAIR_CONFIGS[pairId].lotUnits).toFixed(4)); }
        function fmtLot(pairId, units) { return String(Number(unitsToLots(pairId, units).toFixed(4))); }
        function readOrderUnits(pairId) {
            const cfg = PAIR_CONFIGS[pairId];
            const raw = parseFloat(document.getElementById('input-order-size').value);
            const lots = Number.isFinite(raw) && raw > 0 ? Math.max(cfg.minLot, Math.round(raw * 100) / 100) : unitsToLots(pairId, cfg.defaultSize);
            return lotsToUnits(pairId, lots);
        }

        const MACRO_NEWS_POOL = [
            {
                title: 'KEPUTUSAN SUKU BUNGA THE FED (FOMC): Pemangkasan 25 bps Mengejutkan Pasar!',
                pairTarget: 'BOTH',
                xauShock: +0.0065,
                btcShock: +0.0140,
                volMult: 2.8,
                hint: 'Kuat Bullish untuk Emas (XAU) & Bitcoin (BTC)'
            },
            {
                title: 'DATA INFLASI CPI AS MELONJAK: The Fed Berpotensi Tahan Suku Bunga Tinggi!',
                pairTarget: 'BOTH',
                xauShock: -0.0058,
                btcShock: -0.0135,
                volMult: 2.6,
                hint: 'Tekanan Jual (Bearish) pada XAU/USD & BTC/USD'
            },
            {
                title: 'ESKALASI GEOPOLITIK TIMUR TENGAH: Investor Global Memborong Aset Safe-Haven!',
                pairTarget: 'XAUUSD',
                xauShock: +0.0075,
                btcShock: -0.0045,
                volMult: 2.5,
                hint: 'Lonjakan Bullish Kuat pada XAU/USD (Safe-Haven)'
            },
            {
                title: 'LAPORAN NON-FARM PAYROLLS (NFP) AS SANGAT KUAT: Dolar AS Menguat Tajam!',
                pairTarget: 'XAUUSD',
                xauShock: -0.0062,
                btcShock: -0.0040,
                volMult: 2.4,
                hint: 'Koreksi Bearish Tajam pada XAU/USD'
            },
            {
                title: 'ARUS MASUK ETF BITCOIN REKOR $1.2 MILIAR: Institusi Wall Street Akumulasi!',
                pairTarget: 'BTCUSD',
                xauShock: +0.0010,
                btcShock: +0.0185,
                volMult: 3.0,
                hint: 'Pompa Bullish Masif pada BTC/USD'
            },
            {
                title: 'WHALE ALERT: Dompet Era Satoshi Mentransfer 15.000 BTC ke Bursa Derivatif!',
                pairTarget: 'BTCUSD',
                xauShock: +0.0005,
                btcShock: -0.0175,
                volMult: 3.1,
                hint: 'Kepanikan Jual (Dump Bearish) pada BTC/USD'
            }
        ];

        /******************************************************************
         * 4. GAME STATE & CHART INTERACTION VARIABLES
         ******************************************************************/
        const SAVE_KEY = 'FX_QUANT_SAVE_V2';
        let simTimer = null;
        let simSpeed = 1; // 0 = Pause, 1 = 500ms, 2 = 250ms, 5 = 100ms
        let hardResetConfirm = false;

        // Order Execution Mode ('MARKET' | 'LIMIT' | 'STOP')
        let currentOrderMode = 'MARKET';

        // Chart Viewport & Interactive State
        let activeTimeframe = 'M1'; // 'M1', 'M5', 'M15', 'H1'
        let viewZoomCandles = 55;   // Number of visible aggregated candles (20..140)
        let viewPanOffset = 0;      // 0 = pinned to latest candle; >0 = scrolled back
        let activeDrawingTool = 'cursor'; // 'cursor' | 'hline' | 'trendline' | 'rect'

        let hoverMouseX = null;
        let hoverMouseY = null;
        let hoveredChartLine = null; // { type: 'SL'|'TP'|'PENDING', id, price }
        let activeDragOperation = null; // Handles line drag, chart pan, or shape drawing
        let lastChartTransform = null;  // Stores coordinate helpers from latest render

        const indicators = {
            ema9: true,
            ema21: true,
            bb: false,
            posLines: true
        };

        function generateInitialCandles(pairId, count = 300) {
            const cfg = PAIR_CONFIGS[pairId];
            const candles = [];
            let price = cfg.basePrice;

            for (let i = 1; i <= count; i++) {
                const open = price;
                let high = open;
                let low = open;
                let close = open;

                for (let t = 0; t < 10; t++) {
                    const z = seededNormal();
                    const pull = (cfg.basePrice - close) * cfg.meanReversionStrength * 0.15;
                    const change = close * (cfg.volatility * 0.55 * z) + pull;
                    close = Number(Math.max(cfg.basePrice * 0.5, close + change).toFixed(cfg.decimals));
                    if (close > high) high = close;
                    if (close < low) low = close;
                }
                candles.push({ id: i, o: open, h: high, l: low, c: close });
                price = close;
            }
            return { candles, lastPrice: price, lastCandleId: count };
        }

        function createFreshState(seedStr = 'QUANT-2026') {
            prngState = hashSeedString(seedStr);
            const xauInit = generateInitialCandles('XAUUSD', MAX_M1_CANDLES);
            const btcInit = generateInitialCandles('BTCUSD', MAX_M1_CANDLES);
            const firstNews = MACRO_NEWS_POOL[Math.floor(seededRandom() * MACRO_NEWS_POOL.length)];

            return {
                version: 2,
                seed: seedStr,
                prngState: prngState,
                tickCount: 1,
                candleTick: 1, // 1..60 tick (detik) per candle M1
                clockV2: true,
                fundingCountdown: 25 * TICK_MULT,
                totalSwapPaid: 0.00,
                activePair: 'XAUUSD',
                tierIndex: 0,
                balance: 10000.00,
                wallet: 0.00,
                realizedPnL: 0.00,
                wins: 0,
                totalTrades: 0,
                nextPosId: 101,
                history: [],
                deposited: 0,
                withdrawn: 0,
                ledger: [],
                quantBotActive: false,
                upgrades: {
                    rawSpread: 0,    // 0..5
                    coLocation: 0,   // 0..5 (Anti-Slippage)
                    macroIntel: 0,   // 0..3
                    quantBot: 0,     // 0..5
                    marginShield: 0  // 0..3
                },
                upcomingNews: {
                    ...firstNews,
                    ticksLeft: 28 * TICK_MULT
                },
                markets: {
                    XAUUSD: {
                        price: xauInit.lastPrice,
                        open24h: PAIR_CONFIGS.XAUUSD.basePrice,
                        drift: 0,
                        volBoost: 1.0,
                        lastCandleId: xauInit.lastCandleId,
                        candles: xauInit.candles
                    },
                    BTCUSD: {
                        price: btcInit.lastPrice,
                        open24h: PAIR_CONFIGS.BTCUSD.basePrice,
                        drift: 0,
                        volBoost: 1.0,
                        lastCandleId: btcInit.lastCandleId,
                        candles: btcInit.candles
                    }
                },
                positions: [],
                pendingOrders: [],
                drawings: {
                    XAUUSD: [],
                    BTCUSD: []
                }
            };
        }

        let state = createFreshState('QUANT-2026');
