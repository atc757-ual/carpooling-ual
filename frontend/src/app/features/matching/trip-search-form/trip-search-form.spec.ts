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

  it('goes to the first parking, today from now with ±20 min and 1 seat, by default', () => {
    const { place, parking, isToCampus, time, margin, seats, date } = form.form.getRawValue();
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    expect(place).toBeNull();
    expect(parking).toBe('p1');
    expect(isToCampus).toBe(true);
    expect(form.timeType()).toBe('arrival');
    expect(time).toMatch(/^\d{2}:\d[05]$/);
    expect(margin).toBe(20);
    expect(seats).toBe(1);
    expect(date).toBe(`${today.getFullYear()}-${month}-${day}`);
  });

  it('clears the search and what was chosen', () => {
    searchState.set({ ...SEARCH, margin: 30, seats: 3 });
    fixture.detectChanges();

    form.clear();

    const { place, parking, isToCampus, margin, seats } = form.form.getRawValue();
    expect(searchState.search()).toBeNull();
    expect({ place, parking, isToCampus, margin, seats }).toEqual({
      place: null,
      parking: 'p1',
      isToCampus: true,
      margin: 20,
      seats: 1,
    });
  });

  it('offers the campus parkings', () => {
    const root = fixture.nativeElement as HTMLElement;
    const options = root.querySelectorAll(
      'ion-select[formControlName="parking"] ion-select-option',
    );

    expect(Array.from(options, (option) => option.textContent?.trim())).toEqual([
      'Campus UAL · Parking P1',
      'Campus UAL · Parking P3',
    ]);
  });

  it('swaps the direction: to the campus or back from it', () => {
    form.handleSwap();

    expect(form.isToCampus()).toBe(false);

    form.handleSwap();

    expect(form.isToCampus()).toBe(true);
  });

  it('shows the times that the margin covers', () => {
    form.form.patchValue({ time: '08:00' });

    expect(form.timeWindow()).toEqual({ from: '07:40', to: '08:20' });

    form.form.patchValue({ time: '09:15', margin: 30 });

    expect(form.timeWindow()).toEqual({ from: '08:45', to: '09:45' });
  });

  it('asks for the arrival time going to the campus and the departure time coming back', () => {
    const root = fixture.nativeElement as HTMLElement;
    const label = () =>
      root.querySelector('[id^="search-time-"][id$="-label"]')?.textContent?.trim();
    const summary = () => root.querySelector('.search-form__summary')?.textContent;
    form.form.patchValue({ time: '08:00' });
    fixture.detectChanges();

    expect(label()).toBe('Hora de llegada');
    expect(summary()).toContain('llegan al campus entre las 07:40 y las 08:20');

    form.handleSwap();
    fixture.detectChanges();

    expect(form.timeType()).toBe('departure');
    expect(label()).toBe('Hora de salida');
    expect(summary()).toContain('salen del campus');
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

  it('adds and removes seats between 1 and 4', () => {
    expect(form.canRemoveSeat()).toBe(false);

    form.changeSeats(-1);

    expect(form.form.controls.seats.value).toBe(1);

    [1, 1, 1, 1].forEach((delta) => form.changeSeats(delta));

    expect(form.form.controls.seats.value).toBe(4);
    expect(form.canAddSeat()).toBe(false);
    expect(form.canRemoveSeat()).toBe(true);
  });

  it('keeps the trip to the campus as the search and goes to Buscar', async () => {
    form.form.patchValue({ place: ROQUETAS, date: '2026-10-27', time: '08:00', seats: 2 });

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
    expect(navigate).toHaveBeenCalledWith(['/tabs/search']);
  });

  it('goes from the campus when the direction is swapped', async () => {
    form.form.patchValue({ place: ROQUETAS, parking: 'p3' });
    form.handleSwap();

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
