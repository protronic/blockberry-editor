import type {Block, Workspace} from 'blockly/core';
import * as Blockly from 'blockly/core';
import {getDeviceProfile, type DeviceProfile} from './device_profiles.js';

let activeProfileId: string | null = null;

/** Sets the active device profile (drives SPS channel field widgets). */
export function setActiveDeviceProfile(profileId: string | null | undefined): void {
  activeProfileId = profileId?.trim() ? profileId.trim() : null;
}

export function getActiveDeviceProfile(): DeviceProfile | undefined {
  return getDeviceProfile(activeProfileId);
}

function channelsFor(kind: 'input' | 'output'): string[] {
  const profile = getActiveDeviceProfile();
  const list = kind === 'input' ? profile?.channels?.inputs : profile?.channels?.outputs;
  return (list ?? []).map((entry) => entry.trim()).filter(Boolean);
}

function fallbackChannel(kind: 'input' | 'output'): string {
  return kind === 'input' ? 'DI1' : 'DO1';
}

function resolveChannelValue(kind: 'input' | 'output', previous: string): string {
  const channels = channelsFor(kind);
  const current = previous.trim();
  if (current) return current;
  if (channels.length > 0) return channels[0];
  return fallbackChannel(kind);
}

/**
 * CHANNEL is always a text field (free text, no window.prompt).
 * When the profile lists channels, a preset dropdown is shown beside it.
 */
export function applySpsChannelField(block: Block, kind: 'input' | 'output'): void {
  const input = block.getInput('CHANNEL_ROW');
  if (!input) return;

  const previous = String(block.getFieldValue('CHANNEL') ?? '');
  const value = resolveChannelValue(kind, previous);
  const channels = channelsFor(kind);

  Blockly.Events.disable();
  try {
    let textField = block.getField('CHANNEL');
    if (!(textField instanceof Blockly.FieldTextInput)) {
      if (textField) input.removeField('CHANNEL');
      if (block.getField('CHANNEL_PRESET')) input.removeField('CHANNEL_PRESET');
      textField = new Blockly.FieldTextInput(value);
      input.appendField(textField, 'CHANNEL');
    } else {
      textField.setValue(value);
    }

    const preset = block.getField('CHANNEL_PRESET');
    if (channels.length > 0) {
      if (preset) input.removeField('CHANNEL_PRESET');
      const keepValue = '__none__';
      const options: Array<[string, string]> = [
        ['\u00a0', keepValue],
        ...channels.map((channel) => [channel, channel] as [string, string]),
      ];
      const dropdown = new Blockly.FieldDropdown(options);
      dropdown.setValidator((selected) => {
        if (selected && selected !== keepValue) {
          block.setFieldValue(selected, 'CHANNEL');
        }
        return selected;
      });
      input.appendField(dropdown, 'CHANNEL_PRESET');
      // Empty first option: do not overwrite the text field on refresh.
      dropdown.setValue(keepValue);
    } else if (preset) {
      input.removeField('CHANNEL_PRESET');
    }
  } finally {
    Blockly.Events.enable();
  }

  if ('queueRender' in block && typeof block.queueRender === 'function') {
    block.setColour(210);
    (block as Blockly.BlockSvg).queueRender();
  }
}

/** Updates CHANNEL widgets on all SPS I/O blocks after a profile change. */
export function refreshSpsChannelFields(workspace: Workspace): void {
  for (const block of workspace.getAllBlocks(false)) {
    if (block.type === 'sps_digital_input') {
      applySpsChannelField(block, 'input');
    } else if (block.type === 'sps_digital_output') {
      applySpsChannelField(block, 'output');
    }
  }
}

let extensionsRegistered = false;

/** Registers Blockly extensions that attach profile-aware CHANNEL fields. */
export function registerSpsChannelExtensions(): void {
  if (extensionsRegistered) return;
  extensionsRegistered = true;

  Blockly.Extensions.register('bb_sps_channel_input', function (this: Block) {
    applySpsChannelField(this, 'input');
  });
  Blockly.Extensions.register('bb_sps_channel_output', function (this: Block) {
    applySpsChannelField(this, 'output');
  });
}
