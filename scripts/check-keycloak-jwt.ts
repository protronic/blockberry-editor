/**
 * Prüft ein Keycloak Access Token auf CouchDB-taugliche Claims.
 *
 *   bun scripts/check-keycloak-jwt.ts <access_token>
 *   bun scripts/check-keycloak-jwt.ts --fetch
 *   bun scripts/check-keycloak-jwt.ts --fetch --print-token
 *
 * --print-token: Diagnose auf stderr, bei Erfolg nur den Token auf stdout
 *                (für Pipelines / PowerShell-Capture).
 */

type JwtPayload = {
  exp?: number;
  iat?: number;
  sub?: string;
  preferred_username?: string;
  azp?: string;
  iss?: string;
  roles?: string[];
  realm_access?: {roles?: string[]};
  _couchdb?: {roles?: string[]};
  [key: string]: unknown;
};

type JwtHeader = {
  alg?: string;
  kid?: string;
  typ?: string;
};

const ROLE = 'blockberry-editor';
/** CouchDB default roles_claim_name — Keycloak nestet Punkte als JSON-Pfad. */
const COUCH_ROLES_PATH = '_couchdb.roles';

function decodePart<T>(part: string): T {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as T;
}

function decodeToken(token: string): {header: JwtHeader; payload: JwtPayload} {
  const parts = token.trim().split('.');
  if (parts.length < 2) throw new Error('Kein gültiges JWT (erwartet header.payload.signature)');
  return {
    header: decodePart<JwtHeader>(parts[0]),
    payload: decodePart<JwtPayload>(parts[1]),
  };
}

/** Liest Claim-Pfade mit Punkten (z. B. _couchdb.roles → payload._couchdb.roles). */
function claimAt(payload: JwtPayload, path: string): unknown {
  const literal = payload[path];
  if (literal !== undefined) return literal;
  return path.split('.').reduce<unknown>((node, key) => {
    if (node && typeof node === 'object' && key in (node as object)) {
      return (node as Record<string, unknown>)[key];
    }
    return undefined;
  }, payload);
}

function asRoleList(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? (value as string[])
    : undefined;
}

function log(printToken: boolean, message: string): void {
  if (printToken) console.error(message);
  else console.log(message);
}

async function fetchToken(): Promise<string> {
  const base = process.env.KEYCLOAK_URL?.replace(/\/$/, '');
  const realm = process.env.KEYCLOAK_REALM;
  const clientId = process.env.KEYCLOAK_CLIENT_ID ?? 'blockberry-editor';
  const username = process.env.KEYCLOAK_USERNAME;
  const password = process.env.KEYCLOAK_PASSWORD;
  const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET;

  if (!base || !realm || !username || !password) {
    throw new Error(
      'Für --fetch brauchst du: KEYCLOAK_URL, KEYCLOAK_REALM, KEYCLOAK_USERNAME, KEYCLOAK_PASSWORD\n' +
        '(optional KEYCLOAK_CLIENT_ID, KEYCLOAK_CLIENT_SECRET)',
    );
  }

  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: clientId,
    username,
    password,
  });
  if (clientSecret) body.set('client_secret', clientSecret);

  const url = `${base}/realms/${realm}/protocol/openid-connect/token`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Token-Endpoint ${response.status}: ${text}`);
  }
  const data = JSON.parse(text) as {access_token?: string};
  if (!data.access_token) throw new Error('Antwort ohne access_token');
  return data.access_token;
}

function check(token: string, printToken: boolean): number {
  const {header, payload} = decodeToken(token);
  const couchRoles = asRoleList(claimAt(payload, COUCH_ROLES_PATH));
  const realmRoles =
    asRoleList(payload.realm_access?.roles) ?? asRoleList(payload.roles) ?? [];
  const realmRolesLabel = payload.realm_access?.roles ? 'realm_access.roles' : 'roles';
  const now = Math.floor(Date.now() / 1000);
  const expired = typeof payload.exp === 'number' && payload.exp < now;

  const line = (label: string, value: unknown) =>
    log(
      printToken,
      `  ${label}: ${value === undefined ? '(fehlt)' : JSON.stringify(value)}`,
    );

  log(printToken, 'Token-Claims:');
  line('kid (Header)', header.kid);
  line('alg', header.alg);
  line('iss', payload.iss);
  line('azp / client', payload.azp);
  line('sub', payload.sub);
  line('preferred_username', payload.preferred_username);
  line('exp', payload.exp);
  line(realmRolesLabel, realmRoles);
  line(`${COUCH_ROLES_PATH} (verschachtelt ok)`, couchRoles);
  log(printToken, '');

  const problems: string[] = [];
  if (expired) problems.push('Token ist abgelaufen (exp)');
  if (!couchRoles) {
    problems.push(
      `Claim "${COUCH_ROLES_PATH}" fehlt oder ist kein Array — Protocol Mapper prüfen ` +
        '(Keycloak liefert typischerweise {"_couchdb":{"roles":[...]}})',
    );
  } else if (!couchRoles.includes(ROLE)) {
    problems.push(`"${ROLE}" fehlt in ${COUCH_ROLES_PATH}: ${JSON.stringify(couchRoles)}`);
  }
  if (!realmRoles.includes(ROLE)) {
    problems.push(
      `"${ROLE}" fehlt in ${realmRolesLabel} — User/Default-Role/Group-Mapping prüfen`,
    );
  }

  if (problems.length) {
    log(printToken, 'FEHLER:');
    for (const problem of problems) log(printToken, `  - ${problem}`);
    return 1;
  }

  log(
    printToken,
    `OK: "${ROLE}" ist in ${COUCH_ROLES_PATH} vorhanden — Keycloak-Seite für CouchDB bereit.`,
  );

  if (printToken) {
    process.stdout.write(`${token.trim()}\n`);
  }
  return 0;
}

const args = process.argv.slice(2);
const fetchMode = args.includes('--fetch');
const printToken = args.includes('--print-token');
const tokenArg = args.find((arg) => !arg.startsWith('--'));

let token = tokenArg ?? process.env.KEYCLOAK_TOKEN ?? '';
if (fetchMode) {
  token = await fetchToken();
  log(printToken, 'Access Token geholt.\n');
}

if (!token) {
  console.log(`Usage:
  bun scripts/check-keycloak-jwt.ts <access_token>
  bun scripts/check-keycloak-jwt.ts --fetch
  bun scripts/check-keycloak-jwt.ts --fetch --print-token

Env für --fetch:
  KEYCLOAK_URL, KEYCLOAK_REALM, KEYCLOAK_USERNAME, KEYCLOAK_PASSWORD
  optional: KEYCLOAK_CLIENT_ID, KEYCLOAK_CLIENT_SECRET
`);
  process.exit(1);
}

process.exit(check(token, printToken));
