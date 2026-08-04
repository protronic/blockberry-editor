/** BlockBerry visual identity shared by editor, file icons and previews. */

export const BRAND = {
  id: 'blockberry-editor',
  name: 'BlockBerry',
  color: '#d63b65',
  colorSoft: '#ef6689',
  mint: '#80e6bc',
  ink: '#17211d',
  dark: '#111a17',
  paper: '#f7f8f6',
  line: '#d6dcd8',
  icon: 'puzzle-2',
  mimeType: 'application/x-bbprj',
  extension: 'bbprj',
} as const

/** Compact app/file mark used as `appInfo.img` (data URI, MF-safe). */
export const BRAND_MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="BlockBerry">
  <rect width="64" height="64" rx="16" fill="${BRAND.dark}"/>
  <g transform="translate(14 16) rotate(-4 18 16)">
    <rect x="0" y="0" width="16" height="16" rx="4" fill="${BRAND.color}"/>
    <rect x="20" y="0" width="16" height="16" rx="4" fill="${BRAND.colorSoft}"/>
    <rect x="6" y="20" width="24" height="16" rx="4" fill="${BRAND.mint}"/>
  </g>
</svg>`

export const BRAND_MARK_DATA_URI = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(BRAND_MARK_SVG)}`

export function blockColorForType(type: string): string {
  if (type.startsWith('mini_sps') || type.startsWith('sps_')) return '#4f8cff'
  if (type.startsWith('sensor_')) return '#3ecf8e'
  if (type.startsWith('escalation') || type.startsWith('signal_')) return BRAND.color
  if (type.startsWith('lvgl_') || type.startsWith('ui_')) return '#a78bfa'
  if (type.startsWith('od_') || type.startsWith('canopen_')) return '#f59e0b'
  if (type.startsWith('tb_') || type.startsWith('thingsboard')) return '#14b8a6'
  if (type.startsWith('logic_') || type.startsWith('math_') || type.startsWith('text')) {
    return '#64748b'
  }
  return BRAND.colorSoft
}
