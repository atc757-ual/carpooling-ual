import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ApiError } from '../../models/api-error.model';
import type { User } from '../../models/user.model';
import { AuthService } from '../auth/auth.service';
import { PushNotificationsService } from '../push/push-notifications.service';
import { AppLanguage, LanguageService } from '../ui/language.service';
import { LanguageSyncService } from './language-sync.service';
import { UsersService } from './users.service';

const ANA = { id: 'u1', firstName: 'Ana', language: 'es' } as User;

describe('LanguageSyncService', () => {
  let user: ReturnType<typeof signal<User | null>>;
  let language: ReturnType<typeof signal<AppLanguage>>;
  let updateMe: ReturnType<typeof vi.fn>;
  let updateUser: ReturnType<typeof vi.fn>;
  let refreshLanguage: ReturnType<typeof vi.fn>;

  function start(): void {
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { currentUser: user, updateUser } },
        { provide: UsersService, useValue: { updateMe } },
        { provide: LanguageService, useValue: { currentLanguage: language } },
        { provide: PushNotificationsService, useValue: { refreshLanguage } },
      ],
    });
    TestBed.inject(LanguageSyncService);
    TestBed.tick();
  }

  beforeEach(() => {
    user = signal<User | null>(ANA);
    language = signal<AppLanguage>('es');
    updateMe = vi.fn((changes: Partial<User>) => Promise.resolve({ ...ANA, ...changes }));
    updateUser = vi.fn((next: User) => user.set(next));
    refreshLanguage = vi.fn().mockResolvedValue(undefined);
  });

  it('does nothing while the account already has the language of the app', () => {
    start();

    expect(updateMe).not.toHaveBeenCalled();
  });

  it('sends the new language and registers the push token again', async () => {
    start();

    language.set('en');
    TestBed.tick();
    await vi.waitFor(() => expect(refreshLanguage).toHaveBeenCalled());

    expect(updateMe).toHaveBeenCalledWith({ language: 'en' });
    expect(updateUser).toHaveBeenCalledWith(expect.objectContaining({ language: 'en' }));
    expect(updateMe).toHaveBeenCalledTimes(1);
  });

  it('sends it on login when the account has another language', async () => {
    user.set(null);
    language.set('en');
    start();
    expect(updateMe).not.toHaveBeenCalled();

    user.set(ANA);
    TestBed.tick();

    await vi.waitFor(() => expect(updateMe).toHaveBeenCalledWith({ language: 'en' }));
  });

  it('tries again later when the API cannot be reached', async () => {
    updateMe.mockRejectedValueOnce(new ApiError('NETWORK_ERROR', 0));
    start();

    language.set('en');
    TestBed.tick();
    await vi.waitFor(() => expect(updateMe).toHaveBeenCalledTimes(1));

    expect(refreshLanguage).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });
});
