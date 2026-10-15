const fs = require('node:fs');
const path = require('node:path');
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const target = path.join('dist', manifest.id);
fs.mkdirSync(target, { recursive: true });
for (const file of ['main.js', 'manifest.json', 'styles.css', 'README.md', 'README.en.md', 'README.zh-CN.md', 'LICENSE']) {
  fs.copyFileSync(file, path.join(target, file));
}
console.log(`Installable folder: ${target}`);
