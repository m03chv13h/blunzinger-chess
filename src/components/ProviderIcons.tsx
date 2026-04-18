import type { ReactNode } from 'react';
import type { OAuthProvider } from '../services/authService';

/** Google "G" logo. */
function GoogleIcon() {
  return (
    <svg width="1em" height="1em" viewBox="0 0 48 48" aria-hidden="true" className="provider-icon">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.01 24.01 0 0 0 0 21.56l7.98-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/** GitHub octocat mark. */
function GitHubIcon() {
  return (
    <svg width="1em" height="1em" viewBox="0 0 98 96" aria-hidden="true" className="provider-icon">
      <path
        fill="currentColor"
        d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362l-.08-8.298c-13.587 2.973-16.42-6.622-16.42-6.622-2.21-5.651-5.396-7.154-5.396-7.154-4.413-3.029.335-2.966.335-2.966 4.882.345 7.449 5.047 7.449 5.047 4.334 7.476 11.37 5.316 14.142 4.066.436-3.163 1.695-5.318 3.084-6.54-10.844-1.233-22.237-5.45-22.237-24.283 0-5.365 1.909-9.75 5.041-13.182-.506-1.234-2.185-6.238.48-13.003 0 0 4.109-1.323 13.462 5.035A46.7 46.7 0 0 1 49 23.845a46.58 46.58 0 0 1 12.464 1.691c9.344-6.358 13.441-5.035 13.441-5.035 2.67 6.765.992 11.77.485 13.003 3.14 3.433 5.036 7.817 5.036 13.182 0 18.88-11.414 23.032-22.287 24.24 1.754 1.52 3.317 4.515 3.317 9.098l-.06 13.489c0 1.311.876 2.873 3.351 2.387C84.02 89.37 98 70.96 98 49.217 98 22 76.078 0 48.854 0z"
      />
    </svg>
  );
}

/** Discord clyde logo. */
function DiscordIcon() {
  return (
    <svg width="1em" height="1em" viewBox="0 0 127.14 96.36" aria-hidden="true" className="provider-icon">
      <path
        fill="#5865F2"
        d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0a105.89 105.89 0 0 0-26.25 8.09C2.79 32.65-1.71 56.6.54 80.21a105.73 105.73 0 0 0 32.17 16.15 77.7 77.7 0 0 0 6.89-11.11 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2.03a75.32 75.32 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2.03a68.68 68.68 0 0 1-10.87 5.19 77.32 77.32 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15zM42.45 65.69C36.18 65.69 31 60 31 53.05s5-12.68 11.45-12.68S54 46.05 53.89 53.05s-5.05 12.64-11.44 12.64zm42.24 0C78.41 65.69 73.25 60 73.25 53.05s5-12.68 11.44-12.68S96.23 46.05 96.12 53.05s-5.04 12.64-11.43 12.64z"
      />
    </svg>
  );
}

/** Microsoft four-square logo. */
function MicrosoftIcon() {
  return (
    <svg width="1em" height="1em" viewBox="0 0 23 23" aria-hidden="true" className="provider-icon">
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
      <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}

const PROVIDER_ICONS: Record<OAuthProvider, () => ReactNode> = {
  Google: GoogleIcon,
  GitHub: GitHubIcon,
  Discord: DiscordIcon,
  Microsoft: MicrosoftIcon,
};

/** Render the brand icon for an OAuth provider. */
export function ProviderIcon({ provider }: { provider: OAuthProvider }) {
  const Icon = PROVIDER_ICONS[provider];
  return <Icon />;
}
