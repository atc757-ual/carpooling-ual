import { provideAppTransloco } from '../../../../core/i18n/testing-transloco';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { TripEnds } from '../my-trips-summary';
import { LiveTripBanner } from './live-trip-banner';

describe('LiveTripBanner', () => {
  const ROQUETAS: TripEnds = { originName: 'Roquetas de Mar', destinationName: 'Campus UAL' };

  function render(trip: TripEnds, detail?: string): HTMLElement {
    TestBed.configureTestingModule({
      imports: [LiveTripBanner],
      providers: [provideAppTransloco(), provideIonicAngular(), provideRouter([])],
    });
    const fixture = TestBed.createComponent(LiveTripBanner);
    fixture.componentRef.setInput('trip', trip);
    fixture.componentRef.setInput('link', '/tabs/trips/drive/t1');
    if (detail) {
      fixture.componentRef.setInput('detail', detail);
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function places(root: HTMLElement): (string | null)[] {
    return [...root.querySelectorAll('.live-trip-banner__place')].map((place) => place.textContent);
  }

  it('shows the trip in progress and opens it', () => {
    const root = render(ROQUETAS, 'Conduce Lucía Cortés');

    expect(root.textContent).toContain('Viaje en curso');
    expect(root.querySelector('.live-trip-banner__route')?.textContent).toBe(
      'Roquetas de Mar → Campus UAL',
    );
    expect(places(root)).toEqual(['Roquetas de Mar', 'Campus UAL']);
    expect(root.textContent).toContain('Conduce Lucía Cortés');
    expect(root.querySelector('ion-item.live-trip-banner')?.getAttribute('href')).toBe(
      '/tabs/trips/drive/t1',
    );
  });

  it('names the ends of a trip without saved places and leaves out a missing detail', () => {
    const root = render({ originName: null, destinationName: null });

    expect(root.querySelector('.live-trip-banner__route')?.textContent).toBe('Origen → Destino');
    expect(places(root)).toEqual(['Origen', 'Destino']);
    expect(root.querySelector('.live-trip-banner__detail')).toBeNull();
  });
});
