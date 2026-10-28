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

            initUI();
            renderAll();
            if (!loaded) {
                addLog('SELAMAT DATANG DI FX-QUANT v2.0 PRO // Terminal Prop-Firm dilengkapi Multi-Timeframe, Drag SL/TP & Pending Order.', 'PROP');
                addLog('TIPS BARU: Anda kini bisa menggeser garis TP/SL/Pending langsung di atas grafik dan menutup posisi bertahap (25%, 50%, 75%)!', 'INFO');
            } else {
                addLog('Sesi Prop-Firm v2.0 berhasil dipulihkan dari penyimpanan lokal browser.', 'INFO');
            }

            setSimSpeed(1);
        };
    
        function initUI() { (window.__ui || []).forEach(fn => { try { fn(); } catch (e) { console.error(e); } }); }
        window.addEventListener('pagehide', () => { if (typeof flushSave === 'function') flushSave(); });
        document.addEventListener('visibilitychange', () => { if (document.hidden && typeof flushSave === 'function') flushSave(); });
