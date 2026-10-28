// Jalankan: node tests/run-node.js
const vm = require('vm'), fs = require('fs'), path = require('path');
const ctx = vm.createContext({ console, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {}, performance, btoa, atob, navigator: { userAgent: 'node' },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} }, requestAnimationFrame: () => 0 });
ctx.window = ctx;
['tests/stubs.js', 'js/core.js', 'js/engine.js', 'js/history.js', 'tests/shims.js', 'tests/cases.js'].forEach(f =>
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx, { filename: f }));
const r = vm.runInContext('runAll()', ctx);
r.results.forEach(x => console.log((x.ok ? '  ✓ ' : '  ✗ ') + x.n + (x.ok ? '' : '\n      → ' + x.err)));
console.log(`\n${r.passed} lulus, ${r.failed} gagal`);
process.exit(r.failed ? 1 : 0);
