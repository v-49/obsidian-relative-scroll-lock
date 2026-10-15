const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const versions = JSON.parse(fs.readFileSync('versions.json', 'utf8'));
assert.equal(manifest.id, 'relative-scroll-lock');
assert.equal(versions[manifest.version], manifest.minAppVersion);
assert.equal(manifest.isDesktopOnly, true);
new vm.Script(fs.readFileSync('main.js', 'utf8'));
for (const file of ['main.js', 'manifest.json', 'styles.css', 'README.md', 'LICENSE']) {
  assert.ok(fs.statSync(file).size > 0, `Missing release file: ${file}`);
}
console.log(`Release ${manifest.version} verified.`);
