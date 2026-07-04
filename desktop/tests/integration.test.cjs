const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('desktop renderer runs with hardened Electron preferences', () => {
  const main = read('desktop/main.cjs');
  assert.match(main, /contextIsolation:\s*true/);
  assert.match(main, /nodeIntegration:\s*false/);
  assert.match(main, /sandbox:\s*true/);
  assert.match(main, /webSecurity:\s*true/);
  assert.match(main, /setPermissionRequestHandler/);
  assert.match(main, /setZoomFactor\(1\)/);
});

test('preload exposes a narrow API instead of Electron internals', () => {
  const preload = read('desktop/preload.cjs');
  assert.match(preload, /contextBridge\.exposeInMainWorld\('desktopApp'/);
  assert.doesNotMatch(preload, /exposeInMainWorld\([^,]+,\s*ipcRenderer/);
  assert.doesNotMatch(preload, /remote/);
});

test('Windows packaging includes installer and portable targets', () => {
  const manifest = JSON.parse(read('package.json'));
  assert.equal(manifest.main, 'desktop/main.cjs');
  assert.deepEqual(manifest.build.win.target, ['nsis', 'portable']);
  assert.equal(manifest.build.asar, true);
  assert.match(manifest.scripts['dist:win:installer'], /electron-builder --win nsis/);
  assert.match(manifest.scripts['dist:win:portable'], /electron-builder --win portable/);
});

test('renderer has desktop routing and a restrictive content security policy', () => {
  assert.match(read('client/src/main.jsx'), /HashRouter/);
  const html = read('client/index.html');
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /object-src 'none'/);
});

test('packaged renderer assets resolve relative to the built index', () => {
  for (const file of ['client/src/components/Brand.jsx', 'client/src/components/Loader.jsx', 'client/src/components/GlobalLoader.jsx']) {
    const source = read(file);
    assert.match(source, /new URL\('logo\.png', document\.baseURI\)/);
    assert.doesNotMatch(source, /src="\/logo\.png"/);
  }
});

test('production result UI renders only canonical comparison parts', () => {
  const resultPage = read('client/src/pages/Result.jsx');
  assert.match(resultPage, /comparison\.referenceParts/);
  assert.match(resultPage, /comparison\.typedParts/);
  assert.doesNotMatch(resultPage, /referenceReviewParts|typedReviewParts|[∅␠↵]/u);
});
