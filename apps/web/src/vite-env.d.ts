/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_USE_SEED_DIRECTLY?: string;
  readonly VITE_VWORLD_MAP_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
