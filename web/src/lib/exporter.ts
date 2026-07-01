import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { toPng } from 'html-to-image'
import { jsPDF } from 'jspdf'
import { downloadBlob } from './utils'
import {
  buildOffer,
  MeasureTree,
  PagesTree,
  SingleDocTree,
  PAGE_W,
  PAGE_H,
  BLOCK_GAP,
  type OfferExportData,
  type FlowBlock,
} from '@/components/export/ClientOfferExport'

/**
 * Paginated, poster-grade export pipeline.
 *
 * The offer is laid out as a sequence of atomic "flow blocks" (hotel headers,
 * period tables, info boxes, notes, terms). Instead of emitting one arbitrarily
 * tall image (which produced multi-thousand-pixel strips AND corrupt PDFs — a
 * single PDF page can exceed the format's 14 400 pt maximum, and a giant PNG
 * pushed through jsPDF's deflate truncates), we:
 *
 *   1. Render the blocks off-screen once and MEASURE each block + the page
 *      chrome (header/footer) heights.
 *   2. PACK the blocks into fixed A4-proportioned pages, never splitting a block
 *      and keeping each hotel header with its first period.
 *   3. Render the real pages and capture EACH page separately at a safe
 *      resolution — so every raster is small and every PDF page is a valid A4.
 *
 * PNG export → one image when it fits a page, otherwise a numbered set.
 * PDF export → a clean multi-page A4 document.
 */
const PIXEL_RATIO = 2 // 1080×1527 → 2160×3054 per page: crisp for print, never oversized.
// Vertical breathing room subtracted from each page's usable height so rounding
// never pushes content past PAGE_H (pages use overflow:hidden).
const PAGE_SAFETY = 12

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
 * base64, passed to html-to-image as `fontEmbedCSS` so it never reads the
 * cross-origin Google Fonts stylesheet (blocked for CSSOM access) — that block
 * is what otherwise leaves exported text in a fallback face.
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

/** Wait for two animation frames so layout + fonts settle before measuring/capture. */
function nextFrames(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  )
}

/**
 * Greedily pack flow blocks into fixed-height pages.
 * @param heights measured pixel height of each block (same index as `blocks`)
 * @param firstBudget usable content height on page 1 (full header)
 * @param restBudget usable content height on pages 2+ (running header)
 */
function paginate(
  blocks: FlowBlock[],
  heights: number[],
  firstBudget: number,
  restBudget: number,
): FlowBlock[][] {
  const pages: FlowBlock[][] = []
  let i = 0
  while (i < blocks.length) {
    const budget = pages.length === 0 ? firstBudget : restBudget
    const page: number[] = []
    let used = 0
    while (i < blocks.length) {
      const add = (page.length ? BLOCK_GAP : 0) + heights[i]
      if (used + add > budget && page.length > 0) break
      page.push(i)
      used += add
      i++
    }
    // Keep a hotel header (keepWithNext) with its first period: if it ended up as
    // the last block on the page but the next block didn't fit, push it forward.
    while (page.length > 1 && blocks[page[page.length - 1]].keepWithNext && i < blocks.length) {
      i = page.pop() as number
      used = 0 // (recomputed next loop; value unused past here)
    }
    // A single block taller than the whole budget still gets its own page.
    if (page.length === 0) {
      page.push(i)
      i++
    }
    pages.push(page.map((idx) => blocks[idx]))
  }
  return pages.length ? pages : [[]]
}

/** Render off-screen, measure, paginate, then capture one PNG per page. */
async function capturePages(data: OfferExportData): Promise<string[]> {
  const [, fontEmbedCSS] = await Promise.all([ensureFonts(), getFontEmbedCss()])
  const { analysis, blocks } = buildOffer(data)

  const host = document.createElement('div')
  Object.assign(host.style, {
    position: 'fixed',
    insetInlineStart: '-100000px',
    top: '0',
    width: `${PAGE_W}px`,
    background: '#ffffff',
    zIndex: '-1',
    pointerEvents: 'none',
  } as CSSStyleDeclaration)
  document.body.appendChild(host)

  const root = createRoot(host)
  try {
    // ---- 1. Measuring pass ----
    root.render(createElement(MeasureTree, { analysis, blocks }))
    await nextFrames()
    await ensureFonts()
    await nextFrames()

    const px = (sel: string): number => {
      const el = host.querySelector(sel) as HTMLElement | null
      return el ? el.offsetHeight : 0
    }
    const fullHeaderH = px('[data-m="fh"]')
    const runHeaderH = px('[data-m="rh"]')
    const footerH = px('[data-m="ft"]')
    const heights = blocks.map((_, i) => px(`[data-b="${i}"]`))

    const firstBudget = PAGE_H - fullHeaderH - footerH - PAGE_SAFETY
    const restBudget = PAGE_H - runHeaderH - footerH - PAGE_SAFETY
    const pages = paginate(blocks, heights, firstBudget, restBudget)

    // ---- 2. Final paginated render ----
    root.render(createElement(PagesTree, { analysis, pages }))
    await nextFrames()
    await ensureFonts()
    await nextFrames()

    const pageNodes = Array.from(host.querySelectorAll('[data-page]')) as HTMLElement[]
    if (pageNodes.length === 0) throw new Error('export pages failed to render')

    const opts = {
      cacheBust: true,
      backgroundColor: '#ffffff',
      pixelRatio: PIXEL_RATIO,
      width: PAGE_W,
      height: PAGE_H,
      fontEmbedCSS,
    }
    // Warm pass on the first page (settles layout/raster/glyphs), then keep the
    // real captures.
    await toPng(pageNodes[0], opts)
    const urls: string[] = []
    for (const node of pageNodes) urls.push(await toPng(node, opts))
    return urls
  } finally {
    root.unmount()
    host.remove()
  }
}

async function urlToBlob(url: string): Promise<Blob> {
  return (await fetch(url)).blob()
}

/** Render the whole offer as one continuous node and capture it as a single image. */
async function captureSingle(data: OfferExportData): Promise<string> {
  const [, fontEmbedCSS] = await Promise.all([ensureFonts(), getFontEmbedCss()])
  const { analysis, blocks } = buildOffer(data)

  const host = document.createElement('div')
  Object.assign(host.style, {
    position: 'fixed',
    insetInlineStart: '-100000px',
    top: '0',
    width: `${PAGE_W}px`,
    background: '#ffffff',
    zIndex: '-1',
    pointerEvents: 'none',
  } as CSSStyleDeclaration)
  document.body.appendChild(host)

  const root = createRoot(host)
  try {
    root.render(createElement(SingleDocTree, { analysis, blocks }))
    await nextFrames()
    await ensureFonts()
    await nextFrames()

    const node = host.firstElementChild as HTMLElement | null
    if (!node) throw new Error('export node failed to render')
    const cssW = node.offsetWidth || PAGE_W
    const cssH = node.offsetHeight
    const opts = { cacheBust: true, backgroundColor: '#ffffff', pixelRatio: PIXEL_RATIO, width: cssW, height: cssH, fontEmbedCSS }
    await toPng(node, opts) // warm pass
    return await toPng(node, opts)
  } finally {
    root.unmount()
    host.remove()
  }
}

/** Export the offer as a single PNG image (the whole offer in one file). */
export async function exportOfferPng(data: OfferExportData, filename: string): Promise<void> {
  const url = await captureSingle(data)
  const base = filename.replace(/\.png$/i, '')
  downloadBlob(await urlToBlob(url), `${base}.png`)
}

/** Export the offer as a clean multi-page A4 PDF (one page per captured page). */
export async function exportOfferPdf(data: OfferExportData, filename: string): Promise<number> {
  const urls = await capturePages(data)
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true })
  const w = pdf.internal.pageSize.getWidth()
  const h = pdf.internal.pageSize.getHeight()
  urls.forEach((url, idx) => {
    if (idx > 0) pdf.addPage()
    // Each page raster is exactly A4-proportioned → fills the A4 page cleanly.
    pdf.addImage(url, 'PNG', 0, 0, w, h, undefined, 'FAST')
  })
  pdf.save(filename)
  return urls.length
}
