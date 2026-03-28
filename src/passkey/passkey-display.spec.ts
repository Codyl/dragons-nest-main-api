import {
  resolvePasskeyDisplay,
  type PasskeyDisplayRowInput,
} from './passkey-display';

describe('resolvePasskeyDisplay', () => {
  const base = (
    over: Partial<PasskeyDisplayRowInput>,
  ): PasskeyDisplayRowInput => ({
    deviceType: 'singleDevice',
    backedUp: false,
    ...over,
  });

  it('maps known Apple AAGUID to iCloud Keychain', () => {
    expect(
      resolvePasskeyDisplay(
        base({
          aaguid: 'F8A011F3-8C0A-4D15-9446-2793692E0E7B',
        }),
      ),
    ).toEqual({
      displayName: 'iCloud Keychain',
      provider: 'apple_icloud',
    });
  });

  it('maps Windows Hello AAGUID', () => {
    expect(
      resolvePasskeyDisplay(
        base({ aaguid: '08987058-cadc-4b81-b6e1-e9ae5f9b8b68' }),
      ),
    ).toEqual({
      displayName: 'Windows Hello',
      provider: 'windows_hello',
    });
  });

  it('maps Google Password Manager AAGUID', () => {
    expect(
      resolvePasskeyDisplay(
        base({ aaguid: '769f6f4b-7abf-4c01-9aa9-61f73fc4fcd3' }),
      ),
    ).toEqual({
      displayName: 'Google Password Manager',
      provider: 'google_password_manager',
    });
  });

  it('uses hybrid transport hint', () => {
    expect(
      resolvePasskeyDisplay(
        base({ transports: ['hybrid'], deviceType: 'multiDevice' }),
      ),
    ).toEqual({
      displayName: 'Cross-device passkey',
      provider: 'synced_passkey',
    });
  });

  it('falls back to synced passkey when multi-device and backed up', () => {
    expect(
      resolvePasskeyDisplay(
        base({ deviceType: 'multiDevice', backedUp: true }),
      ),
    ).toEqual({
      displayName: 'Synced passkey',
      provider: 'synced_passkey',
    });
  });

  it('falls back to this device for single-device credentials', () => {
    expect(resolvePasskeyDisplay(base({}))).toEqual({
      displayName: 'This device',
      provider: 'this_device',
    });
  });
});
