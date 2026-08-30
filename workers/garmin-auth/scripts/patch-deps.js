'use strict';
/* eslint-disable @typescript-eslint/no-require-imports -- intentional CommonJS postinstall script */
const fs = require('fs');
const path = require('path');

const workerRoot = path.join(__dirname, '..');
const nodeModulesRoot = path.join(workerRoot, 'node_modules');

function patchGarminLoginForm(source) {
  if (source.includes('step3Form = new URLSearchParams();')) return source;

  const original = [
    'step3Form = new form_data_1.default();',
    "step3Form.append('username', username);",
    "step3Form.append('password', password);",
    "step3Form.append('embed', 'true');",
    "step3Form.append('_csrf', csrf_token);",
  ].join('\n                        ');
  const replacement = [
    'step3Form = new URLSearchParams();',
    "step3Form.append('username', username);",
    "step3Form.append('password', password);",
    "step3Form.append('embed', 'true');",
    "step3Form.append('_csrf', csrf_token);",
  ].join('\n                        ');

  if (!source.includes(original)) {
    throw new Error('Unsupported garmin-connect login implementation; review the Worker compatibility patch');
  }

  return source.replace(original, replacement);
}

function patchDependencies() {
  // 1. app-root-path's browser-shim.js uses `require.main.filename` which is
  // undefined in Cloudflare Workers. Replace with a safe no-op.
  const shimPath = path.join(nodeModulesRoot, 'app-root-path', 'browser-shim.js');
  if (fs.existsSync(shimPath)) {
    fs.writeFileSync(
      shimPath,
      [
        "'use strict';",
        "exports.path = '/';",
        'exports.resolve = p => p;',
        'exports.require = p => require(p);',
        "exports.toString = () => '/';",
        "exports.setPath = p => { exports.path = p; };",
      ].join('\n') + '\n',
    );
    console.log('Patched node_modules/app-root-path/browser-shim.js for CF Workers');
  }

  // 2. garmin-connect 1.6.2 builds the sign-in payload with Node's `form-data`
  // package but labels it as application/x-www-form-urlencoded. Workerd cannot
  // serialize that combination, so use the standards-based payload Garmin expects.
  const garminHttpClientPath = path.join(
    nodeModulesRoot,
    'garmin-connect',
    'dist',
    'common',
    'HttpClient.js',
  );

  if (!fs.existsSync(garminHttpClientPath)) {
    throw new Error('garmin-connect HttpClient.js was not found');
  }

  const garminSource = fs.readFileSync(garminHttpClientPath, 'utf8');
  const patchedGarminSource = patchGarminLoginForm(garminSource);
  fs.writeFileSync(garminHttpClientPath, patchedGarminSource);
  console.log('Patched garmin-connect login form for Cloudflare Workers');

  // 3. axios passes `cache: 'default'` to new Request(), which Cloudflare Workers
  // don't support. Patch all dist variants that get bundled by esbuild.
  const cachePattern = /\bcache:\s*['"]default['"]\s*,?\s*\n?/g;
  const axiosPaths = [
    'axios/lib/adapters/fetch.js',
    'axios/dist/node/axios.cjs',
    'axios/dist/browser/axios.cjs',
    'axios/dist/esm/axios.js',
    'axios/dist/axios.js',
    'axios/index.js',
  ].map((dependencyPath) => path.join(nodeModulesRoot, dependencyPath));

  for (const dependencyPath of axiosPaths) {
    if (!fs.existsSync(dependencyPath)) continue;
    const source = fs.readFileSync(dependencyPath, 'utf8');
    const patched = source.replace(cachePattern, '');
    if (patched !== source) {
      fs.writeFileSync(dependencyPath, patched);
      console.log(`Patched ${path.relative(nodeModulesRoot, dependencyPath)} — removed cache field for CF Workers`);
    }
  }
}

if (require.main === module) patchDependencies();

module.exports = { patchGarminLoginForm, patchDependencies };
