import {describe, expect, it} from 'vitest';
import {BRAND, blockColorForType} from '../src/brand.js';
import {
  buildPreviewModel,
  placeholderPreview,
  previewDataUri,
  renderPreviewSvg,
} from '../src/preview.js';
import {
  isProjectFile,
  parseProject,
  projectSignature,
  serializeProject,
  stripKnownProjectExtension,
} from '../src/project.js';

describe('brand', () => {
  it('keeps the berry identity stable', () => {
    expect(BRAND.extension).toBe('bbprj');
    expect(BRAND.color).toBe('#d63b65');
    expect(blockColorForType('escalation_rule')).toBe(BRAND.color);
    expect(blockColorForType('mini_sps_task')).toMatch(/^#/);
  });
});

describe('project', () => {
  it('parses and serializes bbprj payloads with optional preview', () => {
    const project = {
      format: 'blockberry' as const,
      version: 1 as const,
      name: 'Kühlung',
      savedAt: '2026-08-04T10:00:00.000Z',
      workspace: {blocks: {languageVersion: 0, blocks: []}},
      preview: {
        image: 'data:image/svg+xml;charset=utf-8,test',
        blockCount: 3,
        width: 640,
        height: 360,
        generatedAt: '2026-08-04T10:00:00.000Z',
      },
    };

    const serialized = serializeProject(project);
    expect(serialized).toContain('"format": "blockberry"');
    expect(parseProject(serialized)).toEqual(project);
    expect(isProjectFile(project)).toBe(true);
    expect(projectSignature(project)).toContain('Kühlung');
  });

  it('strips known extensions from resource names', () => {
    expect(stripKnownProjectExtension('Anlage.bbprj')).toBe('Anlage');
    expect(stripKnownProjectExtension('alt.blockberry.json')).toBe('alt');
  });
});

describe('preview', () => {
  it('renders a branded silhouette card', () => {
    const svg = renderPreviewSvg({
      name: 'Escalation Demo',
      blockCount: 2,
      width: 640,
      height: 360,
      blocks: [
        {type: 'mini_sps_task', x: 40, y: 40, width: 180, height: 90},
        {type: 'escalation_rule', x: 80, y: 160, width: 220, height: 70},
      ],
    });

    expect(svg).toContain('Escalation Demo');
    expect(svg).toContain('2 Blöcke');
    expect(svg).toContain(BRAND.color);
    expect(svg).toContain('<rect');
    expect(previewDataUri(svg)).toMatch(/^data:image\/svg\+xml/);
  });

  it('builds a model from a headless-like block list via placeholder', () => {
    const placeholder = placeholderPreview('Leer', 0);
    expect(placeholder.blockCount).toBe(0);
    expect(placeholder.image).toContain('data:image/svg+xml');
    expect(placeholder.width).toBe(640);
  });

  it('keeps empty workspaces usable in buildPreviewModel shape', () => {
    const model = buildPreviewModel(
      {
        getAllBlocks: () => [],
      } as never,
      'Test',
    );
    expect(model.blocks).toEqual([]);
    expect(model.blockCount).toBe(0);
  });
});
