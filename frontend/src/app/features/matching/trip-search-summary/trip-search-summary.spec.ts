import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { TripSearch } from '../../../core/models/trip-search.model';
import { formatShortDate, TripSearchSummary } from './trip-search-summary';

const SEARCH: TripSearch = {
  place: 'Roquetas de Mar',
  entrance: 'north',
  direction: 'to-campus',
  date: '2026-10-27',
  time: '08:00',
  margin: 20,
  seats: 1,
};

describe('TripSearchSummary', () => {
  let fixture: ComponentFixture<TripSearchSummary>;

  function render(search: TripSearch): HTMLElement {
    TestBed.configureTestingModule({
      imports: [TripSearchSummary],
      providers: [provideIonicAngular()],
    });
    fixture = TestBed.createComponent(TripSearchSummary);
    fixture.componentRef.setInput('search', search);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const texts = (root: HTMLElement, selector: string): string[] =>
    Array.from(root.querySelectorAll(selector), (element) => element.textContent?.trim() ?? '');

  it('goes from the place (pick-up) to the campus entrance', () => {
    const root = render(SEARCH);

    expect(texts(root, '.search-summary__stop')).toEqual([
      'Roquetas de MarRecogida',
      'Campus UALIngreso norte',
    ]);
  });

  it('comes back from the campus entrance to the place', () => {
    const root = render({ ...SEARCH, direction: 'from-campus', entrance: 'east' });

    expect(texts(root, '.search-summary__stop')).toEqual([
      'Campus UALIngreso este',
      'Roquetas de MarLlegada',
    ]);
  });

  it('shows the date, the time with its margin and the seats', () => {
    const root = render(SEARCH);

    expect(texts(root, '.search-summary__details > div')).toEqual([
      '27 oct · llegada 08:00 ±20 min · 1 plaza',
      'Margen de llegada: 07:40–08:20',
    ]);
  });

  it('speaks of departure and of seats in plural when coming back with more', () => {
    const root = render({
      ...SEARCH,
      direction: 'from-campus',
      time: '14:00',
      margin: 10,
      seats: 3,
    });

    expect(texts(root, '.search-summary__details > div')).toEqual([
      '27 oct · salida 14:00 ±10 min · 3 plazas',
      'Margen de salida: 13:50–14:10',
    ]);
  });

  it('asks to edit the search', () => {
    const root = render(SEARCH);
    let edits = 0;
    fixture.componentInstance.edit.subscribe(() => edits++);

    root.querySelector('form')?.dispatchEvent(new Event('submit'));

    expect(edits).toBe(1);
  });
});

describe('formatShortDate', () => {
  it('writes the day and the short month in Spanish, in local time', () => {
    expect(formatShortDate('2026-10-27')).toBe('27 oct');
    expect(formatShortDate('2026-01-01')).toBe('1 ene');
  });
});
