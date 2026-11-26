import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import { Capacitor } from '@capacitor/core';
import { Component, computed, DestroyRef, forwardRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { EMPTY, fromEvent, map } from 'rxjs';
import {
  ControlValueAccessor,
  FormControl,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
} from '@angular/forms';
import { IonDatetime, IonIcon, IonModal, IonPopover } from '@ionic/angular';
import { TRANSLOCO_TRANSPILER, TranslocoService } from '@jsverse/transloco';
import { calendarOutline, timeOutline } from 'ionicons/icons';
import { toIsoDate } from '../../../utils/date.util';
import { appLanguage } from '../../../../core/i18n/app-locale';

export type DatetimePresentation = 'date' | 'time';

// De 5 en 5 minutos
const MINUTE_VALUES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
// Desde aquí, el desplegable bajo el campo (escritorio)
const DESKTOP_QUERY = '(min-width: 768px)';
// Para que cada campo tenga sus propios id (en Inicio y Buscar puede haber
// dos formularios a la vez, y con el mismo id un botón abriría el selector
// del otro)
let nextId = 0;

// «Hoy», «Mañana» o, desde el tercer día, «jue, 30 oct» (o «Thu, 30 Oct» en
// inglés). Por defecto, en el idioma activo de la app
export function formatDateLabel(
  isoDate: string,
  today = new Date(),
  lang: 'es' | 'en' = appLanguage(),
): string {
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (isoDate === toIsoDate(today)) {
    return lang === 'en' ? 'Today' : 'Hoy';
  }
  if (isoDate === toIsoDate(tomorrow)) {
    return lang === 'en' ? 'Tomorrow' : 'Mañana';
  }
  const locale = lang === 'en' ? 'en-GB' : 'es-ES';
  const formatter = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return formatter.format(new Date(`${isoDate}T00:00:00`));
}

// Fecha o hora (guía, «Campos»), con la etiqueta encima. Un botón con el valor
// y su icono («Hoy», «Mañana» o «jue, 30 oct») que abre el calendario de Ionic
// (lunes primero) o las ruedas de la hora en 24 h, de 5 en 5 minutos, con
// «Cancelar» y «Aceptar» de la app (los de Ionic van en mayúsculas y no se
// pueden cambiar): en el móvil, en una hoja desde abajo; en el escritorio, en
// un desplegable bajo el campo. Valor: «2026-10-27» o «08:00»
@Component({
  selector: 'app-datetime-field',
  imports: [NgTemplateOutlet, ReactiveFormsModule, IonDatetime, IonIcon, IonModal, IonPopover],
  templateUrl: './datetime-field.html',
  styleUrl: './datetime-field.scss',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DatetimeField), multi: true },
  ],
})
export class DatetimeField implements ControlValueAccessor {
  private readonly transpiler = inject(TRANSLOCO_TRANSPILER, { optional: true });
  private readonly transloco = this.transpiler
    ? inject(TranslocoService, { optional: true })
    : null;
  private readonly translation = toSignal(this.transloco?.selectTranslation() ?? EMPTY);

  readonly label = input.required<string>();
  readonly presentation = input<DatetimePresentation>('date');
  // Límites de la fecha (ISO); sin efecto en la hora
  readonly min = input<string>();
  readonly max = input<string>();

  // El valor va al ion-datetime con su propio control (el value accessor de
  // Ionic, el mismo que se usaba antes en cada formulario)
  protected readonly control = new FormControl('', { nonNullable: true });
  protected readonly icon = computed(() =>
    this.presentation() === 'date' ? calendarOutline : timeOutline,
  );
  protected readonly minuteValues = MINUTE_VALUES;
  private readonly id = `datetime-field-${++nextId}`;
  protected readonly pickerId = `${this.id}-picker`;
  protected readonly labelId = `${this.id}-label`;

  // El valor como signal, para el texto del botón
  private readonly value = signal('');
  private readonly document = inject(DOCUMENT);
  protected readonly displayValue = computed(() => {
    const value = this.value();
    if (!value) {
      return '';
    }
    const lang = this.transloco?.getActiveLang() === 'en' ? 'en' : 'es';
    return this.presentation() === 'date' ? formatDateLabel(value, new Date(), lang) : value;
  });

  protected readonly pickerLocale = computed(() =>
    this.transloco?.getActiveLang() === 'en' ? 'en-GB' : 'es-ES',
  );

  protected readonly cancelLabel = computed(() => {
    return (this.translation() ? this.transloco?.translate('common.cancel') : null) ?? 'Cancelar';
  });

  protected readonly acceptLabel = computed(() => {
    return (this.translation() ? this.transloco?.translate('common.accept') : null) ?? 'Aceptar';
  });
  // En el navegador de escritorio, el desplegable; en el móvil, la hoja. Sigue
  // al ancho si cambia el tamaño de la ventana. En la app instalada
  // (Capacitor), siempre la hoja, también en tabletas
  private readonly desktopQuery = Capacitor.isNativePlatform()
    ? undefined
    : this.document.defaultView?.matchMedia?.(DESKTOP_QUERY);
  protected readonly isDesktop = toSignal(
    this.desktopQuery
      ? fromEvent<MediaQueryListEvent>(this.desktopQuery, 'change').pipe(
          map(({ matches }) => matches),
        )
      : EMPTY,
    { initialValue: this.desktopQuery?.matches ?? false },
  );
  // La hoja del móvil o el desplegable del escritorio, abiertos al pulsar el botón
  protected readonly isOpen = signal(false);
  // El elemento bajo el que se abre el desplegable: el botón (Ionic lo toma
  // del target del «evento»; con el clic sería el icono si se pulsa encima)
  protected readonly anchor = signal<{ target: HTMLElement } | undefined>(undefined);

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor() {
    this.control.valueChanges.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe((value) => {
      this.value.set(value);
      this.onChange(value);
      this.onTouched();
    });
  }

  protected handleOpen(trigger: HTMLElement): void {
    this.anchor.set({ target: trigger });
    this.isOpen.set(true);
  }

  // Escritorio: el día elegido cierra el desplegable (en el móvil cierra la
  // hoja su «Aceptar»)
  protected handleDatePicked(): void {
    if (this.isDesktop()) {
      this.isOpen.set(false);
    }
  }

  writeValue(value: string | null): void {
    this.control.setValue(value ?? '', { emitEvent: false });
    this.value.set(value ?? '');
  }

  registerOnChange(onChange: (value: string) => void): void {
    this.onChange = onChange;
  }

  registerOnTouched(onTouched: () => void): void {
    this.onTouched = onTouched;
  }

  // La firma la impone ControlValueAccessor: el control interno sigue al de fuera
  setDisabledState(isDisabled: boolean): void {
    const toggle = isDisabled ? 'disable' : 'enable';
    this.control[toggle]({ emitEvent: false });
  }
}
