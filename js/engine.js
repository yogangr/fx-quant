        /******************************************************************
         * 5. FINANCIAL, SLIPPAGE, MULTI-TIMEFRAME & TECHNICAL CALCULATIONS
         ******************************************************************/
        function fmtUSD(val, dec = 2) {
            if (!Number.isFinite(val)) val = 0;
            const sign = val < 0 ? '-' : '';
            return sign + '$' + Math.abs(val).toLocaleString('en-US', {
                minimumFractionDigits: dec,
                maximumFractionDigits: dec
            });
        }

        function getSpread(pairId) {
            const cfg = PAIR_CONFIGS[pairId];
            const reduction = Math.min(0.75, (state.upgrades.rawSpread || 0) * 0.15);
            return Number((cfg.baseSpread * (1 - reduction)).toFixed(2));
        }

        function getBidAsk(pairId) {
            const mid = state.markets[pairId].price;
            const halfSpread = getSpread(pairId) / 2;
            const dec = PAIR_CONFIGS[pairId].decimals;
            return {
                bid: Number((mid - halfSpread).toFixed(dec)),
                ask: Number((mid + halfSpread).toFixed(dec)),
                mid: mid
            };
        }

        function getSlippageProtectionPct() {
            return Math.min(1.0, (state.upgrades.coLocation || 0) * 0.20);
        }

        // Calculates realistic adverse slippage during high-volatility news shocks
        function applyExecutionSlippage(pairId, side, rawPrice, isCloseOrSL = false) {
            const m = state.markets[pairId];
            const cfg = PAIR_CONFIGS[pairId];
            if (m.volBoost <= 1.25) return { finalPrice: rawPrice, slippagePoints: 0 };

            const protection = getSlippageProtectionPct();
            if (protection >= 1.0) return { finalPrice: rawPrice, slippagePoints: 0 };

            const excessVol = m.volBoost - 1.0;
            const rawSlip = cfg.baseSpread * excessVol * (0.6 + seededRandom() * 1.4) * (1 - protection);
            const slipPoints = Number(rawSlip.toFixed(cfg.decimals));
            if (slipPoints <= 0) return { finalPrice: rawPrice, slippagePoints: 0 };

            // Adverse direction: if opening LONG or closing SHORT, price slips UP; if opening SHORT or closing LONG, price slips DOWN
            let slipsUp = (side === 'LONG' && !isCloseOrSL) || (side === 'SHORT' && isCloseOrSL);
            const finalPrice = Number((rawPrice + (slipsUp ? slipPoints : -slipPoints)).toFixed(cfg.decimals));
            return { finalPrice, slippagePoints: slipPoints };
        }

        function getLiquidationMarginLevel() {
            const lvl = state.upgrades.marginShield || 0;
            return Math.max(25, 50 - lvl * 8.33);
        }

        function calculatePositionPnL(pos, customExitPrice = null) {
            const { bid, ask } = getBidAsk(pos.pair);
            const exitPrice = customExitPrice !== null ? customExitPrice : (pos.side === 'LONG' ? bid : ask);
            const diff = pos.side === 'LONG' ? (exitPrice - pos.entryPrice) : (pos.entryPrice - exitPrice);
            return diff * pos.size;
        }

        function getAccountMetrics() {
            let floatingPnL = 0;
            let usedMargin = 0;

            state.positions.forEach(pos => {
                floatingPnL += calculatePositionPnL(pos);
                usedMargin += pos.margin;
            });

            const equity = state.balance + floatingPnL;
            const freeMargin = Math.max(0, equity - usedMargin);
            const marginLevel = usedMargin > 0 ? (equity / usedMargin) * 100 : Infinity;

            return { floatingPnL, usedMargin, equity, freeMargin, marginLevel };
        }

        // Dynamic Multi-Timeframe Aggregation (M1 -> M5, M15, H1)
        function getAggregatedCandles(pairId, tf) {
            const base = state.markets[pairId].candles;
            const factor = TIMEFRAME_FACTORS[tf] || 1;
            if (factor === 1) return base;

            const agg = [];
            for (let i = 0; i < base.length; i += factor) {
                const slice = base.slice(i, i + factor);
                if (slice.length === 0) continue;
                const o = slice[0].o;
                const c = slice[slice.length - 1].c;
                let h = slice[0].h;
                let l = slice[0].l;
                for (let k = 1; k < slice.length; k++) {
                    if (slice[k].h > h) h = slice[k].h;
                    if (slice[k].l < l) l = slice[k].l;
                }
                agg.push({
                    id: slice[0].id,
                    endId: slice[slice.length - 1].id,
                    o, h, l, c
                });
            }
            return agg;
        }

        function calculateEMA(candles, period) {
            const result = [];
            const k = 2 / (period + 1);
            let ema = candles[0]?.c || 0;
            for (let i = 0; i < candles.length; i++) {
                const c = candles[i].c;
                ema = i === 0 ? c : (c * k + ema * (1 - k));
                result.push(ema);
            }
            return result;
        }

        function calculateBollingerBands(candles, period = 20, mult = 2) {
            const bands = [];
            for (let i = 0; i < candles.length; i++) {
                if (i < period - 1) {
                    bands.push(null);
                    continue;
                }
                let sum = 0;
                for (let j = i - period + 1; j <= i; j++) sum += candles[j].c;
                const sma = sum / period;
                let sqDiff = 0;
                for (let j = i - period + 1; j <= i; j++) {
                    sqDiff += Math.pow(candles[j].c - sma, 2);
                }
                const std = Math.sqrt(sqDiff / period);
                bands.push({ mid: sma, upper: sma + mult * std, lower: sma - mult * std });
            }
            return bands;
        }

        function calculateRSIArray(candles, period = 14) {
            const rsis = [];
            let gains = 0;
            let losses = 0;

            for (let i = 0; i < candles.length; i++) {
                if (i === 0) {
                    rsis.push(50);
                    continue;
                }
                const diff = candles[i].c - candles[i - 1].c;
                const gain = diff > 0 ? diff : 0;
                const loss = diff < 0 ? -diff : 0;

                if (i <= period) {
                    gains += gain;
                    losses += loss;
                    const avgG = gains / i;
                    const avgL = losses / i;
                    const rs = avgL === 0 ? 100 : avgG / avgL;
                    rsis.push(avgL === 0 ? 75 : 100 - 100 / (1 + rs));
                } else {
                    gains = (gains * (period - 1) + gain) / period;
                    losses = (losses * (period - 1) + loss) / period;
                    const rs = losses === 0 ? 100 : gains / losses;
                    rsis.push(losses === 0 ? 85 : 100 - 100 / (1 + rs));
                }
            }
            return rsis;
        }

        /******************************************************************
         * 6. TERMINAL LOGGING & ALERT HELPER
         ******************************************************************/
        function addLog(msg, type = 'INFO') {
            addLogCore(msg, type);
            if (typeof uiOnLog === 'function') uiOnLog(msg, type);
        }

        function addLogCore(msg, type = 'INFO') {
            const logBox = document.getElementById('bottom-panel-log');
            if (!logBox) return;
            const colors = {
                LONG: 'text-emerald-400',
                SHORT: 'text-rose-400',
                PENDING: 'text-amber-300',
                TP: 'text-emerald-300 font-bold',
                SL: 'text-rose-400 font-bold',
                NEWS: 'text-amber-300 font-bold',
                PROP: 'text-cyan-300 font-bold',
                SWAP: 'text-purple-300',
                INFO: 'text-slate-400'
            };
            const row = document.createElement('div');
            row.className = `flex items-start gap-2 ${colors[type] || 'text-slate-300'}`;
            row.innerHTML = `<span class="text-slate-600 shrink-0">[T#${state.tickCount}]</span><span>${msg}</span>`;
            logBox.prepend(row);
            while (logBox.children.length > 80) {
                logBox.removeChild(logBox.lastChild);
            }
        }

        function showBannerAlert(msg) {
            const b = document.getElementById('alert-banner');
            const t = document.getElementById('alert-banner-text');
            t.innerHTML = msg;
            b.classList.remove('hidden');
        }

        /******************************************************************
         * 7. PRICE ENGINE, PENDING ORDERS, TRAILING SL & SWAP/FUNDING
         ******************************************************************/
        function stepMarketPair(pairId) {
            const cfg = PAIR_CONFIGS[pairId];
            const m = state.markets[pairId];
            const Z = seededNormal();

            const reversion = (cfg.basePrice - m.price) * (cfg.meanReversionStrength * 0.04);
            const sigma = cfg.volatility * m.volBoost;
            const pctMove = m.drift + sigma * Z;

            let nextPrice = m.price * Math.exp(pctMove) + reversion;
            nextPrice = Math.max(cfg.basePrice * 0.35, Math.min(cfg.basePrice * 2.5, nextPrice));
            nextPrice = Number(nextPrice.toFixed(cfg.decimals));
            m.price = nextPrice;

            // Decay drift & volatility boost gradually
            m.drift *= 0.82;
            m.volBoost = Math.max(1.0, 1.0 + (m.volBoost - 1.0) * 0.88);

            // Update current active M1 candle or open a new M1 candle (keep up to 360 M1 candles)
            const candles = m.candles;
            if (state.candleTick === 1) {
                m.lastCandleId = (m.lastCandleId || candles.length) + 1;
                candles.push({ id: m.lastCandleId, o: nextPrice, h: nextPrice, l: nextPrice, c: nextPrice });
                if (candles.length > 360) candles.shift();
            } else {
                const cur = candles[candles.length - 1];
                if (cur) {
                    if (nextPrice > cur.h) cur.h = nextPrice;
                    if (nextPrice < cur.l) cur.l = nextPrice;
                    cur.c = nextPrice;
                }
            }
        }

        function triggerInstantNews() {
            const ev = state.upcomingNews;
            if (!ev) return;

            state.markets.XAUUSD.price = Number((state.markets.XAUUSD.price * (1 + ev.xauShock)).toFixed(2));
            state.markets.XAUUSD.drift = ev.xauShock * 0.18;
            state.markets.XAUUSD.volBoost = ev.volMult;

            state.markets.BTCUSD.price = Number((state.markets.BTCUSD.price * (1 + ev.btcShock)).toFixed(2));
            state.markets.BTCUSD.drift = ev.btcShock * 0.18;
            state.markets.BTCUSD.volBoost = ev.volMult;

            ['XAUUSD', 'BTCUSD'].forEach(pid => {
                const m = state.markets[pid];
                const cur = m.candles[m.candles.length - 1];
                if (cur) {
                    cur.c = m.price;
                    if (m.price > cur.h) cur.h = m.price;
                    if (m.price < cur.l) cur.l = m.price;
                }
            });

            AudioSynth.play('news');
            addLog(`RILIS MAKRO: <b>${ev.title}</b> (XAU ${(ev.xauShock * 100).toFixed(2)}%, BTC ${(ev.btcShock * 100).toFixed(2)}%)`, 'NEWS');

            const nextEv = MACRO_NEWS_POOL[Math.floor(seededRandom() * MACRO_NEWS_POOL.length)];
            state.upcomingNews = {
                ...nextEv,
                ticksLeft: 30 + Math.floor(seededRandom() * 20)
            };

            evaluatePendingOrders();
            evaluateOpenPositions();
            renderAll();
        }

        // Check and trigger Pending Orders (Buy Limit, Sell Limit, Buy Stop, Sell Stop)
        function evaluatePendingOrders() {
            if (!state.pendingOrders || state.pendingOrders.length === 0) return;

            for (let i = state.pendingOrders.length - 1; i >= 0; i--) {
                const po = state.pendingOrders[i];
                const { bid, ask } = getBidAsk(po.pair);
                const cfg = PAIR_CONFIGS[po.pair];

                let triggered = false;
                if (po.orderType === 'BUY LIMIT' && ask <= po.triggerPrice) triggered = true;
                else if (po.orderType === 'SELL LIMIT' && bid >= po.triggerPrice) triggered = true;
                else if (po.orderType === 'BUY STOP' && ask >= po.triggerPrice) triggered = true;
                else if (po.orderType === 'SELL STOP' && bid <= po.triggerPrice) triggered = true;

                if (triggered) {
                    state.pendingOrders.splice(i, 1);

                    // Check Free Margin before converting to live position
                    const rawFill = po.side === 'LONG' ? ask : bid;
                    // STOP orders can experience news slippage; LIMIT orders fill at trigger or better unless extreme gap
                    const slipRes = po.orderType.includes('STOP')
                        ? applyExecutionSlippage(po.pair, po.side, rawFill, false)
                        : { finalPrice: rawFill, slippagePoints: 0 };

                    const fillPrice = slipRes.finalPrice;
                    const reqMargin = (po.size * fillPrice) / po.leverage;
                    const { freeMargin } = getAccountMetrics();

                    if (reqMargin > freeMargin) {
                        AudioSynth.play('sl');
                        addLog(`PENDING #${po.id} (${po.orderType} ${po.pair}) DIBATALKAN: Margin bebas tidak mencukupi saat harga tersentuh.`, 'SL');
                        continue;
                    }

                    const liqFactor = (1 - (getLiquidationMarginLevel() / 100)) / po.leverage;
                    const estLiq = po.side === 'LONG'
                        ? Number((fillPrice * (1 - liqFactor)).toFixed(cfg.decimals))
                        : Number((fillPrice * (1 + liqFactor)).toFixed(cfg.decimals));

                    const newPos = {
                        id: po.id,
                        pair: po.pair,
                        side: po.side,
                        size: po.size,
                        leverage: po.leverage,
                        entryPrice: fillPrice,
                        margin: reqMargin,
                        stopLoss: po.stopLoss,
                        takeProfit: po.takeProfit,
                        trailingDistance: po.trailingDistance || 0,
                        cumSwap: 0,
                        estLiq: estLiq
                    };

                    state.positions.push(newPos);
                    AudioSynth.play('pending_fill');
                    const slipNote = slipRes.slippagePoints > 0 ? ` (Slippage: $${slipRes.slippagePoints})` : '';
                    addLog(`PENDING TRIGGERED: <b>${po.orderType} ${fmtLot(po.pair, po.size)} lot ${po.pair}</b> tereksekusi @ ${fmtUSD(fillPrice)}${slipNote}`, 'PENDING');
                }
            }
        }

        // Apply Rollover Swap (XAUUSD) & Dynamic Funding Rate (BTCUSD) every 25 ticks
        function processSwapAndFunding() {
            if (state.positions.length === 0) return;

            let netSwapTotal = 0;
            state.positions.forEach(pos => {
                const notional = pos.size * state.markets[pos.pair].price;
                let feeOrRebate = 0;

                if (pos.pair === 'XAUUSD') {
                    // Gold Spot Rollover Swap: Longs pay -0.018% of notional, Shorts pay -0.008%
                    const swapRate = pos.side === 'LONG' ? -0.00018 : -0.00008;
                    feeOrRebate = Number((notional * swapRate).toFixed(2));
                } else {
                    // BTC Perpetual Dynamic Funding Rate based on current price vs 24h open
                    const m = state.markets.BTCUSD;
                    const bias = (m.price - m.open24h) / m.open24h; // positive = bullish regime (Longs pay Shorts)
                    const baseFundingRate = Math.max(-0.0006, Math.min(0.0006, bias * 0.025 + 0.0001));
                    // If baseFundingRate > 0, LONG pays (-) and SHORT receives (+)
                    feeOrRebate = pos.side === 'LONG'
                        ? Number((-notional * baseFundingRate).toFixed(2))
                        : Number((notional * baseFundingRate).toFixed(2));
                }

                pos.cumSwap = Number(((pos.cumSwap || 0) + feeOrRebate).toFixed(2));
                state.balance += feeOrRebate;
                state.realizedPnL += feeOrRebate;
                state.totalSwapPaid = Number(((state.totalSwapPaid || 0) + feeOrRebate).toFixed(2));
                netSwapTotal += feeOrRebate;
            });

            if (Math.abs(netSwapTotal) >= 0.01) {
                const sign = netSwapTotal >= 0 ? '+' : '';
                addLog(`SIKLUS SWAP & FUNDING: Total penyesuaian biaya inap akun <b>${sign}${fmtUSD(netSwapTotal)}</b>.`, 'SWAP');
            }
        }

        function evaluateOpenPositions() {
            // 1. Update Automatic Trailing Stop & Check SL / TP hits
            for (let i = state.positions.length - 1; i >= 0; i--) {
                const pos = state.positions[i];
                const cfg = PAIR_CONFIGS[pos.pair];
                const { bid, ask } = getBidAsk(pos.pair);
                const exitPrice = pos.side === 'LONG' ? bid : ask;

                // Ratchet Trailing Stop if enabled
                if (pos.trailingDistance && pos.trailingDistance > 0) {
                    if (pos.side === 'LONG') {
                        const candidateSL = Number((exitPrice - pos.trailingDistance).toFixed(cfg.decimals));
                        if (!pos.stopLoss || candidateSL > pos.stopLoss) {
                            pos.stopLoss = candidateSL;
                        }
                    } else {
                        const candidateSL = Number((exitPrice + pos.trailingDistance).toFixed(cfg.decimals));
                        if (!pos.stopLoss || candidateSL < pos.stopLoss) {
                            pos.stopLoss = candidateSL;
                        }
                    }
                }

                let hitReason = null;
                if (pos.stopLoss) {
                    if (pos.side === 'LONG' && exitPrice <= pos.stopLoss) hitReason = 'SL';
                    if (pos.side === 'SHORT' && exitPrice >= pos.stopLoss) hitReason = 'SL';
                }
                if (!hitReason && pos.takeProfit) {
                    if (pos.side === 'LONG' && exitPrice >= pos.takeProfit) hitReason = 'TP';
                    if (pos.side === 'SHORT' && exitPrice <= pos.takeProfit) hitReason = 'TP';
                }

                if (hitReason) {
                    closePositionById(pos.id, hitReason, 1.0);
                }
            }

            // 2. Check Margin Call / Forced Liquidation
            const metrics = getAccountMetrics();
            const liqThreshold = getLiquidationMarginLevel();

            if (state.positions.length > 0 && metrics.marginLevel <= liqThreshold) {
                AudioSynth.play('margin_call');
                const lostAmount = metrics.floatingPnL;
                state.balance = Math.max(0, metrics.equity);
                state.realizedPnL += lostAmount;
                archiveOpenPositions('MARGIN CALL', true);

                showBannerAlert(`MARGIN CALL! Margin Level turun di bawah ${liqThreshold.toFixed(0)}%. Seluruh posisi terbuka telah dilikuidasi paksa oleh broker!`);
                addLog(`MARGIN CALL DARURAT: Seluruh posisi dilikuidasi pada Ekuitas ${fmtUSD(state.balance)}!`, 'SL');
            }

            // 3. Check Prop-Firm Challenge Pass or Max Drawdown Breach
            const afterMetrics = getAccountMetrics();
            const curTier = getTier();

            if (afterMetrics.equity >= curTier.targetEquity) {
                handlePropTierPromotion();
            } else if (afterMetrics.equity <= curTier.maxDrawdownEquity) {
                handlePropDrawdownBreach();
            }
        }

        function handlePropTierPromotion() {
            const curTier = getTier();
            const bonus = curTier.profitSplitBonus;
            state.wallet += bonus;

            AudioSynth.play('tp');

            if (state.tierIndex < PROP_TIERS.length - 1) {
                archiveOpenPositions('TIER-UP', true);
                state.pendingOrders = [];
                state.tierIndex += 1;
                const nextTier = getTier();
                state.balance = nextTier.startBalance;

                showBannerAlert(`SELAMAT! Anda lulus ${curTier.name}! Anda menerima Bonus Bagi Hasil <b>${fmtUSD(bonus)}</b> di Dompet Profit dan kini mengelola <b>${nextTier.name}</b>!`);
                addLog(`LULUS PROP-FIRM! Naik ke <b>${nextTier.name}</b> + Bonus Dompet Profit ${fmtUSD(bonus)}!`, 'PROP');
            } else {
                curTier.targetEquity = Math.round(curTier.targetEquity * 1.15);
                showBannerAlert(`TARGET WHALE TERCAPAI! Bonus Bagi Hasil <b>${fmtUSD(bonus)}</b> telah ditransfer ke Dompet Profit Anda!`);
                addLog(`MILESTONE WHALE TERCAPAI: +${fmtUSD(bonus)} ditambahkan ke Dompet Profit!`, 'PROP');
            }
        }

        function handlePropDrawdownBreach() {
            const curTier = getTier();
            AudioSynth.play('margin_call');
            archiveOpenPositions('DRAWDOWN', true);
            state.pendingOrders = [];
            state.balance = curTier.startBalance;

            if (state.tierIndex === OWN_TIER_INDEX) {
                showBannerAlert(`MODAL HABIS! Akun modal sendiri di-reset ke saldo awal ${fmtUSD(curTier.startBalance)}.`);
                addLog('MODAL HABIS: ekuitas menyentuh $0, akun di-reset ke saldo awal.', 'SL');
                return;
            }
            showBannerAlert(`PELANGGARAN MAX DRAWDOWN (${fmtUSD(curTier.maxDrawdownEquity)})! Akun evaluasi ${curTier.name} telah di-reset kembali ke modal awal ${fmtUSD(curTier.startBalance)}.`);
            addLog(`GAGAL UJIAN PROP: Ekuitas menyentuh batas Max Drawdown (${fmtUSD(curTier.maxDrawdownEquity)}). Akun di-reset otomatis.`, 'SL');
        }

        function runQuantAutoBot() {
            if (!state.quantBotActive || state.upgrades.quantBot <= 0) return;
            const botLvl = state.upgrades.quantBot;
            ['XAUUSD', 'BTCUSD'].forEach(pid => {
                const candles = state.markets[pid].candles;
                const rsis = calculateRSIArray(candles, 14);
                const lastRsi = rsis[rsis.length - 1] || 50;

                if (lastRsi <= 34 || lastRsi >= 66) {
                    const yieldUSD = Number(((state.balance * 0.0018 * botLvl) * (0.7 + seededRandom() * 0.6)).toFixed(2));
                    state.balance += yieldUSD;
                    state.wallet += Number((yieldUSD * 0.25).toFixed(2));
                    state.realizedPnL += yieldUSD;
                    const signalType = lastRsi <= 34 ? 'Oversold Long Scalp' : 'Overbought Short Scalp';
                    addLog(`[BOT QUANT RSI] ${pid} (${signalType} @ RSI ${lastRsi.toFixed(1)}) -> Profit <b>+${fmtUSD(yieldUSD)}</b>`, 'PROP');
                }
            });
        }

        function stepSimulation() {
            state.tickCount += 1;
            state.candleTick = (state.candleTick % 10) + 1;

            // Step both markets simultaneously
            stepMarketPair('XAUUSD');
            stepMarketPair('BTCUSD');

            // Step Swap / Funding countdown
            state.fundingCountdown = (state.fundingCountdown || 25) - 1;
            if (state.fundingCountdown <= 0) {
                state.fundingCountdown = 25;
                processSwapAndFunding();
            }

            // Step macro news countdown
            state.upcomingNews.ticksLeft -= 1;
            if (state.upcomingNews.ticksLeft <= 0) {
                triggerInstantNews();
                return;
            }

            if (state.candleTick === 10) {
                runQuantAutoBot();
            }

            evaluatePendingOrders();
            evaluateOpenPositions();
            state.prngState = prngState;
            saveGameState();
            renderAll();
        }

        function manualStepTick() {
            AudioSynth.play('order');
            stepSimulation();
        }

        function setSimSpeed(spd) {
            setSimSpeedCore(spd);
            if (typeof uiSyncSpeed === 'function') uiSyncSpeed();
        }

        function setSimSpeedCore(spd) {
            simSpeed = spd;
            if (simTimer) {
                clearInterval(simTimer);
                simTimer = null;
            }
            [0, 1, 2, 5].forEach(s => {
                const btn = document.getElementById(`spd-${s}`);
                if (!btn) return;
                btn.className = s === spd
                    ? 'px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-bold'
                    : 'px-2 py-0.5 rounded text-slate-400 hover:text-white';
            });

            if (spd > 0) {
                const ms = spd === 1 ? 500 : (spd === 2 ? 250 : 100);
                simTimer = setInterval(stepSimulation, ms);
            }
        }

        /******************************************************************
         * 8. TRADING ENGINE v2.0: MARKET, PENDING, PARTIAL CLOSE & TRAIL
         ******************************************************************/
        function setOrderMode(mode) {
            currentOrderMode = mode;
            ['MARKET', 'LIMIT', 'STOP'].forEach(m => {
                const btn = document.getElementById(`omode-${m}`);
                if (!btn) return;
                btn.className = m === mode
                    ? 'py-1.5 rounded bg-emerald-500 text-slate-950 transition font-bold'
                    : 'py-1.5 rounded text-slate-400 hover:text-white transition';
            });

            const pBox = document.getElementById('pending-price-box');
            if (mode === 'MARKET') {
                pBox.classList.add('hidden');
            } else {
                pBox.classList.remove('hidden');
                document.getElementById('pending-mode-label').textContent =
                    mode === 'LIMIT' ? 'HARGA TRIGGER LIMIT ($):' : 'HARGA TRIGGER STOP ($):';
                setPendingPriceOffset(mode === 'LIMIT' ? -0.0025 : 0.0025);
            }
            updateOrderPreview();
        }

        function setPendingPriceOffset(pctOffset) {
            const cfg = PAIR_CONFIGS[state.activePair];
            const mid = state.markets[state.activePair].price;
            const target = Number((mid * (1 + pctOffset)).toFixed(cfg.decimals));
            document.getElementById('input-pending-price').value = target;
            updateOrderPreview();
        }

        function selectPair(pairId) {
            if (!PAIR_CONFIGS[pairId]) return;
            state.activePair = pairId;
            const cfg = PAIR_CONFIGS[pairId];

            document.getElementById('input-order-size').value = unitsToLots(pairId, cfg.defaultSize);
            const levSlider = document.getElementById('slider-leverage');
            levSlider.max = cfg.maxLeverage;
            if (Number(levSlider.value) > cfg.maxLeverage) {
                levSlider.value = cfg.maxLeverage;
            }
            if (currentOrderMode !== 'MARKET') {
                setPendingPriceOffset(currentOrderMode === 'LIMIT' ? -0.0025 : 0.0025);
            }
            onLeverageChange(levSlider.value);
            clearSLTPInputs();
            populateLeveragePresets();
            renderAll();
        }

        function populateLeveragePresets() {
            const cfg = PAIR_CONFIGS[state.activePair];
            const container = document.getElementById('leverage-presets');
            container.innerHTML = '';
            cfg.presetLeverages.forEach(lev => {
                const btn = document.createElement('button');
                btn.className = 'btn-term flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-0.5 rounded text-[10px] font-mono';
                btn.textContent = `1:${lev}`;
                btn.onclick = () => {
                    document.getElementById('slider-leverage').value = lev;
                    onLeverageChange(lev);
                };
                container.appendChild(btn);
            });
        }

        function onLeverageChange(val) {
            document.getElementById('lbl-leverage').textContent = `1 : ${val}`;
            updateOrderPreview();
        }

        function setMarginAllocation(pctOfFreeMargin) {
            const { freeMargin } = getAccountMetrics();
            const lev = Number(document.getElementById('slider-leverage').value) || 10;
            const { ask } = getBidAsk(state.activePair);

            const targetMargin = freeMargin * pctOfFreeMargin;
            const pcfg = PAIR_CONFIGS[state.activePair];
            const rawLots = ((targetMargin * lev) / ask) / pcfg.lotUnits;
            document.getElementById('input-order-size').value = Math.max(pcfg.minLot, Math.floor(rawLots * 100) / 100);
            updateOrderPreview();
        }

        function applyQuickSLTP(side, slPct, tpPct) {
            const cfg = PAIR_CONFIGS[state.activePair];
            const { bid, ask } = getBidAsk(state.activePair);
            let refPrice = side === 'LONG' ? ask : bid;
            if (currentOrderMode !== 'MARKET') {
                const pendVal = parseFloat(document.getElementById('input-pending-price').value);
                if (Number.isFinite(pendVal) && pendVal > 0) refPrice = pendVal;
            }

            if (side === 'LONG') {
                document.getElementById('input-sl').value = (refPrice * (1 - slPct)).toFixed(cfg.decimals);
                document.getElementById('input-tp').value = (refPrice * (1 + tpPct)).toFixed(cfg.decimals);
            } else {
                document.getElementById('input-sl').value = (refPrice * (1 + slPct)).toFixed(cfg.decimals);
                document.getElementById('input-tp').value = (refPrice * (1 - tpPct)).toFixed(cfg.decimals);
            }
        }

        function setQuickTrailPreset(pctDist) {
            const cfg = PAIR_CONFIGS[state.activePair];
            const mid = state.markets[state.activePair].price;
            const dist = Number((mid * pctDist).toFixed(cfg.decimals));
            document.getElementById('input-trail').value = dist;
        }

        function clearSLTPInputs() {
            document.getElementById('input-sl').value = '';
            document.getElementById('input-tp').value = '';
            document.getElementById('input-trail').value = '';
        }

        function updateOrderPreview() {
            updateOrderPreviewCore();
            if (typeof uiSyncOrder === 'function') uiSyncOrder();
        }

        function updateOrderPreviewCore() {
            const pairId = state.activePair;
            const cfg = PAIR_CONFIGS[pairId];
            const { bid, ask, mid } = getBidAsk(pairId);
            const spread = getSpread(pairId);
            const size = readOrderUnits(pairId);
            const lev = Math.max(1, Number(document.getElementById('slider-leverage').value) || 20);

            const refPrice = currentOrderMode === 'MARKET'
                ? mid
                : (parseFloat(document.getElementById('input-pending-price').value) || mid);

            const notional = size * refPrice;
            const reqMargin = notional / lev;
            const spreadCost = size * spread;
            const slipProtect = Math.round(getSlippageProtectionPct() * 100);

            const liqFactor = (1 - (getLiquidationMarginLevel() / 100)) / lev;
            const estLiqLong = refPrice * (1 - liqFactor);
            const estLiqShort = refPrice * (1 + liqFactor);

            document.getElementById('order-pair-title').textContent = `${cfg.name} (${cfg.subtitle})`;
            document.getElementById('order-spread-label').textContent = `Spread: $${spread.toFixed(2)}`;
            document.getElementById('order-bid-price').textContent = fmtUSD(bid, cfg.decimals);
            document.getElementById('order-ask-price').textContent = fmtUSD(ask, cfg.decimals);
            document.getElementById('order-unit-name').textContent = `1 lot = ${cfg.lotUnits} ${cfg.unitName}`;
            document.getElementById('order-notional-val').textContent = `Nilai Kontrak: ${fmtUSD(notional, 0)}`;

            document.getElementById('preview-req-margin').textContent = fmtUSD(reqMargin);
            document.getElementById('preview-spread-cost').textContent =
                `${fmtUSD(spreadCost)} (Anti-Slip ${slipProtect}%)`;
            document.getElementById('preview-liq-price').textContent =
                `${fmtUSD(estLiqLong, 0)} / ${fmtUSD(estLiqShort, 0)}`;

            if (currentOrderMode === 'MARKET') {
                document.getElementById('btn-long-title').textContent = 'BUY / LONG';
                document.getElementById('btn-short-title').textContent = 'SELL / SHORT';
                document.getElementById('btn-long-sub').textContent = `Market @ ${fmtUSD(ask, cfg.decimals)}`;
                document.getElementById('btn-short-sub').textContent = `Market @ ${fmtUSD(bid, cfg.decimals)}`;
            } else if (currentOrderMode === 'LIMIT') {
                document.getElementById('btn-long-title').textContent = 'BUY LIMIT';
                document.getElementById('btn-short-title').textContent = 'SELL LIMIT';
                document.getElementById('btn-long-sub').textContent = `Trigger ≤ ${fmtUSD(refPrice, cfg.decimals)}`;
                document.getElementById('btn-short-sub').textContent = `Trigger ≥ ${fmtUSD(refPrice, cfg.decimals)}`;
            } else {
                document.getElementById('btn-long-title').textContent = 'BUY STOP';
                document.getElementById('btn-short-title').textContent = 'SELL STOP';
                document.getElementById('btn-long-sub').textContent = `Breakout ≥ ${fmtUSD(refPrice, cfg.decimals)}`;
                document.getElementById('btn-short-sub').textContent = `Breakout ≤ ${fmtUSD(refPrice, cfg.decimals)}`;
            }
        }

        function executeOrder(side) {
            const pairId = state.activePair;
            const cfg = PAIR_CONFIGS[pairId];
            const { bid, ask } = getBidAsk(pairId);
            const size = readOrderUnits(pairId);
            const lev = Math.min(cfg.maxLeverage, Math.max(1, Number(document.getElementById('slider-leverage').value)));

            if (!size || size <= 0) return;

            const slRaw = parseFloat(document.getElementById('input-sl').value);
            const tpRaw = parseFloat(document.getElementById('input-tp').value);
            const trailRaw = parseFloat(document.getElementById('input-trail').value);

            let stopLoss = Number.isFinite(slRaw) && slRaw > 0 ? Number(slRaw.toFixed(cfg.decimals)) : null;
            let takeProfit = Number.isFinite(tpRaw) && tpRaw > 0 ? Number(tpRaw.toFixed(cfg.decimals)) : null;
            let trailingDistance = Number.isFinite(trailRaw) && trailRaw > 0 ? Number(trailRaw.toFixed(cfg.decimals)) : 0;

            // BRANCH 1: PENDING ORDER (LIMIT OR STOP)
            if (currentOrderMode !== 'MARKET') {
                let triggerPrice = parseFloat(document.getElementById('input-pending-price').value);
                if (!Number.isFinite(triggerPrice) || triggerPrice <= 0) {
                    AudioSynth.play('sl');
                    addLog('Masukkan Harga Trigger Pending yang valid terlebih dahulu.', 'SL');
                    return;
                }

                const orderType = `${side === 'LONG' ? 'BUY' : 'SELL'} ${currentOrderMode}`;

                // Auto-adjust trigger price slightly if placed on the wrong side of current market
                if (orderType === 'BUY LIMIT' && triggerPrice >= ask) {
                    triggerPrice = Number((ask * 0.997).toFixed(cfg.decimals));
                } else if (orderType === 'SELL LIMIT' && triggerPrice <= bid) {
                    triggerPrice = Number((bid * 1.003).toFixed(cfg.decimals));
                } else if (orderType === 'BUY STOP' && triggerPrice <= ask) {
                    triggerPrice = Number((ask * 1.003).toFixed(cfg.decimals));
                } else if (orderType === 'SELL STOP' && triggerPrice >= bid) {
                    triggerPrice = Number((bid * 0.997).toFixed(cfg.decimals));
                }

                // Validate SL/TP relative to triggerPrice
                if (side === 'LONG') {
                    if (stopLoss && stopLoss >= triggerPrice) stopLoss = Number((triggerPrice * 0.992).toFixed(cfg.decimals));
                    if (takeProfit && takeProfit <= triggerPrice) takeProfit = Number((triggerPrice * 1.012).toFixed(cfg.decimals));
                } else {
                    if (stopLoss && stopLoss <= triggerPrice) stopLoss = Number((triggerPrice * 1.008).toFixed(cfg.decimals));
                    if (takeProfit && takeProfit >= triggerPrice) takeProfit = Number((triggerPrice * 0.988).toFixed(cfg.decimals));
                }

                const pendingObj = {
                    id: state.nextPosId++,
                    pair: pairId,
                    side: side,
                    orderType: orderType,
                    size: size,
                    leverage: lev,
                    triggerPrice: triggerPrice,
                    stopLoss: stopLoss,
                    takeProfit: takeProfit,
                    trailingDistance: trailingDistance
                };

                state.pendingOrders.push(pendingObj);
                AudioSynth.play('order');
                addLog(`PASANG PENDING: <b>${orderType} ${fmtLot(pairId, size)} lot ${pairId}</b> @ Trigger ${fmtUSD(triggerPrice)}`, 'PENDING');
                saveGameState();
                renderAll();
                return;
            }

            // BRANCH 2: INSTANT MARKET ORDER (With News Slippage check)
            const rawEntry = side === 'LONG' ? ask : bid;
            const slipRes = applyExecutionSlippage(pairId, side, rawEntry, false);
            const entryPrice = slipRes.finalPrice;

            const reqMargin = (size * entryPrice) / lev;
            const { freeMargin } = getAccountMetrics();

            if (reqMargin > freeMargin) {
                AudioSynth.play('sl');
                addLog(`ORDER DITOLAK: Margin Bebas (${fmtUSD(freeMargin)}) tidak cukup untuk Margin Order (${fmtUSD(reqMargin)}).`, 'SL');
                return;
            }

            if (side === 'LONG') {
                if (stopLoss && stopLoss >= bid) stopLoss = Number((entryPrice * 0.992).toFixed(cfg.decimals));
                if (takeProfit && takeProfit <= ask) takeProfit = Number((entryPrice * 1.012).toFixed(cfg.decimals));
            } else {
                if (stopLoss && stopLoss <= ask) stopLoss = Number((entryPrice * 1.008).toFixed(cfg.decimals));
                if (takeProfit && takeProfit >= bid) takeProfit = Number((entryPrice * 0.988).toFixed(cfg.decimals));
            }

            // If trailingDistance is set and stopLoss is empty, initialize stopLoss automatically
            if (trailingDistance > 0 && !stopLoss) {
                stopLoss = side === 'LONG'
                    ? Number((entryPrice - trailingDistance).toFixed(cfg.decimals))
                    : Number((entryPrice + trailingDistance).toFixed(cfg.decimals));
            }

            const liqFactor = (1 - (getLiquidationMarginLevel() / 100)) / lev;
            const estLiq = side === 'LONG'
                ? Number((entryPrice * (1 - liqFactor)).toFixed(cfg.decimals))
                : Number((entryPrice * (1 + liqFactor)).toFixed(cfg.decimals));

            const pos = {
                id: state.nextPosId++,
                pair: pairId,
                side: side,
                size: size,
                leverage: lev,
                entryPrice: entryPrice,
                margin: reqMargin,
                stopLoss: stopLoss,
                takeProfit: takeProfit,
                trailingDistance: trailingDistance,
                cumSwap: 0,
                estLiq: estLiq
            };

            state.positions.push(pos);
            AudioSynth.play('order');
            const slipNote = slipRes.slippagePoints > 0 ? ` <span class="text-rose-400">[Slippage Berita: $${slipRes.slippagePoints}]</span>` : '';
            addLog(
                `OPEN <b>${side} ${fmtLot(pairId, size)} lot ${pairId}</b> (1:${lev}) @ ${fmtUSD(entryPrice)} | Margin: ${fmtUSD(reqMargin)}${slipNote}`,
                side
            );

            saveGameState();
            renderAll();
        }

        // Supports full close (fraction = 1.0) and Partial Close (0.25, 0.50, 0.75)
        function closePositionById(posId, reason = 'MANUAL', fraction = 1.0) {
            const idx = state.positions.findIndex(p => p.id === posId);
            if (idx === -1) return;

            const pos = state.positions[idx];
            const cfg = PAIR_CONFIGS[pos.pair];
            const { bid, ask } = getBidAsk(pos.pair);
            let rawExit = pos.side === 'LONG' ? bid : ask;

            // Apply adverse slippage if closed by SL during high-impact news
            let slipNote = '';
            if (reason === 'SL') {
                const slipRes = applyExecutionSlippage(pos.pair, pos.side, rawExit, true);
                rawExit = slipRes.finalPrice;
                if (slipRes.slippagePoints > 0) {
                    slipNote = ` [Slippage SL: $${slipRes.slippagePoints}]`;
                }
            }

            const stepDec = 4;
            let closeSize = pos.size;
            let isPartial = false;

            if (fraction < 0.99) {
                const calcPart = Number((Math.round(pos.size * fraction / cfg.lotUnits * 100) / 100 * cfg.lotUnits).toFixed(stepDec));
                const minLot = cfg.minLot * cfg.lotUnits;
                if (calcPart >= minLot - 1e-9 && (pos.size - calcPart) >= minLot - 1e-9) {
                    closeSize = calcPart;
                    isPartial = true;
                }
            }

            const actualRatio = closeSize / pos.size;
            const totalCurrentPnL = calculatePositionPnL(pos, rawExit);
            const realizedSlicePnL = Number((totalCurrentPnL * actualRatio).toFixed(2));

            if (isPartial) {
                pos.size = Number((pos.size - closeSize).toFixed(stepDec));
                pos.margin = Number((pos.margin * (1 - actualRatio)).toFixed(2));
            } else {
                state.positions.splice(idx, 1);
                state.totalTrades += 1;
                if (realizedSlicePnL > 0) state.wins += 1;
            }

            state.balance += realizedSlicePnL;
            state.realizedPnL += realizedSlicePnL;
            recordTrade(pos, closeSize, rawExit, realizedSlicePnL, reason, isPartial);

            if (realizedSlicePnL > 0) {
                const splitPct = getTier().splitPct / 100;
                const walletCut = Number((realizedSlicePnL * splitPct * 0.25).toFixed(2));
                state.wallet += walletCut;
                AudioSynth.play('tp');
            } else {
                AudioSynth.play('sl');
            }

            const sign = realizedSlicePnL >= 0 ? '+' : '';
            const actionLabel = isPartial ? `PARTIAL CLOSE (${Math.round(fraction * 100)}%)` : `CLOSE [${reason}]`;
            addLog(
                `${actionLabel} <b>${pos.side} ${fmtLot(pos.pair, closeSize)} lot ${pos.pair}</b> @ ${fmtUSD(rawExit, cfg.decimals)} | PnL: <b>${sign}${fmtUSD(realizedSlicePnL)}</b>${slipNote}`,
                realizedSlicePnL >= 0 ? 'TP' : 'SL'
            );

            saveGameState();
            renderAll();
        }

        function togglePositionTrailing(posId) {
            const pos = state.positions.find(p => p.id === posId);
            if (!pos) return;
            const cfg = PAIR_CONFIGS[pos.pair];
            if (pos.trailingDistance && pos.trailingDistance > 0) {
                pos.trailingDistance = 0;
                addLog(`TRAILING STOP NONAKTIF untuk posisi #${pos.id} (${pos.pair}).`, 'INFO');
            } else {
                const defaultTrail = Number((state.markets[pos.pair].price * 0.005).toFixed(cfg.decimals));
                pos.trailingDistance = defaultTrail;
                const { bid, ask } = getBidAsk(pos.pair);
                const curExit = pos.side === 'LONG' ? bid : ask;
                const initSL = pos.side === 'LONG'
                    ? Number((curExit - defaultTrail).toFixed(cfg.decimals))
                    : Number((curExit + defaultTrail).toFixed(cfg.decimals));
                if (!pos.stopLoss || (pos.side === 'LONG' && initSL > pos.stopLoss) || (pos.side === 'SHORT' && initSL < pos.stopLoss)) {
                    pos.stopLoss = initSL;
                }
                addLog(`TRAILING STOP AKTIF (#${pos.id} ${pos.pair}): Jarak otomatis $${defaultTrail} mengikuti profit.`, 'PROP');
            }
            AudioSynth.play('order');
            saveGameState();
            renderAll();
        }

        function cancelPendingOrder(orderId) {
            const idx = state.pendingOrders.findIndex(o => o.id === orderId);
            if (idx === -1) return;
            const ord = state.pendingOrders[idx];
            state.pendingOrders.splice(idx, 1);
            AudioSynth.play('order');
            addLog(`BATALKAN PENDING: Order #${ord.id} (${ord.orderType} ${ord.pair}) dihapus.`, 'INFO');
            saveGameState();
            renderAll();
        }

        function setPositionBEP(posId) {
            const pos = state.positions.find(p => p.id === posId);
            if (!pos) return;
            pos.stopLoss = pos.entryPrice;
            AudioSynth.play('order');
            addLog(`PROTEKSI BEP: Stop Loss posisi #${pos.id} (${pos.pair}) dipindahkan ke Harga Entry (${fmtUSD(pos.entryPrice)}).`, 'INFO');
            saveGameState();
            renderAll();
        }

        function setAllSLToBreakeven() {
            let count = 0;
            state.positions.forEach(pos => {
                if (calculatePositionPnL(pos) > 0) {
                    pos.stopLoss = pos.entryPrice;
                    count++;
                }
            });
            if (count > 0) {
                AudioSynth.play('order');
                addLog(`Set Stop Loss ke Breakeven (BEP) untuk ${count} posisi yang sedang profit.`, 'INFO');
                saveGameState();
                renderAll();
            }
        }

        function closeAllPositions() {
            if (state.positions.length === 0) return;
            const ids = state.positions.map(p => p.id);
            ids.forEach(id => closePositionById(id, 'CLOSE-ALL', 1.0));
        }

        function resetPropChallenge() {
            const curTier = getTier();
            archiveOpenPositions('RESET', false);
            state.pendingOrders = [];
            state.balance = curTier.startBalance;
            AudioSynth.play('order');
            addLog(`RESET UJIAN: Saldo akun dikembalikan ke modal awal ${curTier.name} (${fmtUSD(curTier.startBalance)}).`, 'INFO');
            saveGameState();
            renderAll();
        }

        /******************************************************************
         * 9. QUANT LAB UPGRADES (Including Co-Location Anti-Slippage)
         ******************************************************************/
        function getUpgradeCost(type) {
            const lvl = state.upgrades[type] || 0;
            if (type === 'rawSpread') return Math.round(350 * Math.pow(1.75, lvl));
            if (type === 'coLocation') return Math.round(400 * Math.pow(1.75, lvl));
            if (type === 'macroIntel') return Math.round(500 * Math.pow(2.1, lvl));
            if (type === 'quantBot') return Math.round(600 * Math.pow(1.85, lvl));
            if (type === 'marginShield') return Math.round(450 * Math.pow(1.9, lvl));
            return 9999;
        }

        function buyQuantUpgrade(type) {
            const maxLevels = { rawSpread: 5, coLocation: 5, macroIntel: 3, quantBot: 5, marginShield: 3 };
            const curLvl = state.upgrades[type] || 0;
            if (curLvl >= maxLevels[type]) return;

            const cost = getUpgradeCost(type);
            const curTier = getTier();
            const safeBalanceSpendable = Math.max(0, state.balance - (curTier.maxDrawdownEquity + 250));

            if (state.wallet >= cost) {
                state.wallet -= cost;
            } else if (state.wallet + safeBalanceSpendable >= cost) {
                const remainder = cost - state.wallet;
                state.wallet = 0;
                state.balance -= remainder;
            } else {
                AudioSynth.play('sl');
                addLog(`GAGAL UPGRADE: Dana Dompet Profit / Saldo Aman tidak mencukupi (Butuh ${fmtUSD(cost)}).`, 'SL');
                return;
            }

            state.upgrades[type] = curLvl + 1;
            if (type === 'quantBot') state.quantBotActive = true;

            AudioSynth.play('tp');
            addLog(`LAB QUANT: Upgrade <b>${type}</b> berhasil naik ke Level ${state.upgrades[type]}!`, 'PROP');
            saveGameState();
            renderAll();
        }

        function toggleQuantBot() {
            if (state.upgrades.quantBot <= 0) return;
            state.quantBotActive = !state.quantBotActive;
            AudioSynth.play('order');
            saveGameState();
            renderAll();
        }
