import { provideAppTransloco } from '../../../../core/i18n/testing-transloco';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ApiError, NETWORK_ERROR } from '../../../../core/models/api-error.model';
import { ParticipantProfile } from '../../../../core/models/participant-profile.model';
import { TripParticipantsService } from '../../../../core/services/trips/trip-participants.service';
import { ParticipantEmail } from './participant-email';

const PROFILE = { id: 'u1', name: 'Lucía Cortés', email: 'lucia@ual.es' } as ParticipantProfile;

describe('ParticipantEmail', () => {
  async function render(
    getProfile: ReturnType<typeof vi.fn>,
    options: { isInline?: boolean; showIcon?: boolean } = {},
  ): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [ParticipantEmail],
      providers: [
        provideAppTransloco(),
        { provide: TripParticipantsService, useValue: { getProfile } },
      ],
    });
    const fixture = TestBed.createComponent(ParticipantEmail);
    fixture.componentRef.setInput('tripId', 't1');
    fixture.componentRef.setInput('userId', 'u1');
    fixture.componentRef.setInput('name', 'Lucía');
    if (options.isInline !== undefined) {
      fixture.componentRef.setInput('isInline', options.isInline);
    }
    if (options.showIcon !== undefined) {
      fixture.componentRef.setInput('showIcon', options.showIcon);
    }
    await TestBed.inject(ApplicationRef).whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the email of the other person as a link to write to them', async () => {
    const getProfile = vi.fn().mockResolvedValue(PROFILE);
    const root = await render(getProfile);

    expect(getProfile).toHaveBeenCalledWith('t1', 'u1');
    const link = root.querySelector('a.participant-email');
    expect(link?.getAttribute('href')).toBe('mailto:lucia@ual.es');
    expect(link?.getAttribute('aria-label')).toBe('Enviar un correo a Lucía');
    expect(link?.textContent).toContain('lucia@ual.es');
    expect(root.querySelector('ion-icon')).not.toBeNull();
    expect(root.querySelector('.participant-email__separator')).toBeNull();
  });

  it('goes after a separator and without the envelope inside a line of details', async () => {
    const root = await render(vi.fn().mockResolvedValue(PROFILE), {
      isInline: true,
      showIcon: false,
    });

    expect(root.querySelector('.participant-email__separator')?.textContent).toBe('·');
    expect(root.querySelector('ion-icon')).toBeNull();
    expect(root.classList).toContain('participant-email--inline');
    expect(root.classList).toContain('participant-email--plain');
  });

  it('shows nothing when the profile cannot be loaded', async () => {
    const root = await render(vi.fn().mockRejectedValue(new ApiError(NETWORK_ERROR, 0)));

    expect(root.querySelector('a')).toBeNull();
  });
});
