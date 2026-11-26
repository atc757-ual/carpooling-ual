import { TestBed } from '@angular/core/testing';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { initAppTranslations, provideAppTransloco } from '../../../../core/i18n/testing-transloco';
import { ApiError } from '../../../../core/models/api-error.model';
import { ParticipantProfile } from '../../../../core/models/participant-profile.model';
import { TravelPreferencesStore } from '../../../../core/services/catalogs/travel-preferences.store';
import { TripParticipantsService } from '../../../../core/services/trips/trip-participants.service';
import { AvatarsService } from '../../../../core/services/users/avatars.service';
import {
  formatParticipantRating,
  openParticipantProfile,
  ParticipantProfileModal,
} from './participant-profile-modal';

function profile(overrides: Partial<ParticipantProfile> = {}): ParticipantProfile {
  return {
    id: 'u1',
    name: 'Lucía Cortés Martín',
    email: 'lucia@ual.es',
    avatarKey: null,
    bio: 'Conductora habitual desde Roquetas',
    preferences: { conversation: 'chatty', music: null, smoking: null, pets: null },
    ratings: {
      driver: { averageRating: 4.5, ratingCount: 12 },
      passenger: { averageRating: null, ratingCount: 0 },
    },
    ...overrides,
  };
}

describe('formatParticipantRating', () => {
  beforeEach(() => initAppTranslations());

  it('shows the average and how many ratings in the role', () => {
    expect(formatParticipantRating(profile(), 'driver')).toBe('4,5 · 12 valoraciones');
  });

  it('says there are no ratings yet in the other role', () => {
    expect(formatParticipantRating(profile(), 'passenger')).toBe('Aún sin valoraciones');
  });
});

describe('ParticipantProfileModal', () => {
  let getProfile: ReturnType<typeof vi.fn>;
  let dismiss: ReturnType<typeof vi.fn>;

  let component: ParticipantProfileModal;

  async function render(): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [ParticipantProfileModal],
      providers: [
        provideAppTransloco(),
        provideIonicAngular(),
        { provide: TripParticipantsService, useValue: { getProfile } },
        { provide: AvatarsService, useValue: { getGraphic: vi.fn().mockResolvedValue(null) } },
        {
          provide: TravelPreferencesStore,
          useValue: { format: vi.fn().mockReturnValue(['Charlar', 'Música suave']) },
        },
        { provide: ModalController, useValue: { dismiss } },
      ],
    });
    const fixture = TestBed.createComponent(ParticipantProfileModal);
    Object.assign(fixture.componentInstance, {
      tripId: 't1',
      userId: 'u1',
      name: 'Lucía Cortés',
      role: 'driver',
    });
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.profile.isLoading()).toBe(false));
    fixture.detectChanges();
    component = fixture.componentInstance;
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    getProfile = vi.fn().mockResolvedValue(profile());
    dismiss = vi.fn().mockResolvedValue(true);
  });

  it('shows the full name, the rating, «About me», the preferences and the email', async () => {
    const root = await render();

    expect(getProfile).toHaveBeenCalledWith('t1', 'u1');
    expect(root.textContent).toContain('Lucía Cortés Martín');
    expect(root.textContent).toContain('Conductora habitual desde Roquetas');
    expect(root.querySelectorAll('ion-chip')).toHaveLength(2);
    // El enlace es solo el correo; la fila de «Contacto» no se pulsa
    const mailLink = root.querySelector('a.participant-profile__email') as HTMLAnchorElement;
    expect(mailLink.getAttribute('href')).toBe('mailto:lucia@ual.es');
    expect(root.querySelector('ion-item:last-of-type')?.hasAttribute('href')).toBe(false);
    expect(root.textContent).not.toContain('+34');
  });

  it('leaves out «About me» and the preferences when there are none', async () => {
    getProfile.mockResolvedValue(profile({ bio: null }));
    TestBed.overrideProvider(TravelPreferencesStore, { useValue: { format: () => [] } });
    const root = await render();

    expect(root.querySelector('.participant-profile__bio')).toBeNull();
    expect(root.querySelector('ion-chip')).toBeNull();
  });

  it('shows why it could not load the profile', async () => {
    getProfile.mockRejectedValue(new ApiError('PARTICIPANT_PROFILE_FORBIDDEN', 403));
    const root = await render();

    expect(root.querySelector('app-empty-state')).not.toBeNull();
    expect(root.querySelector('ion-list')).toBeNull();
  });

  it('closes the window', async () => {
    await render();

    await component.close();

    expect(dismiss).toHaveBeenCalled();
  });
});

describe('openParticipantProfile', () => {
  it('opens the window with whom to show', async () => {
    const present = vi.fn().mockResolvedValue(undefined);
    const create = vi.fn().mockResolvedValue({ present });
    const target = { tripId: 't1', userId: 'u1', name: 'Lucía', role: 'driver' as const };

    await openParticipantProfile({ create } as unknown as ModalController, target);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ component: ParticipantProfileModal, componentProps: target }),
    );
    expect(present).toHaveBeenCalled();
  });
});
