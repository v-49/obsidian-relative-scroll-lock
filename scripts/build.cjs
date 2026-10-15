const esbuild = require('esbuild');
esbuild.buildSync({
  entryPoints: ['src/main.js'],
  outfile: 'main.js',
  bundle: true,
  external: ['obsidian'],
  format: 'cjs',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  legalComments: 'none',
  charset: 'utf8',
});
