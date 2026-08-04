import type * as Blockly from 'blockly/core'
import {BRAND, blockColorForType} from './brand.js'
import type {ProjectPreview} from './project.js'

export type PreviewBlock = {
  type: string
  x: number
  y: number
  width: number
  height: number
}

export type PreviewModel = {
  name: string
  blockCount: number
  blocks: PreviewBlock[]
  width: number
  height: number
}

const PREVIEW_WIDTH = 640
const PREVIEW_HEIGHT = 360
const PAD = 28
const HEADER = 56

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function collectBlocks(workspace: Blockly.WorkspaceSvg): PreviewBlock[] {
  const blocks: PreviewBlock[] = []

  for (const block of workspace.getAllBlocks(false)) {
    const svg = block as Blockly.BlockSvg
    if (typeof svg.getRelativeToSurfaceXY !== 'function') continue

    const pos = svg.getRelativeToSurfaceXY()
    const width = Math.max(24, Number(svg.width) || 48)
    const height = Math.max(18, Number(svg.height) || 28)

    blocks.push({
      type: block.type,
      x: pos.x,
      y: pos.y,
      width,
      height,
    })
  }

  return blocks
}

export function buildPreviewModel(
  workspace: Blockly.WorkspaceSvg,
  name: string,
): PreviewModel {
  const blocks = collectBlocks(workspace)
  return {
    name: name.trim() || 'Unbenanntes Projekt',
    blockCount: blocks.length,
    blocks,
    width: PREVIEW_WIDTH,
    height: PREVIEW_HEIGHT,
  }
}

/**
 * Renders a branded silhouette card: dark chrome, berry/mint accents,
 * rounded block ghosts in workspace layout. Tiny, sharp, no Blockly CSS.
 */
export function renderPreviewSvg(model: PreviewModel): string {
  const contentW = model.width - PAD * 2
  const contentH = model.height - HEADER - PAD
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const block of model.blocks) {
    minX = Math.min(minX, block.x)
    minY = Math.min(minY, block.y)
    maxX = Math.max(maxX, block.x + block.width)
    maxY = Math.max(maxY, block.y + block.height)
  }

  if (!Number.isFinite(minX)) {
    minX = 0
    minY = 0
    maxX = contentW
    maxY = contentH
  }

  const spanX = Math.max(80, maxX - minX)
  const spanY = Math.max(60, maxY - minY)
  const scale = Math.min(contentW / spanX, contentH / spanY, 1.15) * 0.92
  const offsetX = PAD + (contentW - spanX * scale) / 2
  const offsetY = HEADER + (contentH - spanY * scale) / 2

  const rects = model.blocks
    .map((block) => {
      const x = offsetX + (block.x - minX) * scale
      const y = offsetY + (block.y - minY) * scale
      const w = Math.max(10, block.width * scale)
      const h = Math.max(8, block.height * scale)
      const fill = blockColorForType(block.type)
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${Math.min(8, h / 2).toFixed(1)}" fill="${fill}" opacity="0.92"/>`
    })
    .join('')

  const emptyHint =
    model.blocks.length === 0
      ? `<text x="${model.width / 2}" y="${HEADER + contentH / 2}" text-anchor="middle" fill="#8d9b95" font-family="Manrope,system-ui,sans-serif" font-size="14" font-weight="600">Noch keine Blöcke</text>`
      : ''

  const title = escapeXml(
    model.name.length > 42 ? `${model.name.slice(0, 40)}…` : model.name,
  )

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${model.width} ${model.height}" width="${model.width}" height="${model.height}" role="img" aria-label="BlockBerry Vorschau">
  <defs>
    <linearGradient id="bbGlow" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${BRAND.color}" stop-opacity="0.28"/>
      <stop offset="55%" stop-color="${BRAND.mint}" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="${BRAND.dark}" stop-opacity="0"/>
    </linearGradient>
    <pattern id="bbGrid" width="24" height="24" patternUnits="userSpaceOnUse">
      <circle cx="1.5" cy="1.5" r="1.1" fill="#c5cec9" opacity="0.55"/>
    </pattern>
  </defs>
  <rect width="${model.width}" height="${model.height}" rx="22" fill="${BRAND.paper}"/>
  <rect width="${model.width}" height="${HEADER}" rx="22" fill="${BRAND.dark}"/>
  <rect y="28" width="${model.width}" height="28" fill="${BRAND.dark}"/>
  <rect width="${model.width}" height="${model.height}" rx="22" fill="url(#bbGlow)"/>
  <g transform="translate(18 14)">
    <rect x="0" y="0" width="10" height="10" rx="2.5" fill="${BRAND.color}" transform="rotate(-4 5 5)"/>
    <rect x="12" y="0" width="10" height="10" rx="2.5" fill="${BRAND.colorSoft}" transform="rotate(-4 17 5)"/>
    <rect x="4" y="12" width="14" height="10" rx="2.5" fill="${BRAND.mint}" transform="rotate(-4 11 17)"/>
  </g>
  <text x="52" y="34" fill="#fff" font-family="Manrope,system-ui,sans-serif" font-size="15" font-weight="800">${title}</text>
  <text x="${model.width - 18}" y="34" text-anchor="end" fill="#aebbb5" font-family="Manrope,system-ui,sans-serif" font-size="11" font-weight="700">${model.blockCount} Blöcke</text>
  <rect x="${PAD}" y="${HEADER}" width="${contentW}" height="${contentH}" rx="14" fill="#eef1ef"/>
  <rect x="${PAD}" y="${HEADER}" width="${contentW}" height="${contentH}" rx="14" fill="url(#bbGrid)"/>
  ${rects}
  ${emptyHint}
  <rect x="0" y="0" width="${model.width}" height="${model.height}" rx="22" fill="none" stroke="${BRAND.line}" stroke-width="2"/>
</svg>`
}

export function previewDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export function captureWorkspacePreview(
  workspace: Blockly.WorkspaceSvg,
  name: string,
): ProjectPreview {
  const model = buildPreviewModel(workspace, name)
  const image = previewDataUri(renderPreviewSvg(model))
  return {
    image,
    blockCount: model.blockCount,
    width: model.width,
    height: model.height,
    generatedAt: new Date().toISOString(),
  }
}

/** Fallback card when the file has no embedded preview yet. */
export function placeholderPreview(name: string, blockCount = 0): ProjectPreview {
  const model: PreviewModel = {
    name,
    blockCount,
    blocks: [],
    width: PREVIEW_WIDTH,
    height: PREVIEW_HEIGHT,
  }
  return {
    image: previewDataUri(renderPreviewSvg(model)),
    blockCount,
    width: PREVIEW_WIDTH,
    height: PREVIEW_HEIGHT,
    generatedAt: new Date().toISOString(),
  }
}
