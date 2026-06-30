import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { toPng } from 'html-to-image'
import { jsPDF } from 'jspdf'
import { downloadBlob } from './utils'
import { ClientOfferExport, type OfferExportData } from '@/components/export/ClientOfferExport'

/**
 * High-resolution, poster-grade export pipeline.
 *
 * - Fixed poster width (1080px) → predictable, professional layout.
 * - pixelRatio 2.5 → ~2700px-wide raster, sharp text on retina + print.
 * - Web fonts (Cairo / Space Grotesk) are loaded BEFORE capture so glyphs are
 *   never rasterized with a fallback face (a common cause of "blurry"/wrong text).
 * - The offer is rendered imperatively into a detached off-screen host, so any
 *   caller (a quote, a package, a single hotel card) can export without keeping
 *   a live React subtree mounted. No transform:scale() is used anywhere — that
 *   would soften the raster.
 */
const EXPORT_WIDTH = 1080
const PIXEL_RATIO = 2.5

const FONT_SPECS = [
  '400 16px Cairo',
  '600 16px Cairo',
  '700 20px Cairo',
  '800 32px Cairo',
  '700 22px "Space Grotesk"',
]

// The same Google Fonts stylesheet referenced in index.html.
const FONT_CSS_HREF =
  'https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap'

async function ensureFonts(): Promise<void> {
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
  if (!fonts) return
  try {
    await Promise.all(FONT_SPECS.map((s) => fonts.load(s).catch(() => undefined)))
    await fonts.ready
  } catch {
    /* font loading is best-effort */
  }
}

/**
 * Build a self-contained @font-face CSS string with the web fonts inlined as
 * base64. We pass this to html-to-image as `fontEmbedCSS` so it never tries to
 * read the cross-origin Google Fonts stylesheet (which the browser blocks for
 * CSSOM access) — that block is what leaves exported text in a fallback face.
 * Cached for the session; empty string on failure (capture still proceeds).
 */
let _fontEmbedCache: string | null = null
async function getFontEmbedCss(): Promise<string> {
  if (_fontEmbedCache !== null) return _fontEmbedCache
  try {
    const css = await (await fetch(FONT_CSS_HREF)).text()
    const urls = Array.from(new Set([...css.matchAll(/url\((https:\/\/[^)]+)\)/g)].map((m) => m[1])))
    const replacements = new Map<string, string>()
    await Promise.all(
      urls.map(async (u) => {
        try {
          const buf = await (await fetch(u)).arrayBuffer()
          const bytes = new Uint8Array(buf)
          let bin = ''
          for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
          replacements.set(u, `data:font/woff2;base64,${btoa(bin)}`)
        } catch {
          /* skip a font that fails to fetch */
        }
      }),
    )
    let out = css
    for (const [u, dataUri] of replacements) out = out.split(u).join(dataUri)
    _fontEmbedCache = out
  } catch {
    _fontEmbedCache = ''
  }
  return _fontEmbedCache
}

/** Wait for two animation frames so layout + fonts settle before capture. */
function nextFrames(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  )
}

interface Capture {
  url: string
  /** CSS-pixel layout size (used for the PDF page); the raster is PIXEL_RATIO×. */
  cssW: number
  cssH: number
}

async function captureOffer(data: OfferExportData): Promise<Capture> {
  const [, fontEmbedCSS] = await Promise.all([ensureFonts(), getFontEmbedCss()])

  const host = document.createElement('div')
  Object.assign(host.style, {
    position: 'fixed',
    insetInlineStart: '-100000px',
    top: '0',
    width: `${EXPORT_WIDTH}px`,
    background: '#ffffff',
    zIndex: '-1',
    pointerEvents: 'none',
  } as CSSStyleDeclaration)
  document.body.appendChild(host)

  const root = createRoot(host)
  try {
    root.render(createElement(ClientOfferExport, data))
    await nextFrames()
    await ensureFonts()
    await nextFrames()

    const node = host.firstElementChild as HTMLElement | null
    if (!node) throw new Error('export node failed to render')

    const cssW = node.offsetWidth || EXPORT_WIDTH
    const cssH = node.offsetHeight
    const opts = {
      cacheBust: true,
      backgroundColor: '#ffffff',
      pixelRatio: PIXEL_RATIO,
      width: cssW,
      height: cssH,
      // Pre-inlined fonts (skips the cross-origin stylesheet scan entirely).
      fontEmbedCSS,
    }
    // First pass warms layout/raster; second pass is the keeper.
    await toPng(node, opts)
    const url = await toPng(node, opts)
    return { url, cssW, cssH }
  } finally {
    root.unmount()
    host.remove()
  }
}

export async function exportOfferPng(data: OfferExportData, filename: string): Promise<void> {
  const { url } = await captureOffer(data)
  const res = await fetch(url)
  downloadBlob(await res.blob(), filename)
}

export async function exportOfferPdf(data: OfferExportData, filename: string): Promise<void> {
  const { url, cssW, cssH } = await captureOffer(data)
  const pdf = new jsPDF({
    orientation: cssW >= cssH ? 'landscape' : 'portrait',
    unit: 'px',
    format: [cssW, cssH],
    compress: true,
  })
  // Same high-res PNG, downscaled into the page → crisp print output.
  pdf.addImage(url, 'PNG', 0, 0, cssW, cssH)
  pdf.save(filename)
}
