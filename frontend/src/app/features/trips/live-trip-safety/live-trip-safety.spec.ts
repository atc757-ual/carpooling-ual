import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { TripShareService } from '../../../core/services/trips/trip-share.service';
import { LiveTripSafety } from './live-trip-safety';

const SHARE_TEXT = 'Voy en un viaje compartido de la UAL: Roquetas → Campus';

describe('LiveTripSafety', () => {
  let fixture: ComponentFixture<LiveTripSafety>;
  let share: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    share = vi.fn().mockResolvedValue('shared');
    TestBed.configureTestingModule({
      imports: [LiveTripSafety],
      providers: [provideIonicAngular(), { provide: TripShareService, useValue: { share } }],
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

  it('shares the trip text from the driver row', () => {
    const root = render({ shareText: SHARE_TEXT });

    root
      .querySelector<HTMLElement>('[aria-label="Compartir el viaje con alguien de confianza"]')
      ?.click();

    expect(share).toHaveBeenCalledWith({
      title: 'Mi viaje en Carpooling UAL',
      text: SHARE_TEXT,
    });
  });

  it('offers the live link to the passenger in its card', () => {
    const root = render({ liveShareTripId: 't1' });

    expect(root.textContent).toContain('Viaje seguro');
    expect(root.querySelector('app-trip-live-share')).not.toBeNull();
    expect(root.querySelector('.live-safety__row')).toBeNull();
  });
});
