/** Runtime config for the web editor (Vite env with Protronic defaults). */

function required(name: string, fallback: string): string {
  const value = (import.meta.env[name] as string | undefined)?.trim();
  return value || fallback;
}

export const appConfig = {
  keycloakUrl: required('VITE_KEYCLOAK_URL', 'https://keycloak.protronic-gmbh.de'),
  keycloakRealm: required('VITE_KEYCLOAK_REALM', 'openCloud'),
  keycloakClientId: required(
    'VITE_KEYCLOAK_CLIENT_ID',
    'blockberry-editor-client',
  ),
  couchUrl: required(
    'VITE_COUCH_URL',
    'https://couch.protronic-gmbh.de/couchdb',
  ).replace(/\/$/, ''),
  couchDb: required('VITE_COUCH_DB', 'blockberry-projects'),
  couchProfilesDb: required('VITE_COUCH_PROFILES_DB', 'bockberry-profiles'),
};

export function couchDbUrl(path = '', db = appConfig.couchDb): string {
  const base = `${appConfig.couchUrl}/${db}`;
  if (!path) return base;
  return `${base}/${path.replace(/^\//, '')}`;
}
