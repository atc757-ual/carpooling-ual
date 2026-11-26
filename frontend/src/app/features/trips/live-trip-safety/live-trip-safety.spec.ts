import { Component } from '@angular/core';
import { provideAppTransloco } from '../../../core/i18n/testing-transloco';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { TripLiveShareService } from '../../../core/services/trips/trip-live-share.service';
import { TripShareService } from '../../../core/services/trips/trip-share.service';
import {
  LiveTripOtherActions,
  LiveTripQuickActions,
  LiveTripSafety,
  LiveTripSosButton,
} from './live-trip-safety';

const SHARE_TEXT = 'Voy en un viaje compartido de la UAL: Roquetas → Campus';

@Component({
  imports: [LiveTripOtherActions],
  template: `
    <app-live-trip-other-actions [shareText]="shareText">
      <div class="projected-report">Reportar</div>
    </app-live-trip-other-actions>
  `,
})
class OtherActionsHost {
  shareText = SHARE_TEXT;
}

describe('LiveTripSafety', () => {
  let fixture: ComponentFixture<LiveTripSafety>;
  let share: ReturnType<typeof vi.fn>;
  let liveShareStart: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    share = vi.fn().mockResolvedValue('shared');
    liveShareStart = vi.fn().mockResolvedValue('https://carpooling.example/seguir/tok1');
    TestBed.configureTestingModule({
      imports: [LiveTripSafety],
      providers: [
        provideAppTransloco(),
        provideIonicAngular(),
        { provide: TripShareService, useValue: { share } },
        { provide: TripLiveShareService, useValue: { start: liveShareStart } },
      ],
    });
    fixture = TestBed.createComponent(LiveTripSafety);
  });

  function render(inputs: Record<string, unknown>): HTMLElement {
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shares the trip text with the system menu', () => {
    const root = render({ shareText: SHARE_TEXT });

    root
      .querySelector<HTMLElement>('[aria-label="Compartir viaje con alguien de confianza"]')
      ?.click();

    expect(share).toHaveBeenCalledWith({
      title: 'Mi viaje en Carpooling UAL',
      text: SHARE_TEXT,
    });
  });

  it('generates and includes the live tracking link when tripId is given', async () => {
    render({ shareText: SHARE_TEXT, tripId: 't123' });

    await fixture.componentInstance.handleShare();

    expect(liveShareStart).toHaveBeenCalledWith('t123');
    expect(share).toHaveBeenCalledWith({
      title: 'Mi viaje en Carpooling UAL',
      text: SHARE_TEXT,
      url: 'https://carpooling.example/seguir/tok1',
    });
  });

  it('shows the same title and text to the driver and the passenger, without a live link', () => {
    const root = render({ shareText: SHARE_TEXT });

    expect(root.textContent).toContain('Viaje seguro');
    expect(root.textContent).toContain('Avisa a alguien de confianza.');
    expect(root.querySelector('app-trip-live-share')).toBeNull();
  });

  it('renders the SOS link in full or stacked mode', () => {
    const sos = TestBed.createComponent(LiveTripSosButton);
    sos.detectChanges();
    const link = (sos.nativeElement as HTMLElement).querySelector('a');
    expect(link?.getAttribute('href')).toBe('tel:112');
    expect(link?.classList.contains('icon-btn--stacked')).toBe(false);
    expect(link?.textContent).toContain('Llamar al 112');

    sos.componentRef.setInput('stacked', true);
    sos.detectChanges();
    expect(link?.classList.contains('icon-btn--stacked')).toBe(true);
    expect(link?.textContent).toContain('SOS');
  });

  it('emits share and report from the quick action row and keeps the stacked SOS', () => {
    const quick = TestBed.createComponent(LiveTripQuickActions);
    quick.componentRef.setInput('reportLabel', 'Reportar incidencia');
    const onShare = vi.fn();
    const onReport = vi.fn();
    quick.componentInstance.shared.subscribe(onShare);
    quick.componentInstance.reported.subscribe(onReport);
    quick.detectChanges();

    const root = quick.nativeElement as HTMLElement;
    root
      .querySelector<HTMLButtonElement>('[aria-label="Compartir viaje con alguien de confianza"]')
      ?.click();
    root.querySelector<HTMLButtonElement>('[aria-label="Reportar incidencia"]')?.click();

    expect(onShare).toHaveBeenCalledTimes(1);
    expect(onReport).toHaveBeenCalledTimes(1);
    expect(root.querySelector('a.icon-btn--stacked')?.getAttribute('href')).toBe('tel:112');
  });

  it('groups safety, projected report card and 112 emergency in other actions', () => {
    const host = TestBed.createComponent(OtherActionsHost);
    host.detectChanges();
    const root = host.nativeElement as HTMLElement;

    expect(root.querySelector('#other-actions-title')?.textContent).toContain('Otras acciones');
    expect(root.querySelector('app-live-trip-safety')).not.toBeNull();
    expect(root.querySelector('.projected-report')?.textContent).toContain('Reportar');
    expect(root.querySelector('a[href="tel:112"]')).not.toBeNull();
  });
});
