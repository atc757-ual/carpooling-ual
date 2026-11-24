import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { provideAppTransloco } from '../../../../core/i18n/testing-transloco';
import { WeekdayPicker } from './weekday-picker';

describe('WeekdayPicker', () => {
  function render(value: number[]) {
    TestBed.configureTestingModule({
      imports: [WeekdayPicker],
      providers: [provideAppTransloco(), provideIonicAngular()],
    });
    const fixture = TestBed.createComponent(WeekdayPicker);
    fixture.componentRef.setInput('legend', 'Qué días');
    fixture.componentRef.setInput('value', value);
    fixture.detectChanges();
    return fixture;
  }

  it('shows the seven days with their letter and their full name', () => {
    const root = render([1, 3]).nativeElement as HTMLElement;
    const days = root.querySelectorAll('.weekday-picker__day');

    expect(root.querySelector('legend')?.textContent).toBe('Qué días');
    expect(days).toHaveLength(7);
    expect(days[2].querySelector('[aria-hidden="true"]')?.textContent).toBe('X');
    expect(days[2].querySelector('.visually-hidden')?.textContent).toBe('miércoles');
    expect((days[2] as HTMLIonCheckboxElement).checked).toBe(true);
    expect((days[1] as HTMLIonCheckboxElement).checked).toBe(false);
  });

  it('adds a day in order and removes it', () => {
    const fixture = render([1, 5]);
    const changed = vi.fn();
    fixture.componentInstance.valueChange.subscribe(changed);

    fixture.componentInstance.handleDay(3, true);
    fixture.componentInstance.handleDay(5, false);

    expect(changed).toHaveBeenNthCalledWith(1, [1, 3, 5]);
    expect(changed).toHaveBeenNthCalledWith(2, [1]);
  });
});
