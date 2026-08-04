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
  type: 'blockberry-device-profile';
  format: 'blockberry-device-profile';
  version: 1;
};

type AllDocsResponse<T> = {
  rows: Array<{
    id: string;
    doc?: T & {error?: string};
  }>;
};

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

function isProfileDoc(doc: unknown): doc is CloudProfileDoc {
  if (!doc || typeof doc !== 'object') return false;
  const candidate = doc as Partial<CloudProfileDoc> & {error?: string};
  return Boolean(
    !candidate.error &&
      candidate.format === 'blockberry-device-profile' &&
      candidate.version === 1 &&
      typeof candidate.id === 'string' &&
      typeof candidate.name === 'string' &&
      Array.isArray(candidate.blocks),
  );
}

export function toDeviceProfile(doc: CloudProfileDoc): DeviceProfile {
  return {
    id: doc.id,
    name: doc.name,
    description: doc.description,
    blocks: [...doc.blocks],
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
  return data.rows
    .map((row) => row.doc)
    .filter(isProfileDoc)
    .map(toDeviceProfile)
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}
