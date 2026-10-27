import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { TripSearch } from '../../../core/models/trip-search.model';
import { PARKING_P1, ROQUETAS } from '../trip-search.testing';
import { TripSearchStateService } from '../trip-search-state.service';
import { TripDetailPage } from './trip-detail.page';

const SEARCH: TripSearch = {
  place: ROQUETAS,
  parking: PARKING_P1,
  direction: 'to-campus',
  date: '2026-10-27',
  time: '08:20',
  margin: 20,
  seats: 2,
};

describe('TripDetailPage', () => {
  function render(id: string, search: TripSearch | null): HTMLElement {
    TestBed.configureTestingModule({
      imports: [TripDetailPage],
      providers: [provideIonicAngular(), provideRouter([])],
    });
    const state = TestBed.inject(TripSearchStateService);
    if (search) {
      state.set(search);
    } else {
      state.clear();
    }
    const fixture = TestBed.createComponent(TripDetailPage);
    fixture.componentRef.setInput('id', id);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const texts = (root: HTMLElement, selector: string): string[] =>
    Array.from(root.querySelectorAll(selector), (element) => element.textContent?.trim() ?? '');

  it('shows the trip of the search with its times, its stops and its seats', () => {
    const root = render('example-1', SEARCH);

    expect(root.querySelector('.trip-detail__date span')?.textContent?.trim()).toBe(
      '27 oct, ida al campus',
    );
    expect(texts(root, '.route-timeline__stop')).toEqual([
      '07:40Roquetas de MarRecogida',
      '08:12Campus UALParking P1',
    ]);
    expect(texts(root, '.trip-detail__seats')).toEqual(['2 plazas libres']);
    expect(root.textContent).toContain('Datos de ejemplo');
  });

  it('shows who drives, the car and who decides', () => {
    const root = render('example-1', SEARCH);

    expect(root.querySelector('app-trip-driver')?.textContent).toContain('Lucía Cortés');
    expect(root.textContent).toContain('Seat Ibiza · 1234 BCD');
    expect(root.textContent).toContain('Primero solicitas; Lucía decide.');
  });

  it('keeps the seat request disabled with the seats of the search', () => {
    const root = render('example-1', SEARCH);
    const button = root.querySelector<HTMLIonButtonElement>('.trip-detail__aside ion-button');

    expect(button?.textContent?.trim()).toBe('Solicitar 2 plazas');
    expect(button?.disabled).toBe(true);
  });

  it('speaks of coming back from the campus', () => {
    const root = render('example-1', { ...SEARCH, direction: 'from-campus', time: '14:00' });

    expect(root.querySelector('.trip-detail__date span')?.textContent?.trim()).toBe(
      '27 oct, vuelta del campus',
    );
  });

  it('does not find the trip without a search or with another id', () => {
    expect(render('example-1', null).textContent).toContain('No encontramos este viaje');
    TestBed.resetTestingModule();
    expect(render('example-2', SEARCH).textContent).toContain('No encontramos este viaje');
  });
});
