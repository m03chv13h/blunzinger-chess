import type { OAuthProvider } from '../services/authService';
import { BlutwurstIcon } from './BlutwurstIcon';
import { ProviderIcon } from './ProviderIcons';
import './WelcomeScreen.css';

interface WelcomeScreenProps {
  /** OAuth providers currently available from the backend. */
  availableProviders: OAuthProvider[];
  /** Whether an auth operation is in progress. */
  loading: boolean;
  /** Last auth error message, or null. */
  error: string | null;
  /** Start an OAuth login flow. */
  onLoginWithProvider: (provider: OAuthProvider) => void;
  /** Continue without an account (local play). */
  onContinueAsGuest: () => void;
}

export function WelcomeScreen({
  availableProviders,
  loading,
  error,
  onLoginWithProvider,
  onContinueAsGuest,
}: WelcomeScreenProps) {
  return (
    <div className="welcome-screen">
      <div className="welcome-card">
        <h1><BlutwurstIcon /> Blunziger Chess</h1>
        <p className="welcome-subtitle">
          A chess variant where every check counts.
        </p>

        {/* OAuth providers */}
        {availableProviders.length > 0 && (
          <div className="welcome-section">
            <p className="welcome-section-title">Sign in to play online</p>
            {availableProviders.map((provider) => (
              <button
                key={provider}
                className="welcome-btn"
                onClick={() => onLoginWithProvider(provider)}
                disabled={loading}
              >
                <ProviderIcon provider={provider} /> Sign in with {provider}
              </button>
            ))}
          </div>
        )}

        {availableProviders.length > 0 && (
          <div className="welcome-divider">or</div>
        )}

        {/* Guest / local play */}
        <div className="welcome-section">
          <button
            className="welcome-btn welcome-btn--guest"
            onClick={onContinueAsGuest}
            disabled={loading}
          >
            ▶ Continue as Guest
          </button>
        </div>

        {loading && <p className="welcome-loading">Signing in…</p>}
        {error && <p className="welcome-error">{error}</p>}
      </div>
    </div>
  );
}
