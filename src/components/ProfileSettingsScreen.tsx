import { useState, useCallback } from 'react';
import type { UseUserProfile } from '../hooks/useUserProfile';
import { AVATAR_PRESETS } from './avatarPresets';
import './ProfileSettingsScreen.css';

interface ProfileSettingsScreenProps {
  userProfile: UseUserProfile;
}

export function ProfileSettingsScreen({ userProfile }: ProfileSettingsScreenProps) {
  const { profile, loading, error } = userProfile;

  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [nameEdited, setNameEdited] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [avatarSaved, setAvatarSaved] = useState(false);

  // Sync display name when profile loads for the first time.
  const [syncedId, setSyncedId] = useState<string | null>(null);
  if (profile && profile.id !== syncedId) {
    setSyncedId(profile.id);
    setDisplayName(profile.displayName);
    setNameEdited(false);
  }

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplayName(e.target.value);
    setNameEdited(true);
    setNameSaved(false);
  }, []);

  const handleSaveName = useCallback(async () => {
    const trimmed = displayName.trim();
    if (!trimmed) return;
    await userProfile.updateDisplayName(trimmed);
    setNameEdited(false);
    setNameSaved(true);
  }, [displayName, userProfile]);

  const handleSelectAvatar = useCallback(async (avatarId: string) => {
    await userProfile.updateAvatarUrl(avatarId);
    setAvatarSaved(true);
    setTimeout(() => setAvatarSaved(false), 2000);
  }, [userProfile]);

  const currentAvatar = AVATAR_PRESETS.find(a => a.id === profile?.avatarUrl);

  return (
    <div className="profile-screen">
      <div className="profile-card">
        <h2>👤 Profile Settings</h2>
        <p className="profile-subtitle">Customize your display name and avatar.</p>

        {error && <p className="profile-error">{error}</p>}

        {/* ── Display Name ──────────────────────────────────────── */}
        <div className="profile-section">
          <h3>Display Name</h3>
          <div className="profile-name-row">
            <input
              className="profile-name-input"
              type="text"
              value={displayName}
              onChange={handleNameChange}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); }}
              maxLength={100}
              placeholder="Enter display name"
              aria-label="Display name"
              disabled={loading}
            />
            <button
              className="profile-save-btn"
              onClick={handleSaveName}
              disabled={loading || !nameEdited || !displayName.trim()}
            >
              {loading ? 'Saving…' : 'Save'}
            </button>
          </div>
          {nameSaved && !nameEdited && (
            <p className="profile-success">✓ Display name updated</p>
          )}
        </div>

        {/* ── Avatar Picker ─────────────────────────────────────── */}
        <div className="profile-section">
          <h3>Profile Picture</h3>
          <p className="profile-avatar-hint">Choose your sausage avatar:</p>

          {currentAvatar && (
            <div className="profile-current-avatar">
              <span className="profile-current-avatar-emoji">{currentAvatar.emoji}</span>
              <span className="profile-current-avatar-label">Current: {currentAvatar.label}</span>
            </div>
          )}

          <div className="profile-avatar-grid" role="radiogroup" aria-label="Avatar selection">
            {AVATAR_PRESETS.map((preset) => (
              <button
                key={preset.id}
                className={`profile-avatar-option ${profile?.avatarUrl === preset.id ? 'profile-avatar-option--selected' : ''}`}
                onClick={() => handleSelectAvatar(preset.id)}
                disabled={loading}
                aria-label={preset.label}
                aria-checked={profile?.avatarUrl === preset.id}
                role="radio"
                title={preset.label}
              >
                <span className="profile-avatar-emoji">{preset.emoji}</span>
                <span className="profile-avatar-label">{preset.label}</span>
              </button>
            ))}
          </div>
          {avatarSaved && (
            <p className="profile-success">✓ Avatar updated</p>
          )}
        </div>
      </div>
    </div>
  );
}
