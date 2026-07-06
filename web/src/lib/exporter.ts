import { createElement, type ComponentType } from 'react'
import { createRoot, type Root } from 'react-dom/client'
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
  type OfferAnalysis,
  type OfferExportData,
  type FlowBlock,
} from '@/components/export/ClientOfferExport'
import {
  buildHoneymoon,
  HoneymoonMeasureTree,
  HoneymoonPagesTree,
  HoneymoonSingleTree,
  type HoneymoonAnalysis,
} from '@/components/export/HoneymoonExport'

/**
 * A "document kit" abstracts the one bit that differs between the standard offer
 * export and the honeymoon brochure: how the data becomes analysis + flow blocks
 * and which chrome the three off-screen trees render. Everything downstream
 * (measure → paginate → capture) is identical, so both share one engine.
 */
interface DocAnalysis {
  dir: 'rtl' | 'ltr'
  blockGap: number
}
interface DocKit<A extends DocAnalysis> {
  build: (data: OfferExportData) => { analysis: A; blocks: FlowBlock[] }
  Measure: ComponentType<{ analysis: A; blocks: FlowBlock[] }>
  Single: ComponentType<{ analysis: A; blocks: FlowBlock[] }>
  Pages: ComponentType<{ analysis: A; pages: FlowBlock[][] }>
}

const OFFER_KIT: DocKit<OfferAnalysis> = { build: buildOffer, Measure: MeasureTree, Single: SingleDocTree, Pages: PagesTree }
const HONEYMOON_KIT: DocKit<HoneymoonAnalysis> = { build: buildHoneymoon, Measure: HoneymoonMeasureTree, Single: HoneymoonSingleTree, Pages: HoneymoonPagesTree }

/**
 * Paginated, poster-grade export pipeline.
 *
 * The offer is laid out as a sequence of atomic "flow blocks" (hotel sections,
 * notes, terms). Instead of emitting one arbitrarily tall image (which produced
 * multi-thousand-pixel strips AND corrupt PDFs — a single PDF page can exceed
 * the format's 14 400 pt maximum, and a giant PNG pushed through jsPDF's
 * deflate truncates), we:
 *
 *   1. Render the blocks off-screen once and MEASURE each block + the page
 *      chrome (header/footer) heights.
 *   2. Decide the shape:
 *      PNG → one content-fitted poster when the whole offer fits a safe height
 *            (MAX_SINGLE_H), otherwise numbered A-series pages ("name-1.png",
 *            "name-2.png", …) so no export is ever an unreadable strip.
 *      PDF → always fixed A4-proportioned pages.
 *   3. PACK the blocks into pages (never splitting a block) and capture EACH
 *      page separately at a safe resolution.
 */
const PIXEL_RATIO = 2 // 1080×1527 → 2160×3054 per page: crisp for print, never oversized.
// Vertical breathing room subtracted from each page's usable height so rounding
// never pushes content past PAGE_H (pages use overflow:hidden).
const PAGE_SAFETY = 12
// Tallest allowed single-PNG poster (~1.55 pages). Anything taller pages out.
const MAX_SINGLE_H = Math.round(PAGE_H * 1.55)

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

async function settle(): Promise<void> {
  await nextFrames()
  await ensureFonts()
  await nextFrames()
}

/**
 * Greedily pack flow blocks into fixed-height pages.
 * @param heights measured pixel height of each block (same index as `blocks`)
 * @param gap vertical gap between blocks (density-dependent)
 * @param firstBudget usable content height on page 1 (full header)
 * @param restBudget usable content height on pages 2+ (running header)
 */
function paginate(
  blocks: FlowBlock[],
  heights: number[],
  gap: number,
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
      const add = (page.length ? gap : 0) + heights[i]
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

/**
 * Greedy packing fills early pages to the brim and can strand one hotel + the
 * terms box on a nearly-empty last page. Rebalance: keep the greedy page COUNT
 * but cap every page near the average fill so the set looks evenly composed.
 */
function paginateBalanced(
  blocks: FlowBlock[],
  heights: number[],
  gap: number,
  firstBudget: number,
  restBudget: number,
): FlowBlock[][] {
  const greedy = paginate(blocks, heights, gap, firstBudget, restBudget)
  const n = greedy.length
  if (n <= 1) return greedy
  const total = heights.reduce((a, b) => a + b, 0) + gap * Math.max(0, heights.length - 1)
  let soft = Math.ceil(total / n)
  for (let iter = 0; iter < 12; iter++) {
    const pages = paginate(blocks, heights, gap, Math.min(firstBudget, soft), Math.min(restBudget, soft))
    if (pages.length <= n) return pages
    soft = Math.ceil(soft * 1.06)
    if (soft >= Math.max(firstBudget, restBudget)) break
  }
  return greedy
}

export interface OfferRender {
  /** Data-URLs, one per exported image. */
  urls: string[]
  /** True when the offer was split into fixed pages (PNG set / PDF pages). */
  paged: boolean
}

/**
 * Render a document off-screen, measure it, and capture it as images.
 * `forcePages` (PDF) always paginates; otherwise a single content-fitted
 * poster is produced when the whole thing fits MAX_SINGLE_H.
 */
async function renderDocumentImages<A extends DocAnalysis>(
  kit: DocKit<A>,
  data: OfferExportData,
  opts: { forcePages?: boolean } = {},
): Promise<OfferRender> {
  const [, fontEmbedCSS] = await Promise.all([ensureFonts(), getFontEmbedCss()])
  const { analysis, blocks } = kit.build(data)

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

  const root: Root = createRoot(host)
  try {
    // ---- 1. Measuring pass ----
    root.render(createElement(kit.Measure, { analysis, blocks }))
    await settle()

    const px = (sel: string): number => {
      const el = host.querySelector(sel) as HTMLElement | null
      return el ? el.offsetHeight : 0
    }
    const fullHeaderH = px('[data-m="fh"]')
    const runHeaderH = px('[data-m="rh"]')
    const footerH = px('[data-m="ft"]')
    const heights = blocks.map((_, i) => px(`[data-b="${i}"]`))
    const gap = analysis.blockGap

    // ---- 2a. Single poster when everything fits a safe height ----
    const contentH = heights.reduce((a, b) => a + b, 0) + gap * Math.max(0, heights.length - 1)
    const singleH = fullHeaderH + 4 + contentH + 28 // SingleDocTree top/bottom padding
    if (!opts.forcePages && singleH <= MAX_SINGLE_H) {
      root.render(createElement(kit.Single, { analysis, blocks }))
      await settle()
      const node = host.firstElementChild as HTMLElement | null
      if (!node) throw new Error('export node failed to render')
      const captureOpts = {
        cacheBust: true,
        backgroundColor: '#ffffff',
        pixelRatio: PIXEL_RATIO,
        width: node.offsetWidth || PAGE_W,
        height: node.offsetHeight,
        fontEmbedCSS,
      }
      await toPng(node, captureOpts) // warm pass (settles raster/glyphs)
      return { urls: [await toPng(node, captureOpts)], paged: false }
    }

    // ---- 2b. Fixed pages ----
    const firstBudget = PAGE_H - fullHeaderH - footerH - PAGE_SAFETY
    const restBudget = PAGE_H - runHeaderH - footerH - PAGE_SAFETY
    const pages = paginateBalanced(blocks, heights, gap, firstBudget, restBudget)

    root.render(createElement(kit.Pages, { analysis, pages }))
    await settle()

    const pageNodes = Array.from(host.querySelectorAll('[data-page]')) as HTMLElement[]
    if (pageNodes.length === 0) throw new Error('export pages failed to render')

    const captureOpts = {
      cacheBust: true,
      backgroundColor: '#ffffff',
      pixelRatio: PIXEL_RATIO,
      width: PAGE_W,
      height: PAGE_H,
      fontEmbedCSS,
    }
    await toPng(pageNodes[0], captureOpts) // warm pass
    const urls: string[] = []
    for (const node of pageNodes) urls.push(await toPng(node, captureOpts))
    return { urls, paged: true }
  } finally {
    root.unmount()
    host.remove()
  }
}

/** Standard offer/hotel/package export (the shared multi-hotel price grid). */
export function renderOfferImages(data: OfferExportData, opts: { forcePages?: boolean } = {}): Promise<OfferRender> {
  return renderDocumentImages(OFFER_KIT, data, opts)
}

/** Honeymoon brochure export (single-subject premium layout). */
export function renderHoneymoonImages(data: OfferExportData, opts: { forcePages?: boolean } = {}): Promise<OfferRender> {
  return renderDocumentImages(HONEYMOON_KIT, data, opts)
}

async function urlToBlob(url: string): Promise<Blob> {
  return (await fetch(url)).blob()
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Renderer = (data: OfferExportData, opts?: { forcePages?: boolean }) => Promise<OfferRender>

/**
 * Export as PNG. One poster image when the document fits a safe height,
 * otherwise a numbered page set ("name-1.png", "name-2.png", …).
 * Returns the number of files written.
 */
async function writePng(render: Renderer, data: OfferExportData, filename: string): Promise<number> {
  const { urls, paged } = await render(data)
  const base = filename.replace(/\.png$/i, '')
  if (!paged || urls.length === 1) {
    downloadBlob(await urlToBlob(urls[0]), `${base}.png`)
    return 1
  }
  for (let i = 0; i < urls.length; i++) {
    downloadBlob(await urlToBlob(urls[i]), `${base}-${i + 1}.png`)
    // Small pause between anchor clicks so browsers don't drop downloads.
    if (i < urls.length - 1) await delay(180)
  }
  return urls.length
}

/** Export as a clean multi-page A4 PDF (one page per captured page). */
async function writePdf(render: Renderer, data: OfferExportData, filename: string): Promise<number> {
  const { urls } = await render(data, { forcePages: true })
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

export const exportOfferPng = (data: OfferExportData, filename: string) => writePng(renderOfferImages, data, filename)
export const exportOfferPdf = (data: OfferExportData, filename: string) => writePdf(renderOfferImages, data, filename)
export const exportHoneymoonPng = (data: OfferExportData, filename: string) => writePng(renderHoneymoonImages, data, filename)
export const exportHoneymoonPdf = (data: OfferExportData, filename: string) => writePdf(renderHoneymoonImages, data, filename)
