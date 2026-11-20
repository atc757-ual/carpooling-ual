import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { provideAppTransloco } from '../../../../core/i18n/testing-transloco';
import { ParticipantProfileModal } from '../../modals/participant-profile-modal/participant-profile-modal';
import { ParticipantLink } from './participant-link';

@Component({
  imports: [ParticipantLink],
  template: `<app-participant-link tripId="t1" userId="u1" name="Lucía Cortés" role="driver"
    >Lucía</app-participant-link
  >`,
})
class HostComponent {}

describe('ParticipantLink', () => {
  let create: ReturnType<typeof vi.fn>;
  let present: ReturnType<typeof vi.fn>;

  function render(): HTMLButtonElement {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideAppTransloco(),
        provideIonicAngular(),
        { provide: ModalController, useValue: { create } },
      ],
    });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector('button') as HTMLButtonElement;
  }

  beforeEach(() => {
    present = vi.fn().mockResolvedValue(undefined);
    create = vi.fn().mockResolvedValue({ present });
  });

  it('shows what it wraps and says whose profile it opens', () => {
    const button = render();

    expect(button.textContent?.trim()).toBe('Lucía');
    expect(button.getAttribute('aria-label')).toBe('Ver el perfil de Lucía');
  });

  it('opens the profile of that person in that trip', async () => {
    const button = render();

    button.click();

    await vi.waitFor(() => expect(present).toHaveBeenCalled());
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        component: ParticipantProfileModal,
        componentProps: { tripId: 't1', userId: 'u1', name: 'Lucía Cortés', role: 'driver' },
      }),
    );
  });
});
