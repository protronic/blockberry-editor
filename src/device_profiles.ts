/**
 * Device profiles: loaded exclusively from CouchDB at runtime.
 */

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

/** Active profile list (empty until CouchDB load). */
export const deviceProfiles: DeviceProfile[] = [];

export function getDeviceProfile(id: string | null | undefined): DeviceProfile | undefined {
  if (!id) return undefined;
  return deviceProfiles.find((profile) => profile.id === id);
}

/** Replaces the in-memory profile list (after loading from CouchDB). */
export function setDeviceProfiles(profiles: DeviceProfile[]): void {
  deviceProfiles.splice(0, deviceProfiles.length, ...profiles);
}
