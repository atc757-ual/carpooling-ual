import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Capacitor } from '@capacitor/core';
import { provideIonicAngular } from '@ionic/angular';
import { TranslocoService } from '@jsverse/transloco';
import { vi } from 'vitest';
import { provideTranslocoTestingSupport } from '../../../../core/i18n/testing-transloco';
import { DatetimeField, DatetimePresentation, formatDateLabel } from './datetime-field';

@Component({
  imports: [ReactiveFormsModule, DatetimeField],
  template: `
    <app-datetime-field [formControl]="value" [label]="label()" [presentation]="presentation()" />
  `,
})
class Host {
  readonly value = new FormControl('2026-10-27', { nonNullable: true });
  readonly label = signal('Fecha');
  readonly presentation = signal<DatetimePresentation>('date');
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

  it('uses the native field of the browser, with its value and limits', () => {
    const root = render(false);
    const input = root.querySelector<HTMLInputElement>('input.datetime-field__native');

    expect(input?.type).toBe('date');
    expect(input?.value).toBe('2026-10-27');
    expect(root.querySelector('ion-modal')).toBeNull();
  });

  // El icono a la izquierda, como en el móvil: abre el selector del navegador
  it('opens the picker of the browser from its icon on the left', () => {
    const root = render(false);
    const input = root.querySelector<HTMLInputElement>('input.datetime-field__native')!;
    const showPicker = vi.fn();
    input.showPicker = showPicker;

    root.querySelector<HTMLElement>('.datetime-field__native-icon')?.click();
    expect(showPicker).toHaveBeenCalledTimes(1);

    // Sin showPicker, el foco en el campo, que se puede escribir
    input.showPicker = undefined as unknown as () => void;
    root.querySelector<HTMLElement>('.datetime-field__native-icon')?.click();
    expect(document.activeElement).toBe(input);
  });

  it('keeps the Ionic picker in the installed app, whatever the width', () => {
    const root = render(true);

    expect(root.querySelector('input.datetime-field__native')).toBeNull();
    expect(root.querySelector('button.datetime-field__box')).not.toBeNull();
  });
});
