/**
 * Device profiles: bundled JSON as fallback, optionally replaced from CouchDB.
 */

import profilesFile from './device_profiles.json' with {type: 'json'};

export type DeviceProfile = {
  id: string;
  name: string;
  description?: string;
  /** Domain Blockly block types shown in the toolbox. */
  blocks: string[];
  channels?: {
    inputs?: string[];
    outputs?: string[];
  };
};

type DeviceProfilesFile = {
  format: 'blockberry-device-profiles';
  version: number;
  profiles: DeviceProfile[];
};

const catalog = profilesFile as DeviceProfilesFile;

/** Active profile list (starts as bundled fallback; may be replaced from CouchDB). */
export const deviceProfiles: DeviceProfile[] = [...catalog.profiles];

export function getDeviceProfile(id: string | null | undefined): DeviceProfile | undefined {
  if (!id) return undefined;
  return deviceProfiles.find((profile) => profile.id === id);
}

/** Replaces the in-memory profile list (e.g. after loading from CouchDB). */
export function setDeviceProfiles(profiles: DeviceProfile[]): void {
  deviceProfiles.splice(0, deviceProfiles.length, ...profiles);
}

export function bundledDeviceProfiles(): DeviceProfile[] {
  return [...catalog.profiles];
}
