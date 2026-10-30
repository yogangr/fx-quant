/* Penyimpanan: IndexedDB (tanpa batas ~5 MB localStorage), otomatis fallback ke localStorage */
const DB_NAME = 'FX_QUANT_DB', DB_STORE = 'kv';
let _dbPromise = null, _saveTimer = null;

function idbOpen() {
    return _dbPromise || (_dbPromise = new Promise((res, rej) => {
        if (!window.indexedDB) return rej(new Error('IndexedDB tidak tersedia'));
        const r = indexedDB.open(DB_NAME, 1);
        r.onupgradeneeded = () => r.result.createObjectStore(DB_STORE);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
    }));
}
async function idbRun(mode, fn) {
    const db = await idbOpen();
    return new Promise((res, rej) => {
        const tx = db.transaction(DB_STORE, mode), rq = fn(tx.objectStore(DB_STORE));
        tx.oncomplete = () => res(rq ? rq.result : undefined);
        tx.onerror = tx.onabort = () => rej(tx.error);
    });
}
const idbGet = k => idbRun('readonly', s => s.get(k));
const idbPut = (k, v) => idbRun('readwrite', s => s.put(v, k));
const idbDelete = k => idbRun('readwrite', s => s.delete(k)).catch(() => {});

/* Throttle: paling lambat 400 ms sekali (bukan debounce, supaya tetap tersimpan saat simulasi berjalan terus-menerus) */
function saveGameState() { if (!_saveTimer) _saveTimer = setTimeout(flushSave, 400); }
function flushSave() {
    clearTimeout(_saveTimer); _saveTimer = null;
    let snap; try { snap = structuredClone(state); } catch (e) { snap = JSON.parse(JSON.stringify(state)); }
    return idbPut(SAVE_KEY, snap)
        .then(() => { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} })
        .catch(() => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {} });
}
async function loadGameStateAsync() {
    let raw = null;
    try { raw = await idbGet(SAVE_KEY); } catch (e) {}
    if (!raw) { try { const ls = localStorage.getItem(SAVE_KEY); if (ls) raw = JSON.parse(ls); } catch (e) {} } // migrasi dari versi lama
    const ok = applyLoadedState(raw);
    if (ok) flushSave();
    return ok;
}
