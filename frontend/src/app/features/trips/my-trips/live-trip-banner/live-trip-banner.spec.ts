import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { LiveTripBanner } from './live-trip-banner';

describe('LiveTripBanner', () => {
  function render(detail?: string): HTMLElement {
    TestBed.configureTestingModule({
      imports: [LiveTripBanner],
      providers: [provideIonicAngular(), provideRouter([])],
    });
    const fixture = TestBed.createComponent(LiveTripBanner);
    fixture.componentRef.setInput('route', 'Roquetas de Mar → Campus UAL');
    fixture.componentRef.setInput('link', '/tabs/trips/drive/t1');
    if (detail) {
      fixture.componentRef.setInput('detail', detail);
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the trip in progress and opens it', () => {
    const root = render('Conduce Lucía Cortés');

    expect(root.textContent).toContain('Viaje en curso');
    expect(root.textContent).toContain('Roquetas de Mar → Campus UAL');
    expect(root.textContent).toContain('Conduce Lucía Cortés');
    expect(root.querySelector('ion-button')?.getAttribute('href')).toBe('/tabs/trips/drive/t1');
  });

  it('leaves out the detail when there is none', () => {
    expect(render().querySelector('.live-trip-banner__detail')).toBeNull();
  });
});
