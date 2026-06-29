import { toPng } from 'html-to-image'
import { jsPDF } from 'jspdf'
import { downloadBlob } from './utils'

async function dataUrl(node: HTMLElement): Promise<string> {
  // Two passes improve web-font (Cairo) reliability in html-to-image.
  await toPng(node, { cacheBust: true, backgroundColor: '#ffffff', pixelRatio: 2 })
  return toPng(node, { cacheBust: true, backgroundColor: '#ffffff', pixelRatio: 2 })
}

function imageSize(url: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = url
  })
}

export async function exportPng(node: HTMLElement, filename: string) {
  const url = await dataUrl(node)
  const res = await fetch(url)
  downloadBlob(await res.blob(), filename)
}

export async function exportPdf(node: HTMLElement, filename: string) {
  const url = await dataUrl(node)
  const { w, h } = await imageSize(url)
  const pdf = new jsPDF({ orientation: w >= h ? 'landscape' : 'portrait', unit: 'px', format: [w, h] })
  pdf.addImage(url, 'PNG', 0, 0, w, h)
  pdf.save(filename)
}
