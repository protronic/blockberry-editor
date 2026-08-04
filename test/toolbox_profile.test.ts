import {beforeEach, describe, expect, it} from 'vitest';
import {setDeviceProfiles} from '../src/device_profiles';
import {toolboxForProfile} from '../src/toolbox';

type Category = {
  kind?: string;
  name?: string;
  contents?: Array<{kind?: string; type?: string; custom?: string}>;
};

const PICO_TELEMETRY = {
  id: 'pico_telemetry',
  name: 'Pico Telemetry',
  blocks: [
    'mini_sps_task',
    'sps_wait_ms',
    'sps_digital_input',
    'sps_digital_output',
    'sensor_ready',
    'sensor_temp',
    'sensor_pressure',
    'sensor_humidity',
    'escalation_rule',
    'signal_set',
    'monitor_value',
    'thingsboard_telemetry',
    'thingsboard_attribute',
    'thingsboard_connected',
    'log_print',
  ],
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
  beforeEach(() => {
    setDeviceProfiles([PICO_TELEMETRY]);
  });

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

  it('keeps the full toolbox when the profile id is unknown', () => {
    setDeviceProfiles([]);
    const types = domainBlockTypes('pico_telemetry');
    expect(types).toContain('od_read');
    expect(types).toContain('canopen_nmt');
  });
});
