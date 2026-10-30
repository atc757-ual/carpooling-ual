import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { TripSearch } from '../../../core/models/trip-search.model';
import { PlacesService } from '../../../core/services/places/places.service';
import { TripSearchStateService } from '../trip-search-state.service';
import {
  PARKING_P1,
  PARKING_P3,
  PLACES_SERVICE_STUB,
  ROQUETAS,
  stubIntersectionObserver,
} from '../trip-search.testing';
import { getDefaultTime, shiftTime, TripSearchForm } from './trip-search-form';

const SEARCH: TripSearch = {
  place: ROQUETAS,
  parking: PARKING_P3,
  direction: 'from-campus',
  date: '2026-10-28',
  time: '14:00',
  margin: 10,
  seats: 2,
};

describe('TripSearchForm', () => {
  let fixture: ComponentFixture<TripSearchForm>;
  let form: TripSearchForm;
  let navigate: ReturnType<typeof vi.spyOn>;
  let searchState: TripSearchStateService;

  beforeEach(() => {
    sessionStorage.clear();
    stubIntersectionObserver();
    TestBed.configureTestingModule({
      imports: [TripSearchForm],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        { provide: PlacesService, useValue: PLACES_SERVICE_STUB },
      ],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    searchState = TestBed.inject(TripSearchStateService);
    fixture = TestBed.createComponent(TripSearchForm);
    form = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('starts without a parking, today from now with ±20 min and 1 seat, by default', () => {
    const { place, parking, isToCampus, time, margin, seats, date } = form.form.getRawValue();
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    expect(place).toBeNull();
    expect(parking).toBe('');
    expect(isToCampus).toBe(true);
    expect(form.timeType()).toBe('arrival');
    expect(time).toMatch(/^\d{2}:\d[05]$/);
    expect(margin).toBe(20);
    expect(seats).toBe(1);
    expect(date).toBe(`${today.getFullYear()}-${month}-${day}`);
  });

  it('clears the search and what was chosen', () => {
    searchState.set({ ...SEARCH, margin: 15, seats: 3 });
    fixture.detectChanges();

    form.clear();

    const { place, parking, isToCampus, margin, seats } = form.form.getRawValue();
    expect(searchState.search()).toBeNull();
    expect({ place, parking, isToCampus, margin, seats }).toEqual({
      place: null,
      parking: '',
      isToCampus: true,
      margin: 20,
      seats: 1,
    });
  });

  it('asks for the arrival time going to the campus and the departure time coming back', () => {
    const root = fixture.nativeElement as HTMLElement;
    const label = () =>
      root
        .querySelector('app-datetime-field[presentation="time"] .text-label')
        ?.textContent?.trim();
    const impact = () => root.querySelector('.search-form__impact')?.textContent;
    fixture.detectChanges();

    // Sin dirección, el botón espera y el aviso dice qué se verá
    expect(impact()).toContain('Elige de dónde sales');
    expect(root.querySelector('ion-button[type="submit"]')?.hasAttribute('disabled')).toBe(true);

    form.form.patchValue({ place: ROQUETAS, parking: 'p1', time: '08:00' });
    fixture.detectChanges();

    expect(label()).toBe('Hora de llegada');
    // Con dirección y parking, lo que se ahorra (aproximado)
    expect(impact()).toContain('ahorras aproximadamente');

    form.form.controls.isToCampus.setValue(false);
    fixture.detectChanges();

    expect(form.timeType()).toBe('departure');
    expect(label()).toBe('Hora de salida');
  });

  it('asks to choose an address before searching', async () => {
    await form.handleSubmit();
    fixture.detectChanges();

    expect(navigate).not.toHaveBeenCalled();
    const field = (fixture.nativeElement as HTMLElement).querySelector('app-place-field ion-input');
    expect(field?.classList).toContain('ion-invalid');
  });

  it('does not search for more than 4 seats', async () => {
    form.form.patchValue({ place: ROQUETAS, seats: 5 });

    await form.handleSubmit();

    expect(navigate).not.toHaveBeenCalled();
  });

  it('adds and removes seats between 1 and 4 with the stepper', () => {
    const root = fixture.nativeElement as HTMLElement;
    const click = (label: string): void =>
      (root.querySelector(`app-seat-stepper button[aria-label="${label}"]`) as HTMLElement).click();

    click('Una plaza menos');
    expect(form.form.controls.seats.value).toBe(1);

    [1, 2, 3, 4].forEach(() => click('Una plaza más'));
    expect(form.form.controls.seats.value).toBe(4);
  });

  it('keeps the trip to the campus as the search and goes to Tu búsqueda', async () => {
    form.form.patchValue({
      place: ROQUETAS,
      parking: 'p1',
      date: '2026-10-27',
      time: '08:00',
      seats: 2,
    });

    await form.handleSubmit();

    expect(searchState.search()).toEqual({
      place: ROQUETAS,
      parking: PARKING_P1,
      direction: 'to-campus',
      date: '2026-10-27',
      time: '08:00',
      margin: 20,
      seats: 2,
    });
    expect(navigate).toHaveBeenCalledWith(['/tabs/search/results']);
  });

  it('goes from the campus when the direction is swapped', async () => {
    form.form.patchValue({ place: ROQUETAS, parking: 'p3' });
    form.form.controls.isToCampus.setValue(false);

    await form.handleSubmit();

    expect(searchState.search()).toEqual(
      expect.objectContaining({ parking: PARKING_P3, direction: 'from-campus' }),
    );
  });

  it('follows the last search, also when it changes elsewhere (Inicio)', () => {
    searchState.set(SEARCH);
    fixture.detectChanges();

    expect(form.form.getRawValue()).toEqual({
      place: ROQUETAS,
      parking: 'p3',
      isToCampus: false,
      date: '2026-10-28',
      time: '14:00',
      margin: 10,
      seats: 2,
    });
    expect(form.timeType()).toBe('departure');
  });

  it('empties again for a new search', () => {
    searchState.set(SEARCH);
    fixture.detectChanges();

    searchState.clear();
    fixture.detectChanges();

    expect(form.form.controls.place.value).toBeNull();
    expect(form.isToCampus()).toBe(true);
  });
});

describe('getDefaultTime', () => {
  it.each([
    ['10:52', '11:25'],
    ['10:55', '11:25'],
    ['08:00', '08:30'],
    ['23:20', '23:50'],
    ['23:40', '23:55'],
  ])('at %s, proposes %s (half an hour later)', (now, proposed) => {
    const [hours, minutes] = now.split(':').map(Number);

    expect(getDefaultTime(new Date(2026, 9, 27, hours, minutes))).toBe(proposed);
  });

  it('uses another lead when given (Publicar: one hour)', () => {
    expect(getDefaultTime(new Date(2026, 9, 27, 10, 52), 60)).toBe('11:55');
  });
});

describe('shiftTime', () => {
  it.each([
    ['08:00', -20, '07:40'],
    ['08:00', 20, '08:20'],
    ['00:10', -20, '23:50'],
    ['23:50', 30, '00:20'],
  ])('moves %s by %i minutes to %s', (time, minutes, shifted) => {
    expect(shiftTime(time, minutes)).toBe(shifted);
  });
});
