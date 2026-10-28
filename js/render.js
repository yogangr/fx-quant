        /******************************************************************
         * 11. FULL UI SYNCHRONIZATION & DOM RENDERING
         ******************************************************************/
        function switchBottomTab(tab) {
            const posPanel = document.getElementById('bottom-panel-pos');
            const pendPanel = document.getElementById('bottom-panel-pending');
            const logPanel = document.getElementById('bottom-panel-log');

            const btnPos = document.getElementById('subtab-btn-pos');
            const btnPend = document.getElementById('subtab-btn-pending');
            const btnLog = document.getElementById('subtab-btn-log');

            posPanel.classList.add('hidden');
            pendPanel.classList.add('hidden');
            logPanel.classList.add('hidden');

            btnPos.className = 'text-slate-400 hover:text-slate-200 pb-0.5';
            btnPend.className = 'text-slate-400 hover:text-slate-200 pb-0.5';
            btnLog.className = 'text-slate-400 hover:text-slate-200 pb-0.5';

            if (tab === 'pos') {
                posPanel.classList.remove('hidden');
                btnPos.className = 'text-emerald-400 font-bold border-b-2 border-emerald-400 pb-0.5';
            } else if (tab === 'pending') {
                pendPanel.classList.remove('hidden');
                btnPend.className = 'text-amber-400 font-bold border-b-2 border-amber-400 pb-0.5';
            } else {
                logPanel.classList.remove('hidden');
                btnLog.className = 'text-emerald-400 font-bold border-b-2 border-emerald-400 pb-0.5';
            }
        }

        function switchRightTab(tab) {
            const ordPanel = document.getElementById('right-panel-order');
            const qntPanel = document.getElementById('right-panel-quant');
            const btnOrd = document.getElementById('rtab-btn-order');
            const btnQnt = document.getElementById('rtab-btn-quant');

            if (tab === 'order') {
                ordPanel.classList.remove('hidden');
                qntPanel.classList.add('hidden');
                btnOrd.className = 'py-2.5 text-center border-b-2 border-emerald-400 text-emerald-400 bg-[#0b1120]';
                btnQnt.className = 'py-2.5 text-center border-b-2 border-transparent text-slate-400 hover:text-slate-200';
            } else {
                ordPanel.classList.add('hidden');
                qntPanel.classList.remove('hidden');
                btnQnt.className = 'py-2.5 text-center border-b-2 border-cyan-400 text-cyan-400 bg-[#0b1120]';
                btnOrd.className = 'py-2.5 text-center border-b-2 border-transparent text-slate-400 hover:text-slate-200';
            }
        }

        function renderAll() {
            const metrics = getAccountMetrics();
            const curTier = getTier();
            const liqThreshold = getLiquidationMarginLevel();

            // 1. Top Header & KPI Cards
            document.getElementById('ui-tick-count').textContent = state.tickCount;
            document.getElementById('ui-seed-code').textContent = state.seed;
            document.getElementById('ui-funding-timer').textContent = `${state.fundingCountdown || 25}t`;
            document.getElementById('tier-badge').textContent = curTier.name;

            document.getElementById('kpi-balance').textContent = fmtUSD(state.balance);
            document.getElementById('kpi-wallet').textContent = fmtUSD(state.wallet);
            document.getElementById('kpi-equity').textContent = fmtUSD(metrics.equity);

            const roiPct = ((metrics.equity - curTier.startBalance) / curTier.startBalance) * 100;
            const roiEl = document.getElementById('kpi-roi-badge');
            roiEl.textContent = `${roiPct >= 0 ? '+' : ''}${roiPct.toFixed(2)}%`;
            roiEl.className = roiPct >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold';

            document.getElementById('kpi-drawdown-floor').innerHTML =
                `Batas Drawdown: <span class="text-rose-400 font-semibold">${fmtUSD(curTier.maxDrawdownEquity, 0)}</span>`;

            const flEl = document.getElementById('kpi-floating');
            flEl.textContent = (metrics.floatingPnL >= 0 ? '+' : '') + fmtUSD(metrics.floatingPnL);
            flEl.className = `text-base sm:text-lg font-bold font-mono-num mt-0.5 ${metrics.floatingPnL > 0 ? 'text-emerald-400' : (metrics.floatingPnL < 0 ? 'text-rose-400' : 'text-slate-300')}`;
            document.getElementById('kpi-open-count').textContent = `${state.positions.length} Posisi | ${state.pendingOrders.length} Pending`;
            document.getElementById('pos-tab-count').textContent = state.positions.length;
            document.getElementById('pending-tab-count').textContent = state.pendingOrders.length;

            document.getElementById('kpi-used-margin').textContent = fmtUSD(metrics.usedMargin);
            document.getElementById('kpi-free-margin').textContent = fmtUSD(metrics.freeMargin);
            const marginUsagePct = metrics.equity > 0 ? Math.min(100, (metrics.usedMargin / metrics.equity) * 100) : 0;
            document.getElementById('kpi-margin-bar').style.width = `${marginUsagePct}%`;

            // Margin Level Card
            const mlCard = document.getElementById('card-margin-level');
            const mlText = document.getElementById('kpi-margin-level');
            const mlStatus = document.getElementById('kpi-margin-status');
            document.getElementById('kpi-liq-threshold').textContent = `MC ≤ ${liqThreshold.toFixed(0)}%`;

            if (!Number.isFinite(metrics.marginLevel)) {
                mlText.innerHTML = '&infin; %';
                mlText.className = 'text-base sm:text-lg font-bold font-mono-num text-emerald-400 mt-0.5';
                mlStatus.textContent = 'Status: AMAN (Tanpa Beban)';
                mlCard.className = 'p-2 px-3 flex flex-col justify-between';
            } else {
                mlText.textContent = `${metrics.marginLevel.toFixed(1)}%`;
                if (metrics.marginLevel <= 110) {
                    mlText.className = 'text-base sm:text-lg font-bold font-mono-num text-rose-400 mt-0.5';
                    mlStatus.textContent = 'BAHAYA: Mendekati Margin Call!';
                    mlCard.className = 'p-2 px-3 flex flex-col justify-between margin-call-flash';
                } else if (metrics.marginLevel <= 200) {
                    mlText.className = 'text-base sm:text-lg font-bold font-mono-num text-amber-300 mt-0.5';
                    mlStatus.textContent = 'Status: WASPADA LEVERAGE';
                    mlCard.className = 'p-2 px-3 flex flex-col justify-between';
                } else {
                    mlText.className = 'text-base sm:text-lg font-bold font-mono-num text-emerald-400 mt-0.5';
                    mlStatus.textContent = 'Status: MARGIN SEHAT';
                    mlCard.className = 'p-2 px-3 flex flex-col justify-between';
                }
            }

            // Prop-Firm Target Progress
            const targetSpan = curTier.targetEquity - curTier.startBalance;
            const currentGain = metrics.equity - curTier.startBalance;
            const targetProgress = Math.max(0, Math.min(100, (currentGain / targetSpan) * 100));
            document.getElementById('kpi-target-text').textContent = `Target: ${fmtUSD(curTier.targetEquity, 0)}`;
            document.getElementById('kpi-target-pct').textContent = `${targetProgress.toFixed(0)}%`;
            document.getElementById('kpi-target-bar').style.width = `${targetProgress}%`;
            document.getElementById('prop-split-label').textContent = `Bagi Hasil: ${curTier.splitPct}%`;

            // 2. Macro News Ticker & Slippage Warning Badge
            const ev = state.upcomingNews;
            document.getElementById('news-upcoming-title').textContent = ev.title;
            document.getElementById('news-countdown-badge').textContent = `${ev.ticksLeft} Tick`;

            const isHighVol = state.markets[state.activePair].volBoost > 1.25 && getSlippageProtectionPct() < 1.0;
            const slipBadge = document.getElementById('news-slippage-badge');
            if (isHighVol) slipBadge.classList.remove('hidden');
            else slipBadge.classList.add('hidden');

            const intelEl = document.getElementById('news-intel-text');
            const intelLvl = state.upgrades.macroIntel || 0;
            if (intelLvl <= 0) {
                intelEl.textContent = 'Terkunci: Upgrade Terminal Intelijen Makro di Lab Quant.';
                intelEl.className = 'text-slate-400 truncate text-[11px]';
            } else {
                const revealThreshold = intelLvl * 14;
                if (ev.ticksLeft <= revealThreshold) {
                    intelEl.textContent = `BOCORAN KONSENSUS: ${ev.hint}`;
                    intelEl.className = 'text-emerald-300 font-bold truncate text-[11px]';
                } else {
                    intelEl.textContent = `Memindai sinyal satelit... (Bocoran terbuka dalam ${ev.ticksLeft - revealThreshold} tick)`;
                    intelEl.className = 'text-indigo-300 truncate text-[11px]';
                }
            }

            // 3. Pair Switcher Tabs (XAUUSD & BTCUSD)
            ['XAUUSD', 'BTCUSD'].forEach(pid => {
                const cfg = PAIR_CONFIGS[pid];
                const m = state.markets[pid];
                const chgPct = ((m.price - m.open24h) / m.open24h) * 100;

                document.getElementById(`tab-price-${pid}`).textContent = fmtUSD(m.price, cfg.decimals);
                const chgEl = document.getElementById(`tab-chg-${pid}`);
                chgEl.textContent = `${chgPct >= 0 ? '▲ +' : '▼ '}${chgPct.toFixed(2)}%`;
                chgEl.className = `text-[11px] ${chgPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;

                if (pid === 'XAUUSD') {
                    document.getElementById(`sub-${pid}-regime`).textContent =
                        `Spread: $${getSpread(pid).toFixed(2)} | Swap: -0.018%/25t`;
                } else {
                    const bias = (m.price - m.open24h) / m.open24h;
                    const fRate = (Math.max(-0.0006, Math.min(0.0006, bias * 0.025 + 0.0001)) * 100).toFixed(3);
                    document.getElementById(`sub-${pid}-regime`).textContent =
                        `Spread: $${getSpread(pid).toFixed(2)} | Funding: ${fRate}%/25t`;
                }

                const tabEl = document.getElementById(`tab-pair-${pid}`);
                if (state.activePair === pid) {
                    tabEl.className = pid === 'XAUUSD'
                        ? 'p-2.5 px-3.5 cursor-pointer border-b-2 border-amber-400 bg-amber-500/10 transition flex items-center justify-between'
                        : 'p-2.5 px-3.5 cursor-pointer border-b-2 border-orange-400 bg-orange-500/10 transition flex items-center justify-between border-t sm:border-t-0 sm:border-l border-slate-800';
                } else {
                    tabEl.className = 'p-2.5 px-3.5 cursor-pointer border-b-2 border-transparent hover:bg-slate-900/60 transition flex items-center justify-between border-t sm:border-t-0 sm:border-l border-slate-800 opacity-75';
                }
            });

            // 4. Chart Toolbar Readout & Indicator Buttons
            const aggCandles = getAggregatedCandles(state.activePair, activeTimeframe);
            const lastC = aggCandles[aggCandles.length - 1];
            const activeCfg = PAIR_CONFIGS[state.activePair];
            document.getElementById('chart-candle-progress').textContent = `${activeTimeframe} | Tick ${state.candleTick}/10`;
            if (lastC) {
                document.getElementById('chart-ohlc-readout').textContent =
                    `O: ${lastC.o.toFixed(activeCfg.decimals)} | H: ${lastC.h.toFixed(activeCfg.decimals)} | L: ${lastC.l.toFixed(activeCfg.decimals)} | C: ${lastC.c.toFixed(activeCfg.decimals)}`;
            }

            const setIndBtn = (id, active, col) => {
                const el = document.getElementById(id);
                if (!el) return;
                el.className = active
                    ? `px-2 py-0.5 rounded border border-${col}-500/50 bg-${col}-500/20 text-${col}-300 text-[10px] font-bold`
                    : 'px-2 py-0.5 rounded border border-slate-700 bg-slate-900 text-slate-400 text-[10px]';
            };
            setIndBtn('ind-ema9', indicators.ema9, 'cyan');
            setIndBtn('ind-ema21', indicators.ema21, 'purple');
            setIndBtn('ind-bb', indicators.bb, 'sky');
            setIndBtn('ind-pos', indicators.posLines, 'emerald');

            // 5A. Render Open Positions Table (With Partial Close 25%/50%/75%/100% & Trailing SL)
            const posTbody = document.getElementById('positions-tbody');
            posTbody.innerHTML = '';
            if (state.positions.length === 0) {
                posTbody.innerHTML = `
                    <tr>
                        <td colspan="7" class="py-6 text-center text-slate-500">
                            Belum ada posisi margin terbuka. Pilih mode <b>MARKET / LIMIT / STOP</b> di panel kanan untuk memulai.
                        </td>
                    </tr>
                `;
            } else {
                state.positions.forEach(pos => {
                    const pCfg = PAIR_CONFIGS[pos.pair];
                    const { bid, ask } = getBidAsk(pos.pair);
                    const curExit = pos.side === 'LONG' ? bid : ask;
                    const pnl = calculatePositionPnL(pos);
                    const roePct = pos.margin > 0 ? (pnl / pos.margin) * 100 : 0;
                    const hasTrail = pos.trailingDistance && pos.trailingDistance > 0;
                    const swapVal = pos.cumSwap || 0;

                    const tr = document.createElement('tr');
                    tr.className = 'hover:bg-slate-900/60 transition';
                    tr.innerHTML = `
                        <td class="py-2 px-2">
                            <div class="flex items-center gap-1.5">
                                <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${pos.side === 'LONG' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'}">${pos.side}</span>
                                <span class="font-bold text-white">${pos.pair}</span>
                            </div>
                            <div class="text-[10px] text-orange-400 mt-0.5">Liq: ${fmtUSD(pos.estLiq, pCfg.decimals)}</div>
                        </td>
                        <td class="py-2 px-2 text-right font-mono-num">
                            <div class="text-slate-200 font-bold">${fmtLot(pos.pair, pos.size)}</div>
                            <div class="text-[10px] text-amber-400">1:${pos.leverage} (${fmtUSD(pos.margin, 0)})</div>
                        </td>
                        <td class="py-2 px-2 text-right font-mono-num">
                            <div class="text-slate-300">${fmtUSD(pos.entryPrice, pCfg.decimals)}</div>
                            <div class="text-white font-bold text-[11px]">→ ${fmtUSD(curExit, pCfg.decimals)}</div>
                        </td>
                        <td class="py-2 px-2 text-center font-mono-num text-[11px]">
                            <div><span class="text-rose-400">SL: ${pos.stopLoss ? pos.stopLoss.toFixed(pCfg.decimals) : '—'}</span></div>
                            <div><span class="text-emerald-400">TP: ${pos.takeProfit ? pos.takeProfit.toFixed(pCfg.decimals) : '—'}</span></div>
                        </td>
                        <td class="py-2 px-2 text-center font-mono-num text-[10px]">
                            <button onclick="togglePositionTrailing(${pos.id})" class="btn-term px-1.5 py-0.5 rounded border ${hasTrail ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 font-bold' : 'bg-slate-800 border-slate-700 text-slate-400'}">
                                ${hasTrail ? `TRAIL $${pos.trailingDistance}` : 'TRAIL OFF'}
                            </button>
                            <div class="mt-0.5 ${swapVal >= 0 ? 'text-emerald-400' : 'text-purple-300'}">Swap: ${swapVal >= 0 ? '+' : ''}${fmtUSD(swapVal)}</div>
                        </td>
                        <td class="py-2 px-2 text-right font-mono-num">
                            <div class="font-bold ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
                                ${pnl >= 0 ? '+' : ''}${fmtUSD(pnl)}
                            </div>
                            <div class="text-[10px] ${roePct >= 0 ? 'text-emerald-500' : 'text-rose-500'}">
                                (${roePct >= 0 ? '+' : ''}${roePct.toFixed(1)}%)
                            </div>
                        </td>
                        <td class="py-2 px-2 text-center">
                            <div class="flex items-center justify-center gap-1 flex-wrap">
                                <button onclick="setPositionBEP(${pos.id})" class="btn-term bg-slate-800 hover:bg-slate-700 text-cyan-300 px-1.5 py-1 rounded text-[10px]" title="Set Stop Loss ke Harga Entry (Breakeven)">BEP</button>
                                <button onclick="closePositionById(${pos.id}, 'PARTIAL', 0.25)" class="btn-term bg-slate-800 hover:bg-emerald-950 border border-slate-700 text-slate-200 px-1.5 py-1 rounded text-[10px]" title="Partial Close 25%">25%</button>
                                <button onclick="closePositionById(${pos.id}, 'PARTIAL', 0.50)" class="btn-term bg-slate-800 hover:bg-emerald-950 border border-slate-700 text-slate-200 px-1.5 py-1 rounded text-[10px]" title="Partial Close 50%">50%</button>
                                <button onclick="closePositionById(${pos.id}, 'PARTIAL', 0.75)" class="btn-term bg-slate-800 hover:bg-emerald-950 border border-slate-700 text-slate-200 px-1.5 py-1 rounded text-[10px]" title="Partial Close 75%">75%</button>
                                <button onclick="closePositionById(${pos.id}, 'MANUAL', 1.0)" class="btn-term bg-rose-600 hover:bg-rose-500 text-white font-bold px-2 py-1 rounded text-[10px]">100%</button>
                            </div>
                        </td>
                    `;
                    posTbody.appendChild(tr);
                });
            }

            // 5B. Render Pending Orders Table
            const pendTbody = document.getElementById('pending-tbody');
            pendTbody.innerHTML = '';
            if (!state.pendingOrders || state.pendingOrders.length === 0) {
                pendTbody.innerHTML = `
                    <tr>
                        <td colspan="7" class="py-6 text-center text-slate-500">
                            Tidak ada Pending Order aktif. Pilih tab <b>LIMIT ORDER</b> atau <b>STOP ORDER</b> di panel kanan untuk memasang jaring harga.
                        </td>
                    </tr>
                `;
            } else {
                state.pendingOrders.forEach(ord => {
                    const pCfg = PAIR_CONFIGS[ord.pair];
                    const curMid = state.markets[ord.pair].price;
                    const distPct = ((ord.triggerPrice - curMid) / curMid) * 100;

                    const tr = document.createElement('tr');
                    tr.className = 'hover:bg-slate-900/60 transition';
                    tr.innerHTML = `
                        <td class="py-2 px-2.5 font-bold text-white">#${ord.id} ${ord.pair}</td>
                        <td class="py-2 px-2.5">
                            <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">${ord.orderType}</span>
                        </td>
                        <td class="py-2 px-2.5 text-right font-mono-num">${fmtLot(ord.pair, ord.size)} (1:${ord.leverage})</td>
                        <td class="py-2 px-2.5 text-right font-mono-num text-amber-300 font-bold">${fmtUSD(ord.triggerPrice, pCfg.decimals)}</td>
                        <td class="py-2 px-2.5 text-right font-mono-num text-slate-400">${distPct >= 0 ? '+' : ''}${distPct.toFixed(2)}%</td>
                        <td class="py-2 px-2.5 text-center font-mono-num text-[10px]">
                            <span class="text-rose-400">SL: ${ord.stopLoss || '—'}</span> |
                            <span class="text-emerald-400">TP: ${ord.takeProfit || '—'}</span> |
                            <span class="text-cyan-300">Trail: ${ord.trailingDistance ? '$' + ord.trailingDistance : 'Off'}</span>
                        </td>
                        <td class="py-2 px-2.5 text-center">
                            <button onclick="cancelPendingOrder(${ord.id})" class="btn-term bg-rose-700 hover:bg-rose-600 text-white px-2 py-0.5 rounded text-[10px] font-bold">Batalkan</button>
                        </td>
                    `;
                    pendTbody.appendChild(tr);
                });
            }

            // 6. Update Order Preview & Quant Lab Upgrade Panel
            updateOrderPreview();

            document.getElementById('quant-wallet-display').textContent = fmtUSD(state.wallet);
            document.getElementById('upg-spread-lvl').textContent = `LVL ${state.upgrades.rawSpread || 0} / 5`;
            document.getElementById('cost-upg-spread').textContent =
                (state.upgrades.rawSpread || 0) >= 5 ? 'MAKSIMAL' : fmtUSD(getUpgradeCost('rawSpread'));

            document.getElementById('upg-coloc-lvl').textContent = `LVL ${state.upgrades.coLocation || 0} / 5`;
            document.getElementById('cost-upg-coloc').textContent =
                (state.upgrades.coLocation || 0) >= 5 ? 'MAKSIMAL' : fmtUSD(getUpgradeCost('coLocation'));

            document.getElementById('upg-intel-lvl').textContent = `LVL ${state.upgrades.macroIntel || 0} / 3`;
            document.getElementById('cost-upg-intel').textContent =
                (state.upgrades.macroIntel || 0) >= 3 ? 'MAKSIMAL' : fmtUSD(getUpgradeCost('macroIntel'));

            document.getElementById('upg-bot-lvl').textContent = `LVL ${state.upgrades.quantBot || 0} / 5`;
            document.getElementById('cost-upg-bot').textContent =
                (state.upgrades.quantBot || 0) >= 5 ? 'MAKSIMAL' : fmtUSD(getUpgradeCost('quantBot'));
            const qBotBtn = document.getElementById('btn-toggle-quantbot');
            qBotBtn.textContent = state.quantBotActive ? 'AKTIF' : 'NONAKTIF';
            qBotBtn.className = state.quantBotActive
                ? 'px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700';

            document.getElementById('upg-shield-lvl').textContent = `LVL ${state.upgrades.marginShield || 0} / 3`;
            document.getElementById('cost-upg-shield').textContent =
                (state.upgrades.marginShield || 0) >= 3 ? 'MAKSIMAL' : fmtUSD(getUpgradeCost('marginShield'));

            // 7. Footer Telemetry
            const swapTotal = state.totalSwapPaid || 0;
            const swEl = document.getElementById('footer-swap-total');
            swEl.textContent = (swapTotal >= 0 ? '+' : '') + fmtUSD(swapTotal);
            swEl.className = swapTotal >= 0 ? 'text-emerald-400' : 'text-purple-300';

            const winRate = state.totalTrades > 0 ? ((state.wins / state.totalTrades) * 100).toFixed(1) : '0.0';
            document.getElementById('footer-winrate').textContent = `${winRate}% (${state.wins}/${state.totalTrades})`;
            const rEl = document.getElementById('footer-realized');
            rEl.textContent = (state.realizedPnL >= 0 ? '+' : '') + fmtUSD(state.realizedPnL);
            rEl.className = state.realizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400';

            if (typeof uiAfterRender === 'function') uiAfterRender();

            // 8. Draw Interactive Canvas Chart
            renderCandlestickChart();
        }
