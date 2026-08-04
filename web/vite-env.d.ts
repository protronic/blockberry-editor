/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_KEYCLOAK_URL?: string;
  readonly VITE_KEYCLOAK_REALM?: string;
  readonly VITE_KEYCLOAK_CLIENT_ID?: string;
  readonly VITE_COUCH_URL?: string;
  readonly VITE_COUCH_DB?: string;
  readonly VITE_COUCH_PROFILES_DB?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
