'use strict';
/* eslint-disable @typescript-eslint/no-require-imports -- Worker scripts are CommonJS */

const assert = require('node:assert/strict');
const test = require('node:test');
const { patchGarminLoginForm } = require('./patch-deps');

const brokenLoginForm = [
  'step3Form = new form_data_1.default();',
  "                        step3Form.append('username', username);",
  "                        step3Form.append('password', password);",
  "                        step3Form.append('embed', 'true');",
  "                        step3Form.append('_csrf', csrf_token);",
].join('\n');

test('replaces the incompatible Garmin login FormData payload', () => {
  const patched = patchGarminLoginForm(brokenLoginForm);

  assert.match(patched, /step3Form = new URLSearchParams\(\);/);
  assert.doesNotMatch(patched, /new form_data_1\.default\(\)/);
  assert.match(patched, /step3Form\.append\('password', password\);/);
});

test('is idempotent after the login payload is patched', () => {
  const once = patchGarminLoginForm(brokenLoginForm);
  assert.equal(patchGarminLoginForm(once), once);
});

test('fails closed when the upstream login implementation changes', () => {
  assert.throws(
    () => patchGarminLoginForm('unexpected upstream source'),
    /Unsupported garmin-connect login implementation/,
  );
});
