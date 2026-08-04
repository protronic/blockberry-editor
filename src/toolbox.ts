import type * as Blockly from 'blockly/core';
import {getDeviceProfile} from './device_profiles.js';

type ToolboxItem = Blockly.utils.toolbox.ToolboxItemInfo;
type ToolboxCategory = Blockly.utils.toolbox.StaticCategoryInfo;

/** Core language categories are always available. */
const CORE_CATEGORY_NAMES = new Set(['Logik', 'Mathematik', 'Text', 'Variablen']);

/** Default toolbox focused on small PLC-style IoT workflows. */
export const blockBerryToolbox: Blockly.utils.toolbox.ToolboxDefinition = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category',
      name: 'Mini-SPS',
      colour: '210',
      contents: [
        {kind: 'block', type: 'mini_sps_task'},
        {kind: 'block', type: 'sps_wait_ms'},
        {kind: 'block', type: 'sps_digital_input'},
        {kind: 'block', type: 'sps_digital_output'},
      ],
    },
    {
      kind: 'category',
      name: 'Sensoren',
      colour: '120',
      contents: [
        {kind: 'block', type: 'sensor_ready'},
        {kind: 'block', type: 'sensor_temp'},
        {kind: 'block', type: 'sensor_pressure'},
        {kind: 'block', type: 'sensor_humidity'},
      ],
    },
    {
      kind: 'category',
      name: 'Eskalation',
      colour: '15',
      contents: [{kind: 'block', type: 'escalation_rule'}],
    },
    {
      kind: 'category',
      name: 'Signale & Monitoring',
      colour: '45',
      contents: [
        {kind: 'block', type: 'signal_set'},
        {kind: 'block', type: 'monitor_value'},
      ],
    },
    {
      kind: 'category',
      name: 'ThingsBoard',
      colour: '185',
      contents: [
        {kind: 'block', type: 'thingsboard_telemetry'},
        {kind: 'block', type: 'thingsboard_attribute'},
        {kind: 'block', type: 'thingsboard_alarm_create'},
        {kind: 'block', type: 'thingsboard_alarm_clear'},
        {kind: 'block', type: 'thingsboard_connected'},
      ],
    },
    {
      kind: 'category',
      name: 'OD & CANopen',
      colour: '285',
      contents: [
        {kind: 'block', type: 'od_read'},
        {kind: 'block', type: 'od_write'},
        {kind: 'block', type: 'canopen_sdo_read'},
        {kind: 'block', type: 'canopen_sdo_write'},
        {kind: 'block', type: 'canopen_nmt'},
      ],
    },
    {
      kind: 'category',
      name: 'Sichere Anzeige',
      colour: '330',
      contents: [
        {kind: 'block', type: 'lvgl_set_text'},
        {kind: 'block', type: 'lvgl_set_visible'},
        {kind: 'block', type: 'lvgl_set_color'},
      ],
    },
    {
      kind: 'category',
      name: 'Debug',
      colour: '65',
      contents: [{kind: 'block', type: 'log_print'}],
    },
    {
      kind: 'category',
      name: 'Logik',
      categorystyle: 'logic_category',
      contents: [
        {kind: 'block', type: 'controls_if'},
        {kind: 'block', type: 'controls_whileUntil'},
        {kind: 'block', type: 'logic_compare'},
        {kind: 'block', type: 'logic_operation'},
        {kind: 'block', type: 'logic_negate'},
        {kind: 'block', type: 'logic_boolean'},
        {kind: 'block', type: 'logic_null'},
      ],
    },
    {
      kind: 'category',
      name: 'Mathematik',
      categorystyle: 'math_category',
      contents: [
        {kind: 'block', type: 'math_number'},
        {kind: 'block', type: 'math_arithmetic'},
        {kind: 'block', type: 'math_change'},
      ],
    },
    {
      kind: 'category',
      name: 'Text',
      categorystyle: 'text_category',
      contents: [{kind: 'block', type: 'text'}],
    },
    {
      kind: 'category',
      name: 'Variablen',
      categorystyle: 'variable_category',
      custom: 'VARIABLE',
    },
  ],
};

function isCategory(item: ToolboxItem): item is ToolboxCategory {
  return Boolean(item && typeof item === 'object' && 'kind' in item && item.kind === 'category');
}

function blockType(item: ToolboxItem): string | undefined {
  if (item && typeof item === 'object' && 'kind' in item && item.kind === 'block' && 'type' in item) {
    return String((item as {type: string}).type);
  }
  return undefined;
}

/**
 * Returns the full toolbox, or a filtered copy for the given device profile id.
 * Unknown / empty profile id → unfiltered toolbox. Core categories always remain.
 */
export function toolboxForProfile(
  profileId?: string | null,
): Blockly.utils.toolbox.ToolboxDefinition {
  const profile = getDeviceProfile(profileId ?? undefined);
  if (!profile) return blockBerryToolbox;

  const allowed = new Set(profile.blocks);
  const source = blockBerryToolbox as Blockly.utils.toolbox.ToolboxInfo;
  const contents: ToolboxItem[] = [];

  for (const item of source.contents ?? []) {
    if (!isCategory(item)) {
      contents.push(item);
      continue;
    }

    if (CORE_CATEGORY_NAMES.has(item.name ?? '')) {
      contents.push(item);
      continue;
    }

    const childItems = item.contents ?? [];
    const filtered = childItems.filter((child) => {
      const type = blockType(child);
      return type !== undefined && allowed.has(type);
    });

    if (filtered.length === 0) continue;
    contents.push({...item, contents: filtered});
  }

  return {kind: 'categoryToolbox', contents};
}
