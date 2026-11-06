import { glyph } from './glyph.mjs'
import { createRequire } from 'module'
// Fuente del ícono. Regenerar desde mobile/: CHROME=<chromium de Playwright> node assets/icon-source/render.mjs assets/images
// (usa el Playwright de frontend/). preview.png y shapes.png son vistas previas: bórralas después.
const require = createRequire(new URL('../../../frontend/package.json', import.meta.url))
const { chromium } = require('@playwright/test')
const OUT = process.argv[2]
const TEAL = '#0d5953', CREAM = '#f7f3ec', PEACH = '#f6c38a'
const svg = (body, bg) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">${bg ? `<rect width="1024" height="1024" fill="${bg}"/>` : ''}${body}</svg>`
// Fondo con un halo durazno muy suave detrás de la huella.
const halo = `<defs><radialGradient id="h" cx="50%" cy="46%" r="55%"><stop offset="0" stop-color="#16736b"/><stop offset="1" stop-color="${TEAL}"/></radialGradient></defs><rect width="1024" height="1024" fill="url(#h)"/>`
const files = {
  'icon.png': [svg(halo + glyph({ s: 1.12 })), 1024],
  'android-icon-background.png': [svg(halo), 1024],
  'android-icon-foreground.png': [svg(glyph({ s: 0.82 })), 1024],
  'android-icon-monochrome.png': [svg(glyph({ s: 0.82, pad: '#ffffff', mono: true })), 1024],
  'splash-icon.png': [svg(glyph({ s: 1.0 })), 1024],
  'favicon.png': [svg(halo + glyph({ s: 1.08 })), 48],
  'preview.png': [svg(halo + glyph({ s: 1.0 })), 1024],
}
const browser = await chromium.launch({ executablePath: process.env.CHROME })
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } })
for (const [name, [markup, size]] of Object.entries(files)) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<html><body style="margin:0;background:transparent">${markup.replace('width="1024" height="1024"', `width="${size}" height="${size}"`)}</body></html>`)
  await page.screenshot({ path: `${OUT}/${name}`, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } })
}
// Vista de cómo se ve recortado como ícono adaptable (círculo) y como ícono de iOS (esquinas).
await page.setViewportSize({ width: 760, height: 260 })
const fg = svg(glyph({ s: 0.72 })), bgs = svg(halo)
await page.setContent(`<html><body style="margin:0;background:${CREAM};display:flex;gap:40px;align-items:center;justify-content:center;height:260px">
  <div style="width:180px;height:180px;border-radius:40px;overflow:hidden">${svg(halo + glyph({})).replace('width="1024" height="1024"', 'width="180" height="180"')}</div>
  <div style="width:180px;height:180px;border-radius:50%;overflow:hidden;position:relative"><div style="position:absolute;inset:-15%">${bgs.replace('width="1024" height="1024"', 'width="100%" height="100%"')}</div><div style="position:absolute;inset:-15%">${fg.replace('width="1024" height="1024"', 'width="100%" height="100%"')}</div></div>
  <div style="width:180px;height:180px;border-radius:50%;overflow:hidden;background:#1d2b2d;position:relative"><div style="position:absolute;inset:-15%">${svg(glyph({ s: 0.72, pad: '#e8e1d5', mono: true })).replace('width="1024" height="1024"', 'width="100%" height="100%"')}</div></div>
</body></html>`)
await page.screenshot({ path: `${OUT}/shapes.png` })
await browser.close()
