/* DOM palsu minimal agar engine bisa dijalankan di Node maupun di halaman tests/index.html */
(function (g) {
    const els = {};
    const base = () => ({ value: '', textContent: '', innerHTML: '', innerText: '', className: '', checked: false, disabled: false, style: {}, dataset: {}, children: [], scrollTop: 0, scrollHeight: 0, clientWidth: 800, clientHeight: 400,
        classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } } });
    const handler = { get(t, k) { if (k in t) return t[k]; if (typeof k === 'symbol') return undefined; return function () { return undefined; }; } };
    g.__el = id => els[id] || (els[id] = new Proxy(base(), handler));
    if (typeof g.document === 'undefined') {
        g.document = { getElementById: g.__el, querySelector: () => null, querySelectorAll: () => [], createElement: () => g.__el('_' + Math.random()), addEventListener() {}, documentElement: { dataset: {} }, body: { classList: { add() {}, remove() {}, toggle() {} } }, hidden: false, activeElement: null };
    } else { document.getElementById = g.__el; }
})(typeof window !== 'undefined' ? window : globalThis);
