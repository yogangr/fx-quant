        /******************************************************************
         * 10. INTERACTIVE <canvas> CHART: MULTI-TF, ZOOM/PAN, DRAG & DRAW
         ******************************************************************/
        function setTimeframe(tf) {
            if (!TIMEFRAME_FACTORS[tf]) return;
            activeTimeframe = tf;
            viewPanOffset = 0;
            ['M1', 'M5', 'M15', 'H1'].forEach(t => {
                const btn = document.getElementById(`tf-${t}`);
                if (!btn) return;
                btn.className = t === tf
                    ? 'px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold text-[10px]'
                    : 'px-2 py-0.5 rounded text-slate-400 hover:text-white text-[10px]';
            });
            renderAll();
        }

        function zoomChart(deltaBars) {
            viewZoomCandles = Math.max(18, Math.min(140, viewZoomCandles + deltaBars));
            renderCandlestickChart();
        }

        function resetChartZoomPan() {
            viewPanOffset = 0;
            viewZoomCandles = 55;
            document.getElementById('btn-reset-pan').classList.add('hidden');
            renderCandlestickChart();
        }

        function setDrawingTool(tool) {
            activeDrawingTool = tool;
            const tools = ['cursor', 'hline', 'trendline', 'rect'];
            tools.forEach(t => {
                const btn = document.getElementById(`tool-${t}`);
                if (!btn) return;
                if (t === tool) {
                    btn.className = 'px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 font-bold flex items-center gap-1';
                } else {
                    btn.className = 'px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 hover:text-white flex items-center gap-1';
                }
            });
        }

        function undoLastDrawing() {
            const pairId = state.activePair;
            if (!state.drawings[pairId] || state.drawings[pairId].length === 0) return;
            state.drawings[pairId].pop();
            AudioSynth.play('order');
            saveGameState();
            renderCandlestickChart();
        }

        function clearAllDrawings() {
            const pairId = state.activePair;
            state.drawings[pairId] = [];
            AudioSynth.play('order');
            addLog(`Seluruh gambar teknikal pada ${pairId} telah dibersihkan.`, 'INFO');
            saveGameState();
            renderCandlestickChart();
        }

        function toggleIndicator(key) {
            indicators[key] = !indicators[key];
            renderAll();
        }

        function renderCandlestickChart() {
            const container = document.getElementById('chart-container');
            const canvas = document.getElementById('trading-canvas');
            if (!container || !canvas) return;

            const dpr = window.devicePixelRatio || 1;
            const rect = container.getBoundingClientRect();
            const width = rect.width;
            const height = rect.height;

            if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
                canvas.width = Math.floor(width * dpr);
                canvas.height = Math.floor(height * dpr);
            }

            const ctx = canvas.getContext('2d');
            applyCanvasTheme(ctx);
            ctx.save();
            ctx.scale(dpr, dpr);

            // Clear background
            ctx.fillStyle = '#070b14';
            ctx.fillRect(0, 0, width, height);

            const pairId = state.activePair;
            const cfg = PAIR_CONFIGS[pairId];
            const fullCandles = getAggregatedCandles(pairId, activeTimeframe);
            if (!fullCandles || fullCandles.length === 0) {
                ctx.restore();
                return;
            }

            // Clamp pan offset and slice visible window
            const maxPan = Math.max(0, fullCandles.length - 10);
            viewPanOffset = Math.max(0, Math.min(maxPan, Math.round(viewPanOffset)));
            const resetPanBtn = document.getElementById('btn-reset-pan');
            if (resetPanBtn) {
                if (viewPanOffset > 0) resetPanBtn.classList.remove('hidden');
                else resetPanBtn.classList.add('hidden');
            }

            const endIdx = fullCandles.length - viewPanOffset;
            const startIdx = Math.max(0, endIdx - viewZoomCandles);
            const candles = fullCandles.slice(startIdx, endIdx);

            // Layout geometry
            const rightAxisW = 76;
            const chartW = width - rightAxisW;
            const priceChartH = Math.floor(height * 0.74);
            const rsiTop = priceChartH + 6;
            const rsiH = height - rsiTop - 16;

            // Compute indicators on fullCandles then slice so EMA/BB/RSI have warm-up history
            const fullEma9 = calculateEMA(fullCandles, 9).slice(startIdx, endIdx);
            const fullEma21 = calculateEMA(fullCandles, 21).slice(startIdx, endIdx);
            const fullBB = calculateBollingerBands(fullCandles, 20, 2).slice(startIdx, endIdx);
            const fullRSI = calculateRSIArray(fullCandles, 14).slice(startIdx, endIdx);

            // Determine price min/max across visible candles + active positions SL/TP + pending orders
            let minP = Infinity;
            let maxP = -Infinity;
            candles.forEach((c, idx) => {
                if (c.l < minP) minP = c.l;
                if (c.h > maxP) maxP = c.h;
                if (indicators.bb && fullBB[idx]) {
                    if (fullBB[idx].lower < minP) minP = fullBB[idx].lower;
                    if (fullBB[idx].upper > maxP) maxP = fullBB[idx].upper;
                }
            });

            if (indicators.posLines) {
                state.positions.filter(p => p.pair === pairId).forEach(pos => {
                    minP = Math.min(minP, pos.entryPrice);
                    maxP = Math.max(maxP, pos.entryPrice);
                    if (pos.stopLoss) { minP = Math.min(minP, pos.stopLoss); maxP = Math.max(maxP, pos.stopLoss); }
                    if (pos.takeProfit) { minP = Math.min(minP, pos.takeProfit); maxP = Math.max(maxP, pos.takeProfit); }
                });
                state.pendingOrders.filter(o => o.pair === pairId).forEach(ord => {
                    minP = Math.min(minP, ord.triggerPrice);
                    maxP = Math.max(maxP, ord.triggerPrice);
                });
            }

            const padP = Math.max((maxP - minP) * 0.12, cfg.baseSpread * 3);
            minP -= padP;
            maxP += padP;
            const rangeP = Math.max(0.0001, maxP - minP);

            const priceToY = (p) => priceChartH - ((p - minP) / rangeP) * (priceChartH - 20) - 10;
            const yToPrice = (y) => minP + ((priceChartH - 10 - y) / (priceChartH - 20)) * rangeP;

            const n = candles.length;
            const stepX = chartW / Math.max(12, n + 2);
            const bodyW = Math.max(2.5, Math.min(16, stepX * 0.68));
            const indexToX = (i) => (i + 1) * stepX;

            // Helper to map logical M1 candle ID to screen X for persistent Trendlines/Rectangles
            const firstId = candles[0]?.id || 1;
            const tfFactor = TIMEFRAME_FACTORS[activeTimeframe] || 1;
            const candleIdToX = (cid) => {
                const approxIdx = (cid - firstId) / tfFactor;
                return indexToX(approxIdx);
            };
            const xToCandleId = (x) => {
                const approxIdx = (x / stepX) - 1;
                return Math.round(firstId + approxIdx * tfFactor);
            };

            // Save coordinate transform for interactive mouse handlers
            lastChartTransform = {
                chartW, priceChartH, minP, maxP, stepX,
                priceToY, yToPrice, candleIdToX, xToCandleId
            };

            // 1. Draw Horizontal Grid & Price Axis Labels
            ctx.strokeStyle = '#131c2e';
            ctx.lineWidth = 1;
            ctx.font = '10px "JetBrains Mono", monospace';
            ctx.fillStyle = '#64748b';

            const gridSteps = 5;
            for (let i = 0; i <= gridSteps; i++) {
                const pVal = minP + (rangeP * i) / gridSteps;
                const y = priceToY(pVal);
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(chartW, y);
                ctx.stroke();
                ctx.fillText(pVal.toFixed(cfg.decimals), chartW + 5, y + 3);
            }

            // 2. Draw Bollinger Bands (if active)
            if (indicators.bb) {
                ctx.save();
                ctx.beginPath();
                let started = false;
                for (let i = 0; i < n; i++) {
                    if (!fullBB[i]) continue;
                    const x = indexToX(i);
                    const yU = priceToY(fullBB[i].upper);
                    if (!started) { ctx.moveTo(x, yU); started = true; }
                    else ctx.lineTo(x, yU);
                }
                for (let i = n - 1; i >= 0; i--) {
                    if (!fullBB[i]) continue;
                    const x = indexToX(i);
                    const yL = priceToY(fullBB[i].lower);
                    ctx.lineTo(x, yL);
                }
                ctx.closePath();
                ctx.fillStyle = 'rgba(56, 189, 248, 0.06)';
                ctx.fill();
                ctx.restore();
            }

            // 3. Draw User Technical Drawings (H-Lines, Trendlines, S/D Zones)
            const pairDrawings = [...(state.drawings[pairId] || [])];
            if (activeDragOperation && activeDragOperation.mode === 'draw_preview' && activeDragOperation.previewShape) {
                pairDrawings.push(activeDragOperation.previewShape);
            }

            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, chartW, priceChartH);
            ctx.clip();

            pairDrawings.forEach(d => {
                if (d.type === 'hline') {
                    const y = priceToY(d.price);
                    ctx.strokeStyle = '#38bdf8';
                    ctx.lineWidth = 1.4;
                    ctx.setLineDash([5, 3]);
                    ctx.beginPath();
                    ctx.moveTo(0, y);
                    ctx.lineTo(chartW, y);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.fillStyle = '#0284c7';
                    ctx.fillRect(chartW - 68, y - 8, 66, 15);
                    ctx.fillStyle = '#e0f2fe';
                    ctx.font = 'bold 9px "JetBrains Mono", monospace';
                    ctx.fillText(`S/R ${d.price.toFixed(cfg.decimals)}`, chartW - 64, y + 3);
                } else if (d.type === 'trendline') {
                    const x1 = candleIdToX(d.id1);
                    const y1 = priceToY(d.p1);
                    const x2 = candleIdToX(d.id2);
                    const y2 = priceToY(d.p2);
                    ctx.strokeStyle = '#fbbf24';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.stroke();
                    // Endpoints
                    ctx.fillStyle = '#f59e0b';
                    ctx.beginPath(); ctx.arc(x1, y1, 3, 0, Math.PI * 2); ctx.fill();
                    ctx.beginPath(); ctx.arc(x2, y2, 3, 0, Math.PI * 2); ctx.fill();
                } else if (d.type === 'rect') {
                    const x1 = candleIdToX(d.id1);
                    const y1 = priceToY(d.p1);
                    const x2 = candleIdToX(d.id2);
                    const y2 = priceToY(d.p2);
                    const rx = Math.min(x1, x2);
                    const ry = Math.min(y1, y2);
                    const rw = Math.abs(x2 - x1);
                    const rh = Math.abs(y2 - y1);
                    ctx.fillStyle = 'rgba(99, 102, 241, 0.16)';
                    ctx.fillRect(rx, ry, rw, rh);
                    ctx.strokeStyle = 'rgba(129, 140, 248, 0.7)';
                    ctx.lineWidth = 1.2;
                    ctx.strokeRect(rx, ry, rw, rh);
                }
            });
            ctx.restore();

            // 4. Draw Candlesticks (Wicks + Bodies)
            for (let i = 0; i < n; i++) {
                const c = candles[i];
                const x = indexToX(i);
                const isBull = c.c >= c.o;
                const color = isBull ? '#10b981' : '#ef4444';

                const yHigh = priceToY(c.h);
                const yLow = priceToY(c.l);
                const yOpen = priceToY(c.o);
                const yClose = priceToY(c.c);

                ctx.strokeStyle = color;
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.moveTo(x, yHigh);
                ctx.lineTo(x, yLow);
                ctx.stroke();

                const topY = Math.min(yOpen, yClose);
                const boxH = Math.max(2, Math.abs(yClose - yOpen));
                ctx.fillStyle = color;
                ctx.fillRect(x - bodyW / 2, topY, bodyW, boxH);
            }

            // 5. Draw EMA-9 & EMA-21 Lines
            const drawCurve = (arr, strokeColor) => {
                ctx.save();
                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                for (let i = 0; i < n; i++) {
                    const x = indexToX(i);
                    const y = priceToY(arr[i]);
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.stroke();
                ctx.restore();
            };

            if (indicators.ema9) drawCurve(fullEma9, '#06b6d4');
            if (indicators.ema21) drawCurve(fullEma21, '#a855f7');

            // 6. Draw Active Position Lines & Pending Orders (Interactive Drag-and-Drop!)
            const draggableLines = [];
            if (indicators.posLines) {
                const drawOrderLine = (priceVal, strokeCol, bgCol, labelText, isHovered = false) => {
                    if (priceVal < minP || priceVal > maxP) return null;
                    const y = priceToY(priceVal);
                    ctx.save();
                    ctx.setLineDash(isHovered ? [] : [4, 4]);
                    ctx.strokeStyle = isHovered ? '#ffffff' : strokeCol;
                    ctx.lineWidth = isHovered ? 2.2 : 1.3;
                    ctx.beginPath();
                    ctx.moveTo(0, y);
                    ctx.lineTo(chartW, y);
                    ctx.stroke();
                    ctx.setLineDash([]);

                    const pillW = labelText.length * 6.2 + 14;
                    ctx.fillStyle = bgCol;
                    ctx.fillRect(8, y - 9, pillW, 17);
                    if (isHovered) {
                        ctx.strokeStyle = '#ffffff';
                        ctx.lineWidth = 1;
                        ctx.strokeRect(8, y - 9, pillW, 17);
                    }
                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 10px "JetBrains Mono", monospace';
                    ctx.fillText(labelText, 14, y + 3);
                    ctx.restore();
                    return y;
                };

                // Pending Orders on Chart
                state.pendingOrders.filter(o => o.pair === pairId).forEach(ord => {
                    const isHov = hoveredChartLine && hoveredChartLine.kind === 'PENDING' && hoveredChartLine.id === ord.id;
                    const y = drawOrderLine(
                        ord.triggerPrice,
                        '#f59e0b',
                        '#b45309',
                        `[DRAG] ${ord.orderType} ${fmtLot(ord.pair, ord.size)} @ ${ord.triggerPrice.toFixed(cfg.decimals)}`,
                        isHov
                    );
                    if (y !== null) {
                        draggableLines.push({ kind: 'PENDING', id: ord.id, y, price: ord.triggerPrice, ref: ord });
                    }
                });

                // Open Positions Entry, TP, SL
                state.positions.filter(p => p.pair === pairId).forEach(pos => {
                    const pnl = calculatePositionPnL(pos);
                    const pnlStr = `${pnl >= 0 ? '+' : ''}${fmtUSD(pnl)}`;
                    drawOrderLine(
                        pos.entryPrice,
                        '#3b82f6',
                        '#1d4ed8',
                        `${pos.side} ${fmtLot(pos.pair, pos.size)} @ ${pos.entryPrice.toFixed(cfg.decimals)} (${pnlStr})`,
                        false
                    );

                    if (pos.takeProfit) {
                        const isHovTP = hoveredChartLine && hoveredChartLine.kind === 'TP' && hoveredChartLine.id === pos.id;
                        const projTP = calculatePositionPnL(pos, pos.takeProfit);
                        const yTP = drawOrderLine(
                            pos.takeProfit,
                            '#10b981',
                            '#047857',
                            `[DRAG TP #${pos.id}] ${pos.takeProfit.toFixed(cfg.decimals)} (${projTP >= 0 ? '+' : ''}${fmtUSD(projTP)})`,
                            isHovTP
                        );
                        if (yTP !== null) {
                            draggableLines.push({ kind: 'TP', id: pos.id, y: yTP, price: pos.takeProfit, ref: pos });
                        }
                    }

                    if (pos.stopLoss) {
                        const isHovSL = hoveredChartLine && hoveredChartLine.kind === 'SL' && hoveredChartLine.id === pos.id;
                        const projSL = calculatePositionPnL(pos, pos.stopLoss);
                        const trailTag = pos.trailingDistance > 0 ? ' [TRAIL]' : '';
                        const ySL = drawOrderLine(
                            pos.stopLoss,
                            '#ef4444',
                            '#b91c1c',
                            `[DRAG SL #${pos.id}${trailTag}] ${pos.stopLoss.toFixed(cfg.decimals)} (${projSL >= 0 ? '+' : ''}${fmtUSD(projSL)})`,
                            isHovSL
                        );
                        if (ySL !== null) {
                            draggableLines.push({ kind: 'SL', id: pos.id, y: ySL, price: pos.stopLoss, ref: pos });
                        }
                    }
                });
            }
            lastChartTransform.draggableLines = draggableLines;

            // 7. Current Live Market Price Line & Tag on Right Axis
            const curPrice = state.markets[pairId].price;
            const curY = priceToY(curPrice);
            ctx.save();
            ctx.setLineDash([2, 2]);
            ctx.strokeStyle = cfg.accentColor;
            ctx.beginPath();
            ctx.moveTo(0, curY);
            ctx.lineTo(chartW, curY);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = cfg.accentColor;
            ctx.fillRect(chartW + 1, curY - 9, rightAxisW - 2, 18);
            ctx.fillStyle = '#070b14';
            ctx.font = 'bold 10px "JetBrains Mono", monospace';
            ctx.fillText(curPrice.toFixed(cfg.decimals), chartW + 5, curY + 3);
            ctx.restore();

            // 8. Divider & RSI (14) Sub-Panel at Bottom
            ctx.strokeStyle = '#1e293b';
            ctx.beginPath();
            ctx.moveTo(0, priceChartH);
            ctx.lineTo(width, priceChartH);
            ctx.stroke();

            const rsiToY = (r) => rsiTop + rsiH - (Math.max(0, Math.min(100, r)) / 100) * rsiH;

            [70, 30].forEach(lvl => {
                const ry = rsiToY(lvl);
                ctx.save();
                ctx.setLineDash([2, 3]);
                ctx.strokeStyle = lvl === 70 ? 'rgba(239, 68, 68, 0.45)' : 'rgba(16, 185, 129, 0.45)';
                ctx.beginPath();
                ctx.moveTo(0, ry);
                ctx.lineTo(chartW, ry);
                ctx.stroke();
                ctx.fillStyle = '#64748b';
                ctx.font = '9px "JetBrains Mono", monospace';
                ctx.fillText(`RSI ${lvl}`, chartW + 5, ry + 3);
                ctx.restore();
            });

            ctx.save();
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            for (let i = 0; i < n; i++) {
                const x = indexToX(i);
                const y = rsiToY(fullRSI[i]);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();

            const lastRsi = fullRSI[fullRSI.length - 1] || 50;
            ctx.fillStyle = '#94a3b8';
            ctx.font = 'bold 10px "JetBrains Mono", monospace';
            ctx.fillText(`RSI(14) [${activeTimeframe}]: ${lastRsi.toFixed(1)}`, 8, rsiTop + 12);
            ctx.restore();

            // 9. Crosshair Hover Inspection
            if (hoverMouseX !== null && hoverMouseY !== null && hoverMouseX < chartW && hoverMouseY < priceChartH) {
                ctx.save();
                ctx.setLineDash([3, 3]);
                ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
                ctx.beginPath();
                ctx.moveTo(hoverMouseX, 0);
                ctx.lineTo(hoverMouseX, priceChartH);
                ctx.moveTo(0, hoverMouseY);
                ctx.lineTo(chartW, hoverMouseY);
                ctx.stroke();

                const hoverP = yToPrice(hoverMouseY);
                ctx.fillStyle = '#334155';
                ctx.fillRect(chartW + 1, hoverMouseY - 9, rightAxisW - 2, 18);
                ctx.fillStyle = '#f8fafc';
                ctx.font = '10px "JetBrains Mono", monospace';
                ctx.fillText(hoverP.toFixed(cfg.decimals), chartW + 5, hoverMouseY + 3);
                ctx.restore();
            }

            // Right Axis vertical border
            ctx.strokeStyle = '#1e293b';
            ctx.beginPath();
            ctx.moveTo(chartW, 0);
            ctx.lineTo(chartW, height);
            ctx.stroke();

            ctx.restore();
        }

        // Bind Interactive Mouse, Wheel & Touch Events to Canvas
        function setupCanvasInteractions() {
            const canvas = document.getElementById('trading-canvas');
            if (!canvas) return;

            const ptrs = new Map();   // pointer aktif (untuk cubit-zoom 2 jari)
            let pinch = null;
            const pickLine = (x, y, tol) => {
                if (!lastChartTransform || !lastChartTransform.draggableLines || x >= lastChartTransform.chartW) return null;
                let best = null, bd = tol + 1;
                for (const dl of lastChartTransform.draggableLines) { const d = Math.abs(y - dl.y); if (d < bd) { bd = d; best = dl; } }
                return best;
            };
            const getCoords = (e) => {
                const r = canvas.getBoundingClientRect();
                const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                const clientY = e.touches ? e.touches[0].clientY : e.clientY;
                return { x: clientX - r.left, y: clientY - r.top };
            };

            canvas.addEventListener('wheel', (e) => {
                e.preventDefault();
                const delta = e.deltaY > 0 ? 8 : -8;
                zoomChart(delta);
            }, { passive: false });

            canvas.addEventListener('pointerdown', (e) => {
                ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
                if (e.pointerType !== 'mouse') { try { canvas.setPointerCapture(e.pointerId); } catch (_) {} }
                if (ptrs.size === 2) {
                    const [a, b] = [...ptrs.values()];
                    activeDragOperation = null;
                    pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: viewZoomCandles };
                    return;
                }
                if (!lastChartTransform) return;
                const { x, y } = getCoords(e);
                if (x >= lastChartTransform.chartW || y >= lastChartTransform.priceChartH) return;

                const pairId = state.activePair;
                const cfg = PAIR_CONFIGS[pairId];
                const clickPrice = Number(lastChartTransform.yToPrice(y).toFixed(cfg.decimals));
                const clickCandleId = lastChartTransform.xToCandleId(x);

                // 1. Check Drawing Tools first
                if (activeDrawingTool === 'hline') {
                    state.drawings[pairId].push({ type: 'hline', price: clickPrice });
                    AudioSynth.play('order');
                    addLog(`GAMBAR TEKNIKAL: Garis Support/Resistance ditambahkan pada ${pairId} @ ${fmtUSD(clickPrice)}.`, 'INFO');
                    saveGameState();
                    renderCandlestickChart();
                    return;
                } else if (activeDrawingTool === 'trendline' || activeDrawingTool === 'rect') {
                    activeDragOperation = {
                        mode: 'draw_preview',
                        tool: activeDrawingTool,
                        id1: clickCandleId,
                        p1: clickPrice,
                        previewShape: {
                            type: activeDrawingTool,
                            id1: clickCandleId,
                            p1: clickPrice,
                            id2: clickCandleId,
                            p2: clickPrice
                        }
                    };
                    return;
                }

                if (e.pointerType !== 'mouse' && activeDrawingTool === 'cursor') hoveredChartLine = pickLine(x, y, 22); // jari: area sentuh lebih lebar

                // 2. In 'cursor' mode: Check if clicking near a draggable SL / TP / Pending line
                if (hoveredChartLine) {
                    activeDragOperation = {
                        mode: 'drag_line',
                        line: hoveredChartLine
                    };
                    return;
                }

                // 3. Otherwise: Start Horizontal Chart Panning
                activeDragOperation = {
                    mode: 'pan',
                    startX: x,
                    startPanOffset: viewPanOffset
                };
                canvas.style.cursor = 'grabbing';
            });

            canvas.addEventListener('pointermove', (e) => {
                if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
                if (pinch && ptrs.size === 2) {
                    const [a, b] = [...ptrs.values()];
                    viewZoomCandles = Math.max(18, Math.min(140, Math.round(pinch.z0 * pinch.d0 / (Math.hypot(a.x - b.x, a.y - b.y) || 1))));
                    renderCandlestickChart();
                    return;
                }
                if (!lastChartTransform) return;
                const { x, y } = getCoords(e);
                hoverMouseX = x;
                hoverMouseY = y;

                const pairId = state.activePair;
                const cfg = PAIR_CONFIGS[pairId];

                // Handle active drag operation
                if (activeDragOperation) {
                    if (activeDragOperation.mode === 'drag_line') {
                        const newPrice = Number(Math.max(cfg.basePrice * 0.2, lastChartTransform.yToPrice(y)).toFixed(cfg.decimals));
                        const item = activeDragOperation.line;
                        if (item.kind === 'TP') item.ref.takeProfit = newPrice;
                        else if (item.kind === 'SL') item.ref.stopLoss = newPrice;
                        else if (item.kind === 'PENDING') item.ref.triggerPrice = newPrice;
                        renderAll();
                        return;
                    } else if (activeDragOperation.mode === 'pan') {
                        const dx = x - activeDragOperation.startX;
                        const barsMoved = Math.round(dx / Math.max(4, lastChartTransform.stepX));
                        viewPanOffset = Math.max(0, activeDragOperation.startPanOffset + barsMoved);
                        renderCandlestickChart();
                        return;
                    } else if (activeDragOperation.mode === 'draw_preview') {
                        activeDragOperation.previewShape.id2 = lastChartTransform.xToCandleId(x);
                        activeDragOperation.previewShape.p2 = Number(lastChartTransform.yToPrice(y).toFixed(cfg.decimals));
                        renderCandlestickChart();
                        return;
                    }
                }

                // Check hover proximity to draggable SL/TP/Pending lines (within 8px)
                if (activeDrawingTool === 'cursor' && lastChartTransform.draggableLines) {
                    let found = null;
                    for (const dl of lastChartTransform.draggableLines) {
                        if (Math.abs(y - dl.y) <= (e.pointerType === 'mouse' ? 8 : 22) && x < lastChartTransform.chartW) {
                            found = dl;
                            break;
                        }
                    }
                    hoveredChartLine = found;
                    canvas.style.cursor = found ? 'ns-resize' : 'crosshair';
                } else {
                    hoveredChartLine = null;
                    canvas.style.cursor = 'crosshair';
                }

                renderCandlestickChart();
            });

            const onPointerEnd = (e) => {
                if (e && e.pointerId !== undefined) { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; }
                if (!activeDragOperation) return;
                const op = activeDragOperation;
                activeDragOperation = null;
                canvas.style.cursor = 'crosshair';

                if (op.mode === 'drag_line') {
                    AudioSynth.play('order');
                    const l = op.line;
                    const updatedVal = l.kind === 'TP' ? l.ref.takeProfit : (l.kind === 'SL' ? l.ref.stopLoss : l.ref.triggerPrice);
                    addLog(`GESER GARIS CHART: ${l.kind} #${l.id} (${state.activePair}) diperbarui ke <b>${fmtUSD(updatedVal)}</b>.`, 'INFO');
                    saveGameState();
                    renderAll();
                } else if (op.mode === 'draw_preview' && op.previewShape) {
                    state.drawings[state.activePair].push(op.previewShape);
                    AudioSynth.play('order');
                    setDrawingTool('cursor');
                    saveGameState();
                    renderCandlestickChart();
                }
            };
            window.addEventListener('pointerup', onPointerEnd);
            window.addEventListener('pointercancel', onPointerEnd);

            canvas.addEventListener('pointerleave', () => {
                hoverMouseX = null;
                hoverMouseY = null;
                if (!activeDragOperation) {
                    hoveredChartLine = null;
                    renderCandlestickChart();
                }
            });
        }


        /******************************************************************
         * 10b. TEMA KANVAS EKSPLISIT (tanpa filter CSS)
         ******************************************************************/
        const CANVAS_THEMES = {
            light:    { '#070b14': '#f4f6fa', '#131c2e': '#e6eaf1', '#1e293b': '#d5dbe5', '#334155': '#cbd5e1', '#f8fafc': '#0f172a', '#94a3b8': '#475569', 'rgba(148,163,184,0.45)': 'rgba(71,85,105,0.45)' },
            paper:    { '#070b14': '#f3ead8', '#131c2e': '#e6dac1', '#1e293b': '#d6c8a8', '#334155': '#cbbd9a', '#f8fafc': '#2b2418', '#94a3b8': '#6b5d44', 'rgba(148,163,184,0.45)': 'rgba(107,93,68,0.45)' },
            amoled:   { '#070b14': '#000000', '#131c2e': '#0f0f0f', '#1e293b': '#1c1c1c' },
            contrast: { '#131c2e': '#1e293b', '#1e293b': '#475569', '#64748b': '#cbd5e1', '#94a3b8': '#f1f5f9' }
        };
        function mapCanvasColor(v) {
            const t = CANVAS_THEMES[document.documentElement.dataset.eff];
            return (t && typeof v === 'string' && t[v.replace(/\s+/g, '').toLowerCase()]) || v;
        }
        function applyCanvasTheme(ctx) {
            if (ctx.__themed) return;
            ['fillStyle', 'strokeStyle'].forEach(p => {
                const d = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, p);
                Object.defineProperty(ctx, p, { configurable: true, get() { return d.get.call(ctx); }, set(v) { d.set.call(ctx, mapCanvasColor(v)); } });
            });
            ctx.__themed = true;
        }
