// Bundles the game into one self-contained HTML file (polyrush.html) that works when
// opened straight from disk — no web server needed (handy on Chromebooks and phones).
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

const result = await build({
  entryPoints: [root + 'js/main.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  write: false,
  alias: { three: root + 'vendor/three.module.min.js' },
  logLevel: 'warning',
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync(root + 'css/style.css', 'utf8');
let html = readFileSync(root + 'index.html', 'utf8');

const swap = (pattern, replacement) => {
  if (!pattern.test(html)) throw new Error('index.html is missing ' + pattern);
  html = html.replace(pattern, () => replacement);
};
swap(/<link rel="stylesheet" href="css\/style.css" \/>/, `<style>\n${css}</style>`);
swap(/\s*<script type="importmap">[\s\S]*?<\/script>/, '');
const peer = readFileSync(root + 'vendor/peerjs.min.js', 'utf8').replace(/<\/script/gi, '<\\/script');
swap(/<script src="vendor\/peerjs.min.js"><\/script>/, `<script>\n${peer}</script>`);
swap(/<script type="module" src="js\/main.js"><\/script>/, `<script>\n${js}</script>`);

writeFileSync(root + 'polyrush.html', html);
console.log(`Wrote polyrush.html (${Math.round(html.length / 1024)} KB)`);
