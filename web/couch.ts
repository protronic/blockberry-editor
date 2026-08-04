import {appConfig, couchDbUrl} from './config.ts';
import type {DeviceProfile} from '../src/device_profiles.ts';

export type ProjectFile = {
  format: 'blockberry';
  version: 1;
  name: string;
  savedAt: string;
  workspace: object;
  /** Optional device profile id (e.g. pico_telemetry). */
  deviceProfile?: string;
};

export type CloudProjectDoc = ProjectFile & {
  _id: string;
  _rev?: string;
  type: 'blockberry-project';
  owner?: string;
};

/** One device profile document in the profiles CouchDB. */
export type CloudProfileDoc = DeviceProfile & {
  _id: string;
  _rev?: string;
  type?: 'blockberry-device-profile' | string;
  format?: 'blockberry-device-profile' | string;
  version?: number | string;
};

type AllDocsResponse<T> = {
  rows: Array<{
    id: string;
    doc?: T & {error?: string};
  }>;
};

type LooseDoc = Record<string, unknown> & {
  _id?: string;
  error?: string;
  format?: unknown;
  type?: unknown;
  version?: unknown;
  id?: unknown;
  name?: unknown;
  description?: unknown;
  blocks?: unknown;
  workspace?: unknown;
  channels?: DeviceProfile['channels'];
  profiles?: unknown;
};

function profileIdFromDoc(doc: LooseDoc): string | undefined {
  if (typeof doc.id === 'string' && doc.id.trim()) return doc.id.trim();
  const couchId = typeof doc._id === 'string' ? doc._id : '';
  if (couchId.startsWith('profile:')) return couchId.slice('profile:'.length);
  if (couchId && !couchId.startsWith('_')) return couchId;
  return undefined;
}

function isProfileCatalogMarker(doc: LooseDoc): boolean {
  return (
    doc.format === 'blockberry-device-profiles' ||
    doc.type === 'blockberry-device-profiles'
  );
}

function looksLikeProjectDoc(doc: LooseDoc): boolean {
  return (
    doc.format === 'blockberry' ||
    doc.type === 'blockberry-project' ||
    (doc.workspace !== undefined && typeof doc.workspace === 'object')
  );
}

function asDeviceProfile(doc: LooseDoc): DeviceProfile | undefined {
  const id = profileIdFromDoc(doc);
  if (
    !id ||
    typeof doc.name !== 'string' ||
    !doc.name.trim() ||
    !Array.isArray(doc.blocks) ||
    !doc.blocks.every((block) => typeof block === 'string')
  ) {
    return undefined;
  }
  return {
    id,
    name: doc.name.trim(),
    description: typeof doc.description === 'string' ? doc.description : undefined,
    blocks: [...(doc.blocks as string[])],
    ...(doc.channels
      ? {
          channels: {
            inputs: doc.channels.inputs ? [...doc.channels.inputs] : undefined,
            outputs: doc.channels.outputs ? [...doc.channels.outputs] : undefined,
          },
        }
      : {}),
  };
}

/**
 * Maps Couch `_all_docs` rows to device profiles.
 *
 * A profile doc needs at least `name` + `blocks[]`. Id comes from `id` or `_id`
 * (e.g. `pico_telemetry_v1`). `version` is free-form device metadata (e.g. `"v1"`).
 * Catalog docs with `profiles: [...]` are also supported.
 */
export function deviceProfilesFromCouchRows(
  rows: Array<{id?: string; doc?: unknown}>,
): DeviceProfile[] {
  const profiles: DeviceProfile[] = [];
  const seen = new Set<string>();

  const push = (profile: DeviceProfile | undefined, sourceId: string) => {
    if (!profile) {
      console.warn(`Couch profile row "${sourceId}" skipped (missing id/name/blocks)`);
      return;
    }
    if (seen.has(profile.id)) return;
    seen.add(profile.id);
    profiles.push(profile);
  };

  for (const row of rows) {
    const doc = row.doc as LooseDoc | undefined;
    const sourceId = String(row.id ?? doc?._id ?? '(unknown)');
    if (!doc || typeof doc !== 'object' || doc.error) continue;
    if (sourceId.startsWith('_design/')) continue;
    if (looksLikeProjectDoc(doc)) continue;

    if (isProfileCatalogMarker(doc) && Array.isArray(doc.profiles)) {
      for (const entry of doc.profiles) {
        if (!entry || typeof entry !== 'object') continue;
        push(asDeviceProfile(entry as LooseDoc), `${sourceId}/profiles`);
      }
      continue;
    }

    if (typeof doc.name === 'string' && Array.isArray(doc.blocks)) {
      push(asDeviceProfile(doc), sourceId);
      continue;
    }

    console.warn(
      `Couch doc "${sourceId}" skipped (need name + blocks[]; got keys: ${Object.keys(doc).join(', ')})`,
    );
  }

  return profiles.sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

/** Supplies the Bearer token for CouchDB (Keycloak or OpenCloud host token). */
export type CouchAccessTokenProvider = () => Promise<string>;

let accessTokenProvider: CouchAccessTokenProvider | null = null;

/** Registers how CouchDB requests obtain an access token. Call once at app start. */
export function configureCouchAuth(provider: CouchAccessTokenProvider): void {
  accessTokenProvider = provider;
}

async function couchFetch(
  path: string,
  init: RequestInit = {},
  db = appConfig.couchDb,
): Promise<Response> {
  if (!accessTokenProvider) {
    throw new Error('Couch-Auth nicht konfiguriert (configureCouchAuth fehlt)');
  }
  const token = await accessTokenProvider();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(couchDbUrl(path, db), {...init, headers});
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  let data: unknown = undefined;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    /* ignore */
  }
  if (!response.ok) {
    const reason =
      data && typeof data === 'object' && 'reason' in data
        ? String((data as {reason: unknown}).reason)
        : text || response.statusText;
    throw new Error(`CouchDB HTTP ${response.status}: ${reason}`);
  }
  return data as T;
}

export function toDeviceProfile(doc: CloudProfileDoc): DeviceProfile {
  const profile = asDeviceProfile(doc as LooseDoc);
  if (!profile) {
    throw new Error(`Ungültiges Geräteprofil-Dokument: ${doc._id ?? doc.id}`);
  }
  return profile;
}

export function projectDocId(name: string, existingId?: string): string {
  if (existingId?.startsWith('project:')) return existingId;
  const slug = name
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `project:${slug || 'unbenannt'}-${Date.now().toString(36)}`;
}

export async function listCloudProjects(): Promise<CloudProjectDoc[]> {
  const response = await couchFetch('_all_docs?include_docs=true');
  const data = await readJson<AllDocsResponse<CloudProjectDoc>>(response);
  return data.rows
    .map((row) => row.doc)
    .filter((doc): doc is CloudProjectDoc =>
      Boolean(
        doc &&
          !('error' in doc && doc.error) &&
          doc.format === 'blockberry' &&
          doc.version === 1 &&
          doc.workspace,
      ),
    )
    .sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
}

export async function loadCloudProject(id: string): Promise<CloudProjectDoc> {
  const response = await couchFetch(encodeURIComponent(id));
  return readJson<CloudProjectDoc>(response);
}

export async function saveCloudProject(
  project: ProjectFile,
  options: {id?: string; rev?: string; owner?: string} = {},
): Promise<CloudProjectDoc> {
  const id = projectDocId(project.name, options.id);
  const doc: CloudProjectDoc = {
    ...project,
    _id: id,
    type: 'blockberry-project',
  };
  if (options.rev) doc._rev = options.rev;
  if (options.owner) doc.owner = options.owner;

  const response = await couchFetch(encodeURIComponent(id), {
    method: 'PUT',
    body: JSON.stringify(doc),
  });
  const result = await readJson<{ok: boolean; id: string; rev: string}>(response);
  return {...doc, _id: result.id, _rev: result.rev};
}

/** Loads device profiles from the profiles CouchDB (requires login). */
export async function listCloudProfiles(): Promise<DeviceProfile[]> {
  const response = await couchFetch(
    '_all_docs?include_docs=true',
    {},
    appConfig.couchProfilesDb,
  );
  const data = await readJson<AllDocsResponse<CloudProfileDoc>>(response);
  const profiles = deviceProfilesFromCouchRows(data.rows ?? []);
  if (!profiles.length) {
    console.warn(
      `Keine Geräteprofile in CouchDB "${appConfig.couchProfilesDb}" ` +
        `(${data.rows?.length ?? 0} Docs). Erwartet Docs mit name + blocks[].`,
    );
  }
  return profiles;
}
