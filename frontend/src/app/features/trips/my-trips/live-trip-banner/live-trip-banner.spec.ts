import { provideAppTransloco } from '../../../../core/i18n/testing-transloco';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { TripEnds } from '../my-trips-summary';
import { LiveTripBanner } from './live-trip-banner';

describe('LiveTripBanner', () => {
  const ROQUETAS: TripEnds = { originName: 'Roquetas de Mar', destinationName: 'Campus UAL' };

  function render(
    trip: TripEnds,
    { detail, role }: { detail?: string; role?: 'driver' | 'passenger' } = {},
  ): HTMLElement {
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
    if (role) {
      fixture.componentRef.setInput('tripRole', role);
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function places(root: HTMLElement): string[] {
    return [...root.querySelectorAll('.trip-ends__place')].map(
      (place) => place.textContent?.trim() ?? '',
    );
  }

  it('shows the trip in progress, only where it goes, and opens it', () => {
    const root = render(ROQUETAS, { detail: 'Conduce Lucía Cortés', role: 'passenger' });

    // La etiqueta del borde se ve, pero la lee el texto oculto del enlace
    expect(root.classList).toContain('status-card-frame');
    const label = root.querySelector('.status-card-label');
    expect(label?.getAttribute('aria-hidden')).toBe('true');
    expect(label?.textContent).toContain('Viaje en curso');
    expect(label?.querySelector('.status-card-label__dot')).not.toBeNull();
    expect(root.querySelector('ion-label .visually-hidden')?.textContent).toBe('Viaje en curso');
    expect(places(root)).toEqual(['Hacia Campus UAL']);
    expect(root.querySelector('.role-tag--passenger')?.textContent).toContain('Viajas');
    expect(root.textContent).toContain('Conduce Lucía Cortés');
    expect(root.querySelector('ion-item.live-trip-banner')?.getAttribute('href')).toBe(
      '/tabs/trips/drive/t1',
    );
    // El aviso entero es el enlace: el chevron al final, sin otro botón
    expect(root.querySelector('.live-trip-banner__chevron')).not.toBeNull();
  });

  it('says when the user is driving', () => {
    const root = render(ROQUETAS, { role: 'driver' });

    expect(root.querySelector('.role-tag--driver')?.textContent).toContain('Conduces');
    expect(root.querySelector('.role-tag--passenger')).toBeNull();
  });

  it('names a trip without a saved destination and leaves out what is missing', () => {
    const root = render({ originName: null, destinationName: null });

    expect(places(root)).toEqual(['Hacia Destino']);
    expect(root.querySelector('.role-tag')).toBeNull();
    expect(root.querySelector('.live-trip-banner__detail')).toBeNull();
  });
});
