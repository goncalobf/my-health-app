'use strict';
const fs = require('fs');
const path = require('path');

// app-root-path's browser-shim.js uses `require.main.filename` which is
// undefined in Cloudflare Workers. Patch it to a safe no-op so garmin-connect
// can be imported (it only uses app-root-path for file-based token storage,
// which we never call).
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
