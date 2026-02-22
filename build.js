const esbuild = require('esbuild')
const fs = require('fs')

// Renderer bundle
esbuild.buildSync({
  entryPoints: ['src/renderer/index.ts'],
  bundle: true,
  platform: 'browser',
  outfile: 'dist/renderer/bundle.js',
})

// Copy static assets — replace dev script tags with single bundle reference
fs.mkdirSync('dist/renderer', { recursive: true })
const html = fs.readFileSync('src/renderer/index.html', 'utf8')
const scriptIdx = html.indexOf('<script')
if (scriptIdx === -1) throw new Error('build: <script> tag not found in index.html')
const beforeScripts = html.slice(0, scriptIdx)
const prodHtml = beforeScripts + '<script src="bundle.js"></script>\n</body>\n</html>\n'
fs.writeFileSync('dist/renderer/index.html', prodHtml)
fs.copyFileSync('src/renderer/style.css', 'dist/renderer/style.css')
