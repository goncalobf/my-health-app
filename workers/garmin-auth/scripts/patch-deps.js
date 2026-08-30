'use strict';
const fs = require('fs');
const path = require('path');

// 1. app-root-path's browser-shim.js uses `require.main.filename` which is
//    undefined in Cloudflare Workers. Replace with a safe no-op.
const shimPath = path.join(__dirname, '..', 'node_modules', 'app-root-path', 'browser-shim.js');
if (fs.existsSync(shimPath)) {
  fs.writeFileSync(
    shimPath,
    [
      "'use strict';",
      "exports.path = '/';",
      "exports.resolve = p => p;",
      "exports.require = p => require(p);",
      "exports.toString = () => '/';",
      "exports.setPath = p => { exports.path = p; };",
    ].join('\n') + '\n',
  );
  console.log('Patched node_modules/app-root-path/browser-shim.js for CF Workers');
}

// 2. axios passes `cache: 'default'` to new Request(), which Cloudflare Workers
//    don't support. Patch all dist variants that get bundled by esbuild.
const CACHE_RE = /\bcache:\s*['"]default['"]\s*,?\s*\n?/g;
const axiosPaths = [
  'axios/lib/adapters/fetch.js',
  'axios/dist/node/axios.cjs',
  'axios/dist/browser/axios.cjs',
  'axios/dist/esm/axios.js',
  'axios/dist/axios.js',
  'axios/index.js',
].map(p => path.join(__dirname, '..', 'node_modules', p));

for (const p of axiosPaths) {
  if (!fs.existsSync(p)) continue;
  const src = fs.readFileSync(p, 'utf8');
  const patched = src.replace(CACHE_RE, '');
  if (patched !== src) {
    fs.writeFileSync(p, patched);
    console.log(`Patched ${path.relative(path.join(__dirname, '..', 'node_modules'), p)} — removed cache field for CF Workers`);
  }
}
