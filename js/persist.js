        /******************************************************************
         * 12. SERVERLESS PERSISTENCE (LOCALSTORAGE, BASE64 & SEED)
         ******************************************************************/
        

        function applyLoadedState(parsed) {
            try {
                if (!parsed) return false;
                if (!parsed || !parsed.markets || !parsed.markets.XAUUSD) return false;

                const fresh = createFreshState(parsed.seed || 'QUANT-2026');
                state = {
                    ...fresh,
                    ...parsed,
                    upgrades: { ...fresh.upgrades, ...(parsed.upgrades || {}) },
                    pendingOrders: parsed.pendingOrders || [],
                    drawings: { ...fresh.drawings, ...(parsed.drawings || {}) }
                };

                // Ensure candle IDs exist for drawing anchor compatibility
                ['XAUUSD', 'BTCUSD'].forEach(pid => {
                    const m = state.markets[pid];
                    m.candles.forEach((c, idx) => {
                        if (!c.id) c.id = idx + 1;
                    });
                    m.lastCandleId = m.candles[m.candles.length - 1]?.id || m.candles.length;
                });

                prngState = state.prngState || hashSeedString(state.seed || 'QUANT-2026');
                return true;
            } catch (e) {
                return false;
            }
        }

        function openSaveModal() {
            saveGameState();
            const encoded = btoa(encodeURIComponent(JSON.stringify(state)));
            document.getElementById('base64-box').value = encoded;
            document.getElementById('modal-save-msg').classList.add('hidden');
            hardResetConfirm = false;
            document.getElementById('btn-hard-reset').textContent = 'Hard Reset';
            document.getElementById('save-modal').classList.remove('hidden');
        }

        function closeSaveModal() {
            document.getElementById('save-modal').classList.add('hidden');
        }

        function showModalFeedback(msg, isErr = false) {
            const el = document.getElementById('modal-save-msg');
            el.textContent = msg;
            el.className = `text-center py-1.5 px-2 rounded font-bold ${isErr ? 'bg-rose-950 text-rose-300 border border-rose-500/40' : 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'}`;
            el.classList.remove('hidden');
        }

        function copyBase64Save() {
            const box = document.getElementById('base64-box');
            box.select();
            document.execCommand('copy');
            AudioSynth.play('order');
            showModalFeedback('Kode Base64 berhasil disalin ke Clipboard!');
        }

        function importBase64Save() {
            const raw = document.getElementById('base64-box').value.trim();
            if (!raw) return;
            try {
                const decoded = JSON.parse(decodeURIComponent(atob(raw)));
                if (!decoded || !decoded.markets || typeof decoded.balance !== 'number') {
                    throw new Error('Invalid');
                }
                const fresh = createFreshState(decoded.seed || 'QUANT-2026');
                state = {
                    ...fresh,
                    ...decoded,
                    upgrades: { ...fresh.upgrades, ...(decoded.upgrades || {}) },
                    pendingOrders: decoded.pendingOrders || [],
                    drawings: { ...fresh.drawings, ...(decoded.drawings || {}) }
                };
                prngState = state.prngState || hashSeedString(state.seed || 'QUANT-2026');
                saveGameState();
                renderAll();
                AudioSynth.play('tp');
                showModalFeedback('Data permainan v2.0 berhasil dipulihkan!');
            } catch (e) {
                AudioSynth.play('sl');
                showModalFeedback('Kode Base64 tidak valid atau rusak!', true);
            }
        }

        function confirmHardReset() {
            const btn = document.getElementById('btn-hard-reset');
            if (!hardResetConfirm) {
                hardResetConfirm = true;
                btn.textContent = 'Klik Lagi utk Konfirmasi!';
                btn.className = 'btn-term bg-amber-500 text-slate-950 font-bold px-3 py-1.5 rounded shrink-0';
                return;
            }
            idbDelete(SAVE_KEY);
            try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
            state = createFreshState('QUANT-2026');
            saveGameState();
            selectPair('XAUUSD');
            closeSaveModal();
            AudioSynth.play('tp');
        }

        function openSeedModal() {
            document.getElementById('input-seed-str').value = state.seed;
            document.getElementById('seed-modal').classList.remove('hidden');
        }

        function closeSeedModal() {
            document.getElementById('seed-modal').classList.add('hidden');
        }

        function randomizeSeedInput() {
            const prefixes = ['NFP', 'FOMC', 'GOLD', 'WHALE', 'SATOSHI', 'ALPHA'];
            const p = prefixes[Math.floor(Math.random() * prefixes.length)];
            const num = Math.floor(100 + Math.random() * 900);
            document.getElementById('input-seed-str').value = `${p}-${num}`;
        }

        function applyNewSeed() {
            const rawSeed = (document.getElementById('input-seed-str').value || 'QUANT-2026').trim().toUpperCase();
            const keepWallet = state.wallet;
            const keepUpgrades = { ...state.upgrades };
            state = createFreshState(rawSeed);
            state.wallet = keepWallet;
            state.upgrades = keepUpgrades;
            saveGameState();
            renderAll();
            closeSeedModal();
            AudioSynth.play('tp');
            addLog(`SEED PASAR BARU DITERAPKAN: <b>${rawSeed}</b>. Urutan 300 candlestick M1 telah disinkronkan.`, 'PROP');
        }

        function toggleSound() {
            AudioSynth.muted = !AudioSynth.muted;
            const icon = document.getElementById('icon-audio');
            const btn = document.getElementById('btn-audio');
            if (AudioSynth.muted) {
                icon.className = 'fa-solid fa-volume-xmark';
                btn.className = 'btn-term bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-500 font-mono text-[11px] px-2.5 py-0.5 rounded';
            } else {
                icon.className = 'fa-solid fa-volume-high';
                btn.className = 'btn-term bg-slate-900 hover:bg-slate-800 border border-slate-700 text-emerald-400 font-mono text-[11px] px-2.5 py-0.5 rounded';
                AudioSynth.play('order');
            }
        }
