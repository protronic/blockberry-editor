import {couchDbUrl} from './config.ts';
import {getAccessToken} from './auth.ts';

export type ProjectFile = {
  format: 'blockberry';
  version: 1;
  name: string;
  savedAt: string;
  workspace: object;
};

export type CloudProjectDoc = ProjectFile & {
  _id: string;
  _rev?: string;
  type: 'blockberry-project';
  owner?: string;
};

type AllDocsResponse = {
  rows: Array<{
    id: string;
    doc?: CloudProjectDoc & {error?: string};
  }>;
};

async function couchFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(couchDbUrl(path), {...init, headers});
  return response;
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
  const data = await readJson<AllDocsResponse>(response);
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
