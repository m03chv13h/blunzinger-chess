import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ProfileSettingsScreen } from '../../components/ProfileSettingsScreen';
import type { UseUserProfile } from '../../hooks/useUserProfile';
import type { UserProfileDetail } from '../../services/userService';

// ── Helpers ──────────────────────────────────────────────────────────

function makeProfile(overrides: Partial<UserProfileDetail> = {}): UserProfileDetail {
  return {
    id: 'user-1',
    displayName: 'TestPlayer',
    provider: 'guest',
    isGuest: true,
    gameCount: 5,
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeUserProfile(overrides: Partial<UseUserProfile> = {}): UseUserProfile {
  return {
    profile: makeProfile(),
    loading: false,
    error: null,
    refresh: vi.fn().mockResolvedValue(undefined),
    updateDisplayName: vi.fn().mockResolvedValue(undefined),
    updateAvatarUrl: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('ProfileSettingsScreen', () => {
  let userProfile: UseUserProfile;

  beforeEach(() => {
    userProfile = makeUserProfile();
  });

  it('renders the profile settings heading', () => {
    render(<ProfileSettingsScreen userProfile={userProfile} />);
    expect(screen.getByText(/Profile Settings/)).toBeInTheDocument();
  });

  it('shows subtitle text', () => {
    render(<ProfileSettingsScreen userProfile={userProfile} />);
    expect(screen.getByText(/Customize your display name and avatar/)).toBeInTheDocument();
  });

  it('renders display name input with current name', () => {
    render(<ProfileSettingsScreen userProfile={userProfile} />);
    const input = screen.getByLabelText('Display name') as HTMLInputElement;
    expect(input.value).toBe('TestPlayer');
  });

  it('renders save button disabled initially (no edits)', () => {
    render(<ProfileSettingsScreen userProfile={userProfile} />);
    expect(screen.getByText('Save')).toBeDisabled();
  });

  it('enables save button after editing the name', () => {
    render(<ProfileSettingsScreen userProfile={userProfile} />);
    const input = screen.getByLabelText('Display name');
    fireEvent.change(input, { target: { value: 'NewName' } });
    expect(screen.getByText('Save')).toBeEnabled();
  });

  it('calls updateDisplayName on save click', async () => {
    render(<ProfileSettingsScreen userProfile={userProfile} />);
    const input = screen.getByLabelText('Display name');
    fireEvent.change(input, { target: { value: 'NewName' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => {
      expect(userProfile.updateDisplayName).toHaveBeenCalledWith('NewName');
    });
  });

  it('calls updateDisplayName on Enter key', async () => {
    render(<ProfileSettingsScreen userProfile={userProfile} />);
    const input = screen.getByLabelText('Display name');
    fireEvent.change(input, { target: { value: 'EnterName' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      expect(userProfile.updateDisplayName).toHaveBeenCalledWith('EnterName');
    });
  });

  it('trims whitespace from display name before saving', async () => {
    render(<ProfileSettingsScreen userProfile={userProfile} />);
    const input = screen.getByLabelText('Display name');
    fireEvent.change(input, { target: { value: '  Trimmed  ' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => {
      expect(userProfile.updateDisplayName).toHaveBeenCalledWith('Trimmed');
    });
  });

  it('does not save if name is empty', async () => {
    render(<ProfileSettingsScreen userProfile={userProfile} />);
    const input = screen.getByLabelText('Display name');
    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getByText('Save')).toBeDisabled();
  });

  it('shows success message after saving name', async () => {
    render(<ProfileSettingsScreen userProfile={userProfile} />);
    const input = screen.getByLabelText('Display name');
    fireEvent.change(input, { target: { value: 'Saved' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => {
      expect(screen.getByText('✓ Display name updated')).toBeInTheDocument();
    });
  });

  it('renders all 8 sausage avatar options', () => {
    render(<ProfileSettingsScreen userProfile={userProfile} />);
    expect(screen.getByLabelText('Bratwurst')).toBeInTheDocument();
    expect(screen.getByLabelText('Salami')).toBeInTheDocument();
    expect(screen.getByLabelText('Blutwurst')).toBeInTheDocument();
    expect(screen.getByLabelText('Weißwurst')).toBeInTheDocument();
    expect(screen.getByLabelText('Frankfurter')).toBeInTheDocument();
    expect(screen.getByLabelText('Chorizo')).toBeInTheDocument();
    expect(screen.getByLabelText('Knackwurst')).toBeInTheDocument();
    expect(screen.getByLabelText('Bockwurst')).toBeInTheDocument();
  });

  it('highlights the currently selected avatar', () => {
    userProfile = makeUserProfile({
      profile: makeProfile({ avatarUrl: 'salami' }),
    });
    render(<ProfileSettingsScreen userProfile={userProfile} />);
    const salami = screen.getByLabelText('Salami');
    expect(salami.getAttribute('aria-checked')).toBe('true');
    expect(salami.className).toContain('profile-avatar-option--selected');
  });

  it('calls updateAvatarUrl when clicking an avatar', async () => {
    render(<ProfileSettingsScreen userProfile={userProfile} />);
    fireEvent.click(screen.getByLabelText('Chorizo'));
    await waitFor(() => {
      expect(userProfile.updateAvatarUrl).toHaveBeenCalledWith('chorizo');
    });
  });

  it('shows current avatar display when one is selected', () => {
    userProfile = makeUserProfile({
      profile: makeProfile({ avatarUrl: 'bratwurst' }),
    });
    render(<ProfileSettingsScreen userProfile={userProfile} />);
    expect(screen.getByText('Current: Bratwurst')).toBeInTheDocument();
  });

  it('does not show current avatar display when none selected', () => {
    userProfile = makeUserProfile({
      profile: makeProfile({ avatarUrl: undefined }),
    });
    render(<ProfileSettingsScreen userProfile={userProfile} />);
    expect(screen.queryByText(/Current:/)).not.toBeInTheDocument();
  });

  it('shows error message when present', () => {
    userProfile = makeUserProfile({ error: 'Something went wrong' });
    render(<ProfileSettingsScreen userProfile={userProfile} />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('disables inputs when loading', () => {
    userProfile = makeUserProfile({ loading: true });
    render(<ProfileSettingsScreen userProfile={userProfile} />);
    expect(screen.getByLabelText('Display name')).toBeDisabled();
    expect(screen.getByLabelText('Bratwurst')).toBeDisabled();
  });

  it('shows "Choose your sausage avatar" hint', () => {
    render(<ProfileSettingsScreen userProfile={userProfile} />);
    expect(screen.getByText('Choose your sausage avatar:')).toBeInTheDocument();
  });

  it('uses radiogroup role for avatar grid', () => {
    render(<ProfileSettingsScreen userProfile={userProfile} />);
    expect(screen.getByRole('radiogroup', { name: 'Avatar selection' })).toBeInTheDocument();
  });
});
