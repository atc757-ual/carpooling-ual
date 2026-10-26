import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { CAMPUS, shiftTime, TripSearchForm } from './trip-search-form';

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

  it('goes to the campus, tomorrow at 8:00 with ±20 min and 1 seat, by default', () => {
    const { destination, arrival, margin, seats, date } = form.form.getRawValue();

    expect(destination).toBe(CAMPUS);
    expect(arrival).toBe('08:00');
    expect(margin).toBe(20);
    expect(seats).toBe(1);
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('swaps the origin and the destination', () => {
    form.form.controls.origin.setValue('Roquetas de Mar');

    form.handleSwap();

    expect(form.form.controls.origin.value).toBe(CAMPUS);
    expect(form.form.controls.destination.value).toBe('Roquetas de Mar');
  });

  it('shows the arrivals that the margin covers', () => {
    expect(form.arrivalWindow()).toEqual({ from: '07:40', to: '08:20' });

    form.form.patchValue({ arrival: '09:15', margin: 30 });

    expect(form.arrivalWindow()).toEqual({ from: '08:45', to: '09:45' });
  });

  it('asks for the origin before searching', async () => {
    await form.handleSubmit();

    expect(navigate).not.toHaveBeenCalled();
    expect(form.form.controls.origin.touched).toBe(true);
  });

  it('does not search for more than 4 seats', async () => {
    form.form.patchValue({ origin: 'Roquetas de Mar', seats: 5 });

    await form.handleSubmit();

    expect(navigate).not.toHaveBeenCalled();
  });

  it('goes to Buscar with the search in the URL', async () => {
    form.form.patchValue({ origin: '  Roquetas de Mar ', date: '2026-10-27', seats: 2 });

    await form.handleSubmit();

    expect(navigate).toHaveBeenCalledWith(['/tabs/search'], {
      queryParams: {
        from: 'Roquetas de Mar',
        to: CAMPUS,
        date: '2026-10-27',
        arrival: '08:00',
        margin: 20,
        seats: 2,
      },
    });
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
