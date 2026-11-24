import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { provideIonicAngular } from '@ionic/angular';
import { provideAppTransloco } from '../../../core/i18n/testing-transloco';
import { RepeatDaysControls, RepeatDaysField, repeatSummary } from './repeat-days-field';

describe('RepeatDaysField', () => {
  let fixture: ComponentFixture<RepeatDaysField>;
  let controls: RepeatDaysControls;

  function render(hasReturn = false): HTMLElement {
    controls = {
      isRepeating: new FormControl(false, { nonNullable: true }),
      weekdays: new FormControl<number[]>([], { nonNullable: true }),
      until: new FormControl('', { nonNullable: true }),
    };
    TestBed.configureTestingModule({
      imports: [RepeatDaysField],
      providers: [provideAppTransloco(), provideIonicAngular()],
    });
    fixture = TestBed.createComponent(RepeatDaysField);
    fixture.componentRef.setInput('controls', controls);
    // Lunes 23/11/2026
    fixture.componentRef.setInput('firstDate', '2026-11-23');
    fixture.componentRef.setInput('hasReturn', hasReturn);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('says how many trips will be published, with or without the return', () => {
    TestBed.configureTestingModule({ providers: [provideAppTransloco()] });
    TestBed.runInInjectionContext(() => {
      expect(repeatSummary(2, false)).toBe('Se publicarán 3 viajes, uno cada día.');
      expect(repeatSummary(2, true)).toBe('Se publicarán 6 viajes: la ida y la vuelta de 3 días.');
    });
  });

  it('shows only the box until it is ticked', () => {
    const root = render();
    expect(root.querySelectorAll('ion-checkbox')).toHaveLength(1);
    expect(root.querySelector('fieldset')).toBeNull();
  });

  it('proposes the weekday of the trip and lists the days with their full name', () => {
    const root = render();

    controls.isRepeating.setValue(true);
    fixture.componentInstance.handleRepeat(true);
    fixture.detectChanges();

    expect(controls.weekdays.value).toEqual([1]);
    expect(controls.until.value).not.toBe('');
    expect(root.querySelector('legend')?.textContent).toContain('Qué días');
    const days = root.querySelectorAll('.repeat-days__day');
    expect(days).toHaveLength(7);
    expect(days[2].querySelector('.visually-hidden')?.textContent).toBe('miércoles');
    expect(days[2].querySelector('[aria-hidden="true"]')?.textContent).toBe('X');
  });

  it('adds and removes weekdays and updates the summary', () => {
    const root = render(true);
    controls.until.setValue('2026-12-02');
    controls.isRepeating.setValue(true);
    fixture.componentInstance.handleRepeat(true);

    fixture.componentInstance.handleDay(3, true);
    fixture.detectChanges();
    expect(controls.weekdays.value).toEqual([1, 3]);
    expect(fixture.componentInstance.dates()).toEqual(['2026-11-25', '2026-11-30', '2026-12-02']);
    expect(root.querySelector('[aria-live="polite"]')?.textContent).toContain('8 viajes');

    fixture.componentInstance.handleDay(1, false);
    fixture.componentInstance.handleDay(3, false);
    fixture.detectChanges();
    expect(root.querySelector('[aria-live="polite"]')?.textContent).toContain(
      'Elige al menos un día',
    );
  });

  it('keeps what was chosen when it is ticked again', () => {
    render();
    controls.weekdays.setValue([5]);
    controls.until.setValue('2026-12-04');

    fixture.componentInstance.handleRepeat(true);
    fixture.componentInstance.handleRepeat(false);

    expect(controls.weekdays.value).toEqual([5]);
    expect(controls.until.value).toBe('2026-12-04');
  });
});
