import {describe, expect, it} from 'bun:test';
import {toolboxForProfile} from '../src/toolbox.js';

type Category = {
  kind?: string;
  name?: string;
  contents?: Array<{kind?: string; type?: string; custom?: string}>;
};

function categories(profileId: string | null): Category[] {
  const toolbox = toolboxForProfile(profileId);
  return (toolbox.contents ?? []) as Category[];
}

function domainBlockTypes(profileId: string | null): string[] {
  return categories(profileId)
    .filter((category) => !['Logik', 'Mathematik', 'Text', 'Variablen'].includes(category.name ?? ''))
    .flatMap((category) =>
      (category.contents ?? [])
        .filter((item) => item.kind === 'block' && item.type)
        .map((item) => item.type as string),
    );
}

describe('toolboxForProfile', () => {
  it('returns the full toolbox when no profile is selected', () => {
    const types = domainBlockTypes(null);
    expect(types).toContain('canopen_nmt');
    expect(types).toContain('lvgl_set_text');
    expect(types).toContain('thingsboard_alarm_create');
    expect(types).toContain('sensor_temp');
  });

  it('filters to pico_telemetry blocks and keeps core categories', () => {
    const cats = categories('pico_telemetry');
    const names = cats.map((category) => category.name);
    expect(names).toContain('Mini-SPS');
    expect(names).toContain('Sensoren');
    expect(names).toContain('ThingsBoard');
    expect(names).toContain('Debug');
    expect(names).toContain('Logik');
    expect(names).not.toContain('OD & CANopen');
    expect(names).not.toContain('Sichere Anzeige');

    const types = domainBlockTypes('pico_telemetry');
    expect(types).toContain('sensor_humidity');
    expect(types).toContain('thingsboard_telemetry');
    expect(types).toContain('thingsboard_connected');
    expect(types).not.toContain('thingsboard_alarm_create');
    expect(types).not.toContain('od_read');
  });
});
