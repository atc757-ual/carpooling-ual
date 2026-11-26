import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Capacitor } from '@capacitor/core';
import { provideIonicAngular } from '@ionic/angular';
import { TranslocoService } from '@jsverse/transloco';
import { vi } from 'vitest';
import { setAppLocale } from '../../../../core/i18n/app-locale';
import { provideTranslocoTestingSupport } from '../../../../core/i18n/testing-transloco';
import { DatetimeField, DatetimePresentation, formatDateLabel } from './datetime-field';

@Component({
  imports: [ReactiveFormsModule, DatetimeField],
  template: `
    <app-datetime-field
      [formControl]="value"
      [label]="label()"
      [presentation]="presentation()"
      [min]="min()"
    />
  `,
})
class Host {
  readonly value = new FormControl('2026-10-27', { nonNullable: true });
  readonly label = signal('Fecha');
  readonly presentation = signal<DatetimePresentation>('date');
  readonly min = signal<string | undefined>(undefined);
}

describe('DatetimeField', () => {
  let host: Host;
  let field: DatetimeField;
  let root: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [Host], providers: [provideIonicAngular()] });
    const fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    root = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    field = fixture.debugElement.children[0].componentInstance as DatetimeField;
  });

  it('names the button with its label and its value, and opens the picker', () => {
    const label = root.querySelector('.text-label');
    const button = root.querySelector<HTMLButtonElement>('button.datetime-field__box');
    const value = root.querySelector('.datetime-field__value');

    expect(label?.textContent?.trim()).toBe('Fecha');
    expect(value?.textContent?.trim()).toBe('mar, 27 oct');
    expect(button?.getAttribute('aria-labelledby')).toBe(`${label?.id} ${value?.id}`);

    button?.click();
    TestBed.tick();

    expect((root.querySelector('ion-modal') as HTMLIonModalElement).isOpen).toBe(true);
  });

  // En el móvil, la hoja la cierra su «Aceptar», no el día elegido
  it('keeps the sheet open when a day is picked on a phone', () => {
    root.querySelector<HTMLButtonElement>('button.datetime-field__box')?.click();
    TestBed.tick();

    root.querySelector('ion-datetime')?.dispatchEvent(new CustomEvent('ionChange'));
    TestBed.tick();

    expect((root.querySelector('ion-modal') as HTMLIonModalElement).isOpen).toBe(true);
  });

  // Con un límite con fecha, la rueda recibe la hora con esa fecha (para que
  // Ionic desactive las anteriores ese día); el formulario, siempre «HH:mm»
  it('gives the wheel the date of the limit and keeps the time as HH:mm', () => {
    const api = field as unknown as {
      timePickerValue: () => string | undefined;
      handleTimeChange: (value: string | string[] | null | undefined) => void;
    };
    host.presentation.set('time');
    host.value.setValue('11:05');
    TestBed.tick();
    expect(api.timePickerValue()).toBe('11:05');

    host.min.set('2026-11-26T10:35');
    TestBed.tick();
    expect(api.timePickerValue()).toBe('2026-11-26T11:05');

    api.handleTimeChange('2026-11-26T12:40');
    expect(host.value.value).toBe('12:40');
    api.handleTimeChange('09:15:00');
    expect(host.value.value).toBe('09:15');
    api.handleTimeChange(null);
    api.handleTimeChange(['10:00']);
    expect(host.value.value).toBe('09:15');
  });

  it('shows the time as it is, and nothing without a value', () => {
    host.presentation.set('time');
    host.value.setValue('07:40');
    TestBed.tick();
    expect(root.querySelector('.datetime-field__value')?.textContent?.trim()).toBe('07:40');

    host.value.setValue('');
    TestBed.tick();
    expect(root.querySelector('.datetime-field__value')?.textContent?.trim()).toBe('');
  });

  it('reads today and tomorrow, and the date from the third day', () => {
    const today = new Date('2026-10-28T10:00:00');

    expect(formatDateLabel('2026-10-28', today)).toBe('Hoy');
    expect(formatDateLabel('2026-10-29', today)).toBe('Mañana');
    expect(formatDateLabel('2026-10-30', today)).toBe('vie, 30 oct');
    expect(formatDateLabel('2026-10-28', today, 'en')).toBe('Today');
    expect(formatDateLabel('2026-10-29', today, 'en')).toBe('Tomorrow');
    expect(formatDateLabel('2026-10-30', today, 'en')).toBe('Fri 30 Oct');
  });

  it('reads the date in the language of the app when none is given', () => {
    const today = new Date('2026-10-28T10:00:00');
    setAppLocale('en');
    try {
      expect(formatDateLabel('2026-10-29', today)).toBe('Tomorrow');
    } finally {
      setAppLocale('es');
    }
    expect(formatDateLabel('2026-10-29', today)).toBe('Mañana');
  });

  it('passes the value both ways', () => {
    const control = (field as unknown as { control: FormControl<string> }).control;
    expect(control.value).toBe('2026-10-27');

    control.setValue('2026-10-30');
    expect(host.value.value).toBe('2026-10-30');
    expect(host.value.touched).toBe(true);

    host.value.setValue('2026-11-02');
    expect(control.value).toBe('2026-11-02');
  });

  it('follows the label and the disabled state', () => {
    host.label.set('Hora de salida');
    host.presentation.set('time');
    host.value.disable();
    TestBed.tick();

    const control = (field as unknown as { control: FormControl<string> }).control;
    expect(root.querySelector('.text-label')?.textContent?.trim()).toBe('Hora de salida');
    expect(control.disabled).toBe(true);
    host.value.enable();
    expect(control.disabled).toBe(false);
  });

  describe('with Transloco in English', () => {
    it('translates picker buttons and formatted dates into English', async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [Host],
        providers: [
          provideIonicAngular(),
          provideTranslocoTestingSupport({
            en: {
              common: {
                cancel: 'Cancel',
                accept: 'OK',
              },
            },
          }),
        ],
      });
      const transloco = TestBed.inject(TranslocoService);
      transloco.setActiveLang('en');
      const fixture = TestBed.createComponent(Host);
      const hostComponent = fixture.componentInstance;
      hostComponent.value.setValue('2026-10-27');
      await fixture.whenStable();
      fixture.detectChanges();

      const fieldInstance = fixture.debugElement.children[0].componentInstance as DatetimeField;
      expect((fieldInstance as unknown as { cancelLabel: () => string }).cancelLabel()).toBe(
        'Cancel',
      );
      expect((fieldInstance as unknown as { acceptLabel: () => string }).acceptLabel()).toBe('OK');
      expect((fieldInstance as unknown as { pickerLocale: () => string }).pickerLocale()).toBe(
        'en-GB',
      );
    });
  });
});

describe('DatetimeField on a desktop browser', () => {
  // El ancho de escritorio (desde 768px), simulado
  function render(isNativeApp: boolean): HTMLElement {
    // jsdom no tiene matchMedia: se pone uno que responde «escritorio»
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(isNativeApp);
    TestBed.configureTestingModule({ imports: [Host], providers: [provideIonicAngular()] });
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // El mismo botón que en el móvil; el selector, en un desplegable bajo él
  it('opens the picker in a dropdown under the button, without a backdrop', () => {
    const root = render(false);
    const button = root.querySelector<HTMLButtonElement>('button.datetime-field__box')!;
    const popover = root.querySelector('ion-popover') as HTMLIonPopoverElement;

    expect(root.querySelector('ion-modal')).toBeNull();
    expect(popover.showBackdrop).toBe(false);

    button.click();
    TestBed.tick();

    expect(popover.isOpen).toBe(true);
    expect((popover.event as { target: HTMLElement }).target).toBe(button);
  });

  it('closes the dropdown when a day is picked', () => {
    const root = render(false);
    root.querySelector<HTMLButtonElement>('button.datetime-field__box')!.click();
    TestBed.tick();

    root.querySelector('ion-datetime')!.dispatchEvent(new CustomEvent('ionChange'));
    TestBed.tick();

    expect((root.querySelector('ion-popover') as HTMLIonPopoverElement).isOpen).toBe(false);
  });

  it('keeps the sheet in the installed app, whatever the width', () => {
    const root = render(true);

    expect(root.querySelector('ion-popover')).toBeNull();
    expect(root.querySelector('ion-modal')).not.toBeNull();
  });
});
