/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Deployment mode: `'static'` (no backend) or `'connected'` (full backend). */
  readonly VITE_DEPLOY_MODE?: string;
  /** Base URL for the backend API (connected mode only). */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
