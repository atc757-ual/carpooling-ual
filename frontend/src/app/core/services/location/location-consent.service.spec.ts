import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { UserConsents } from '../../models/user-consent.model';
import { AuthService } from '../auth/auth.service';
import { UsersService } from '../users/users.service';
import { LocationConsentService } from './location-consent.service';

function consentsWith(action: 'granted' | 'revoked' | null): UserConsents {
  return {
    current: {
      terms: null,
      privacy: null,
      location: action
        ? {
            id: 'c1',
            type: 'location',
            documentVersion: '1.0',
            action,
            source: 'settings',
            recordedAt: '2026-11-01T10:00:00.000Z',
            fingerprint: 'a'.repeat(64),
          }
        : null,
    },
    history: [],
  };
}

describe('LocationConsentService', () => {
  let consent: LocationConsentService;
  const currentUser = signal<{ id: string } | null>({ id: 'user-1' });
  const users = { getMyConsents: vi.fn(), setLocationConsent: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    currentUser.set({ id: 'user-1' });
    TestBed.configureTestingModule({
      providers: [
        { provide: UsersService, useValue: users },
        { provide: AuthService, useValue: { currentUser } },
      ],
    });
    consent = TestBed.inject(LocationConsentService);
  });

  it('knows whether the user gave, withdrew or never recorded it', async () => {
    users.getMyConsents.mockResolvedValueOnce(consentsWith('granted'));
    await expect(consent.getStatus()).resolves.toBe('granted');

    users.getMyConsents.mockResolvedValueOnce(consentsWith('revoked'));
    await consent.load(true);
    await expect(consent.getStatus()).resolves.toBe('revoked');

    users.getMyConsents.mockResolvedValueOnce(consentsWith(null));
    await consent.load(true);
    await expect(consent.getStatus()).resolves.toBe('none');
  });

  it('asks the API once per user and again for another user', async () => {
    users.getMyConsents.mockResolvedValue(consentsWith('granted'));

    await consent.getStatus();
    await consent.getStatus();
    expect(users.getMyConsents).toHaveBeenCalledTimes(1);

    currentUser.set({ id: 'user-2' });
    await consent.getStatus();
    expect(users.getMyConsents).toHaveBeenCalledTimes(2);
  });

  it('does not block the location when the consents cannot be read', async () => {
    users.getMyConsents.mockRejectedValue(new Error('offline'));

    await expect(consent.getStatus()).resolves.toBe('none');
  });

  it('has nothing to load without a session', async () => {
    currentUser.set(null);

    await expect(consent.load()).resolves.toBeNull();
    expect(users.getMyConsents).not.toHaveBeenCalled();
  });

  it('records the change with its source and keeps the new state', async () => {
    users.setLocationConsent.mockResolvedValue(consentsWith('granted'));

    await consent.set('granted', 'location_prompt');

    expect(users.setLocationConsent).toHaveBeenCalledWith('granted', 'location_prompt');
    await expect(consent.getStatus()).resolves.toBe('granted');
    expect(users.getMyConsents).not.toHaveBeenCalled();
  });
});
