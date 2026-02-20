const esbuild = require('esbuild')
const fs = require('fs')

// Main process
esbuild.buildSync({
  entryPoints: ['src/main.ts'],
  bundle: true,
  platform: 'node',
  external: ['electron', 'chokidar'],
  outfile: 'dist/main.js',
})

// Preload
esbuild.buildSync({
  entryPoints: ['src/preload.ts'],
  bundle: true,
  platform: 'node',
  external: ['electron'],
  outfile: 'dist/preload.js',
})

// Renderer bundle (marked is imported directly in index.ts)
esbuild.buildSync({
  entryPoints: ['src/renderer/index.ts'],
  bundle: true,
  platform: 'browser',
  outfile: 'dist/renderer/bundle.js',
})

// Copy static assets — replace dev script tags with single bundle reference
fs.mkdirSync('dist/renderer', { recursive: true })
const html = fs.readFileSync('src/renderer/index.html', 'utf8')
const beforeScripts = html.slice(0, html.indexOf('<script'))
const prodHtml = beforeScripts + '<script src="bundle.js"></script>\n</body>\n</html>\n'
fs.writeFileSync('dist/renderer/index.html', prodHtml)
fs.copyFileSync('src/renderer/style.css', 'dist/renderer/style.css')
