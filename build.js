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

// Copy static assets
fs.mkdirSync('dist/renderer', { recursive: true })
let html = fs.readFileSync('src/renderer/index.html', 'utf8')
html = html.replace(/<script src=".*marked.*"><\/script>\n/, '')
           .replace(/<script src="search.js"><\/script>\n/, '')
           .replace(/<script src="app-logic.js"><\/script>\n/, '')
           .replace('<script src="index.js"></script>', '<script src="bundle.js"></script>')
fs.writeFileSync('dist/renderer/index.html', html)
fs.copyFileSync('src/renderer/style.css', 'dist/renderer/style.css')
