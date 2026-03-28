/**
 * Maps WebAuthn AAGUIDs and credential hints to user-facing labels (similar to major passkey UIs).
 * AAGUID values come from authenticator metadata; extend AAGUID_MAP as you verify more devices.
 */
export type PasskeyProviderKind =
  | 'apple_icloud'
  | 'google_password_manager'
  | 'windows_hello'
  | 'synced_passkey'
  | 'this_device'
  | 'security_key'
  | 'unknown';

export type PasskeyDisplayRowInput = {
  aaguid?: string;
  deviceType: 'singleDevice' | 'multiDevice';
  backedUp: boolean;
  transports?: string[];
};

const AAGUID_MAP: Record<
  string,
  { displayName: string; provider: PasskeyProviderKind }
> = {
  // Apple — multiple AAGUIDs map to the same product surface in Settings UIs
  'f8a011f3-8c0a-4d15-9446-2793692e0e7b': {
    displayName: 'iCloud Keychain',
    provider: 'apple_icloud',
  },
  'ea9b8d08-fd44-4b7d-969b-a336767fa40f': {
    displayName: 'iCloud Keychain',
    provider: 'apple_icloud',
  },
  'aee0c04e-f0e4-4800-9f57-20f9407884c9': {
    displayName: 'iCloud Keychain',
    provider: 'apple_icloud',
  },
  // Microsoft / Windows Hello
  '08987058-cadc-4b81-b6e1-e9ae5f9b8b68': {
    displayName: 'Windows Hello',
    provider: 'windows_hello',
  },
  // Google Password Manager (Chrome / Android)
  '769f6f4b-7abf-4c01-9aa9-61f73fc4fcd3': {
    displayName: 'Google Password Manager',
    provider: 'google_password_manager',
  },
  // YubiKey 5 NFC (example security key)
  'ee888942-32a1-4e13-9393-e356b1b49eef': {
    displayName: 'Security key',
    provider: 'security_key',
  },
};

function normalizeAaguid(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined;

  return raw.trim().toLowerCase();
}

export function resolvePasskeyDisplay(row: PasskeyDisplayRowInput): {
  displayName: string;
  provider: PasskeyProviderKind;
} {
  const key = normalizeAaguid(row.aaguid);
  if (key && AAGUID_MAP[key]) {
    return AAGUID_MAP[key];
  }

  if (row.transports?.includes('hybrid')) {
    return {
      displayName: 'Cross-device passkey',
      provider: 'synced_passkey',
    };
  }

  if (row.deviceType === 'multiDevice' && row.backedUp) {
    return { displayName: 'Synced passkey', provider: 'synced_passkey' };
  }

  if (row.deviceType === 'singleDevice') {
    return { displayName: 'This device', provider: 'this_device' };
  }

  return { displayName: 'Passkey', provider: 'unknown' };
}
