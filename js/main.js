        /******************************************************************
         * 13. INITIALIZATION & EVENT LISTENERS ON WINDOW LOAD
         ******************************************************************/
        window.onload = async function () {
            const loaded = await loadGameStateAsync();
            populateLeveragePresets();
            setupCanvasInteractions();

            window.addEventListener('resize', () => {
                renderCandlestickChart();
            });

            document.getElementById('input-order-size').value = unitsToLots(state.activePair, PAIR_CONFIGS[state.activePair].defaultSize);
            initUI();
            renderAll();
            if (!loaded) {
                addLog('SELAMAT DATANG DI FX-QUANT v2.0 PRO // Terminal Prop-Firm dilengkapi Multi-Timeframe, Drag SL/TP & Pending Order.', 'PROP');
                addLog('TIPS BARU: Anda kini bisa menggeser garis TP/SL/Pending langsung di atas grafik dan menutup posisi bertahap (25%, 50%, 75%)!', 'INFO');
            } else {
                addLog('Sesi Prop-Firm v2.0 berhasil dipulihkan dari penyimpanan lokal browser.', 'INFO');
            }

            ['spd-select', 'fspd'].forEach(id => { const s = document.getElementById(id); if (s) s.innerHTML = SIM_SPEEDS.map(([v, l]) => `<option value="${v}">${l}</option>`).join(''); });
            setSimSpeed(typeof state.simSpeedPref === 'number' && state.simSpeedPref <= 60 ? state.simSpeedPref : 1);
        };
    
        function initUI() { (window.__ui || []).forEach(fn => { try { fn(); } catch (e) { console.error(e); } }); }
        window.addEventListener('pagehide', () => { if (typeof flushSave === 'function') flushSave(); });
        document.addEventListener('visibilitychange', () => { if (document.hidden && typeof flushSave === 'function') flushSave(); });
