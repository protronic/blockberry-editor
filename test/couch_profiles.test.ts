import {describe, expect, it} from 'vitest';
import {deviceProfilesFromCouchRows} from '../web/couch';

const picoBlocks = [
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
];

describe('deviceProfilesFromCouchRows', () => {
  it('accepts the live CouchDB pico_telemetry_v1 document', () => {
    const profiles = deviceProfilesFromCouchRows([
      {
        id: 'pico_telemetry_v1',
        key: 'pico_telemetry_v1',
        doc: {
          _id: 'pico_telemetry_v1',
          _rev: '1-1f46f3d45969054fdffdf5be94bbc11a',
          name: 'Pico Telemetry',
          version: 'v1',
          description:
            'BMx280-Sensor, Mini-SPS, Eskalation, Signale, ThingsBoard-Telemetrie und Debug.',
          blocks: picoBlocks,
          channels: {
            inputs: ['LED0', 'BOOTSEL'],
            outputs: ['LED0'],
          },
        },
      },
    ]);
    expect(profiles).toHaveLength(1);
    expect(profiles[0]).toMatchObject({
      id: 'pico_telemetry_v1',
      name: 'Pico Telemetry',
      blocks: picoBlocks,
      channels: {inputs: ['LED0', 'BOOTSEL'], outputs: ['LED0']},
    });
  });

  it('accepts seed-style docs with format/type markers', () => {
    const profiles = deviceProfilesFromCouchRows([
      {
        id: 'profile:pico_telemetry',
        doc: {
          _id: 'profile:pico_telemetry',
          type: 'blockberry-device-profile',
          format: 'blockberry-device-profile',
          version: 1,
          id: 'pico_telemetry',
          name: 'Pico Telemetry',
          blocks: ['sensor_temp'],
        },
      },
    ]);
    expect(profiles[0]?.id).toBe('pico_telemetry');
  });

  it('expands catalog documents with nested profiles', () => {
    const profiles = deviceProfilesFromCouchRows([
      {
        id: 'catalog',
        doc: {
          _id: 'catalog',
          format: 'blockberry-device-profiles',
          profiles: [
            {id: 'pico_telemetry', name: 'Pico Telemetry', blocks: ['sensor_temp']},
            {id: 'other', name: 'Other', blocks: ['log_print']},
          ],
        },
      },
    ]);
    expect(profiles.map((profile) => profile.id).sort()).toEqual([
      'other',
      'pico_telemetry',
    ]);
  });

  it('skips design docs and project documents', () => {
    const profiles = deviceProfilesFromCouchRows([
      {id: '_design/auth', doc: {_id: '_design/auth', views: {}}},
      {
        id: 'project:x',
        doc: {
          _id: 'project:x',
          format: 'blockberry',
          version: 1,
          name: 'X',
          workspace: {},
        },
      },
    ]);
    expect(profiles).toEqual([]);
  });
});
