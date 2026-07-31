import Keycloak from 'keycloak-js';
import {appConfig} from './config.ts';

const keycloak = new Keycloak({
  url: appConfig.keycloakUrl,
  realm: appConfig.keycloakRealm,
  clientId: appConfig.keycloakClientId,
});

let initDone = false;

/**
 * Stable redirect URI without ?code=&state= — must match Keycloak
 * "Valid redirect URIs" and be identical for login + token exchange.
 */
function redirectUri(): string {
  return new URL(import.meta.env.BASE_URL || '/', window.location.origin).href;
}

/** Initializes Keycloak (PKCE). Safe to call once at app start. */
export async function initAuth(): Promise<boolean> {
  if (initDone) return Boolean(keycloak.authenticated);
  initDone = true;
  try {
    const authenticated = await keycloak.init({
      onLoad: 'check-sso',
      pkceMethod: 'S256',
      checkLoginIframe: false,
      silentCheckSsoFallback: false,
      redirectUri: redirectUri(),
    });
    return Boolean(authenticated);
  } catch (error) {
    console.warn(
      'Keycloak init failed. Prüfe Web Origins + Redirect URIs am Client ' +
        `(erwartet Origin ${window.location.origin}, redirect ${redirectUri()}).`,
      error,
    );
    return false;
  }
}

export function isAuthenticated(): boolean {
  return Boolean(keycloak.authenticated);
}

export function currentUsername(): string {
  const profile = keycloak.tokenParsed as
    | {preferred_username?: string; email?: string; name?: string}
    | undefined;
  return (
    profile?.preferred_username ||
    profile?.email ||
    profile?.name ||
    keycloak.subject ||
    'angemeldet'
  );
}

export async function login(): Promise<void> {
  await keycloak.login({redirectUri: redirectUri()});
}

export async function logout(): Promise<void> {
  await keycloak.logout({redirectUri: redirectUri()});
}

/** Returns a fresh access token or throws if not logged in. */
export async function getAccessToken(): Promise<string> {
  if (!keycloak.authenticated) {
    throw new Error('Nicht angemeldet');
  }
  try {
    await keycloak.updateToken(30);
  } catch {
    await login();
    throw new Error('Sitzung abgelaufen — bitte erneut anmelden');
  }
  if (!keycloak.token) throw new Error('Kein Access Token verfügbar');
  return keycloak.token;
}
