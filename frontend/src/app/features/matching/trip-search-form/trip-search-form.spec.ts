import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { getDefaultTime, shiftTime, TripSearchForm } from './trip-search-form';

const NORTH = 'Campus UAL · Ingreso norte';
const SOUTH = 'Campus UAL · Ingreso sur';

describe('TripSearchForm', () => {
  let fixture: ComponentFixture<TripSearchForm>;
  let form: TripSearchForm;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TripSearchForm],
      providers: [provideIonicAngular(), provideRouter([])],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(TripSearchForm);
    form = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('goes to the north entrance, today from now with ±20 min and 1 seat, by default', () => {
    const { entrance, isToCampus, time, margin, seats, date } = form.form.getRawValue();
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    expect(entrance).toBe('north');
    expect(isToCampus).toBe(true);
    expect(form.timeType()).toBe('arrival');
    expect(time).toMatch(/^\d{2}:\d[05]$/);
    expect(margin).toBe(20);
    expect(seats).toBe(1);
    expect(date).toBe(`${today.getFullYear()}-${month}-${day}`);
  });

  it('offers the three campus entrances to everyone', () => {
    const root = fixture.nativeElement as HTMLElement;
    const options = root.querySelectorAll(
      'ion-select[formControlName="entrance"] ion-select-option',
    );

    expect(Array.from(options, (option) => option.textContent?.trim())).toEqual([
      'Campus UAL · Ingreso norte',
      'Campus UAL · Ingreso sur',
      'Campus UAL · Ingreso este',
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
    const label = () => root.querySelector('#search-time-label')?.textContent?.trim();
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

  it('asks for the place before searching', async () => {
    await form.handleSubmit();

    expect(navigate).not.toHaveBeenCalled();
    expect(form.form.controls.place.touched).toBe(true);
  });

  it('does not search for more than 4 seats', async () => {
    form.form.patchValue({ place: 'Roquetas de Mar', seats: 5 });

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

  it('goes to Buscar with the trip to the campus in the URL', async () => {
    form.form.patchValue({
      place: '  Roquetas de Mar ',
      date: '2026-10-27',
      time: '08:00',
      seats: 2,
    });

    await form.handleSubmit();

    expect(navigate).toHaveBeenCalledWith(['/tabs/search'], {
      queryParams: {
        from: 'Roquetas de Mar',
        to: NORTH,
        date: '2026-10-27',
        time: '08:00',
        timeType: 'arrival',
        margin: 20,
        seats: 2,
      },
    });
  });

  it('goes from the campus when the direction is swapped', async () => {
    form.form.patchValue({ place: 'Roquetas de Mar', entrance: 'south' });
    form.handleSwap();

    await form.handleSubmit();

    expect(navigate).toHaveBeenCalledWith(['/tabs/search'], {
      queryParams: expect.objectContaining({
        from: SOUTH,
        to: 'Roquetas de Mar',
        timeType: 'departure',
      }),
    });
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
