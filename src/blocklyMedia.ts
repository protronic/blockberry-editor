/**
 * Resolve the Blockly media folder shipped next to the built `js/` chunks
 * (`dist/web/media`). Uses runtime URL rewriting so Vite does not try to
 * bundle the directory as a static asset import.
 */
export function blocklyMediaUrl(): string {
  return import.meta.url.replace(/\/js\/[^/?#]+(?:[?#].*)?$/, '/media/');
}
