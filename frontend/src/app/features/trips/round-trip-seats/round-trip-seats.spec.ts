import { provideAppTransloco } from '../../../core/i18n/testing-transloco';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { provideIonicAngular } from '@ionic/angular';
import { RoundTripSeats } from './round-trip-seats';

describe('RoundTripSeats', () => {
  function render(seats = 2, returnSeats = 2) {
    TestBed.configureTestingModule({
      imports: [RoundTripSeats],
      providers: [provideAppTransloco(), provideIonicAngular()],
    });
    const fixture = TestBed.createComponent(RoundTripSeats);
    const controls = {
      seats: new FormControl(seats, { nonNullable: true }),
      returnSeats: new FormControl(returnSeats, { nonNullable: true }),
    };
    fixture.componentRef.setInput('seats', controls.seats);
    fixture.componentRef.setInput('returnSeats', controls.returnSeats);
    fixture.componentRef.setInput('max', 4);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const legends = () =>
      [...root.querySelectorAll('legend')].map((legend) => legend.textContent?.trim());
    return { fixture, controls, root, legends };
  }

  it('offers one selector for both ways by default, and the return follows', () => {
    const { controls, root, legends } = render();

    expect(root.querySelector('ion-checkbox')?.textContent).toContain(
      'Mismo número de plazas en la ida y la vuelta',
    );
    expect(legends()).toEqual(['Plazas (ida y vuelta)']);
    controls.seats.setValue(3);
    expect(controls.returnSeats.value).toBe(3);
  });

  it('shows the way and the return side by side when they differ', () => {
    const { fixture, controls, root, legends } = render();

    fixture.componentInstance.handleSameChange(false);
    fixture.detectChanges();

    expect(legends()).toEqual(['Ida', 'Vuelta']);
    expect(root.querySelectorAll('.round-trip-seats__pair .seat-stepper__icon')).toHaveLength(2);
    controls.seats.setValue(3);
    expect(controls.returnSeats.value).toBe(2);

    // Al volver a marcarla, la vuelta copia la ida
    fixture.componentInstance.handleSameChange(true);
    expect(controls.returnSeats.value).toBe(3);
  });

  it('keeps them apart when coming back with different seats', () => {
    const { legends } = render(3, 1);

    expect(legends()).toEqual(['Ida', 'Vuelta']);
  });
});
