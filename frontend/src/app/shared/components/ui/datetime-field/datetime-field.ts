import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, DestroyRef, forwardRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ControlValueAccessor,
  FormControl,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
} from '@angular/forms';
import { IonDatetime, IonIcon, IonModal } from '@ionic/angular';
import { calendarOutline, timeOutline } from 'ionicons/icons';

export type DatetimePresentation = 'date' | 'time';

// De 5 en 5 minutos
const MINUTE_VALUES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
// Para que cada campo tenga sus propios id (en Inicio y Buscar puede haber
// dos formularios a la vez, y con el mismo id un botón abriría el selector
// del otro)
let nextId = 0;
const DATE_LABEL = new Intl.DateTimeFormat('es-ES', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

// Fecha local en ISO (2026-10-27)
function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

// «Hoy», «Mañana» o, desde el tercer día, «jue, 30 oct»
export function formatDateLabel(isoDate: string, today = new Date()): string {
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (isoDate === toIsoDate(today)) {
    return 'Hoy';
  }
  if (isoDate === toIsoDate(tomorrow)) {
    return 'Mañana';
  }
  return DATE_LABEL.format(new Date(`${isoDate}T00:00:00`));
}

// Fecha o hora con el selector nativo de Ionic (guía, «Campos»): etiqueta
// encima, el botón con el valor y su icono, y una ventana con el calendario
// en español (lunes primero) o las ruedas de la hora en 24 h, de 5 en 5
// minutos, con «Cancelar» y «Aceptar» de la app (los de Ionic van en
// mayúsculas y no se pueden cambiar). La fecha se lee «Hoy», «Mañana» o
// «jue, 30 oct». Valor: «2026-10-27» o «08:00»
@Component({
  selector: 'app-datetime-field',
  imports: [NgTemplateOutlet, ReactiveFormsModule, IonDatetime, IonIcon, IonModal],
  templateUrl: './datetime-field.html',
  styleUrl: './datetime-field.scss',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DatetimeField), multi: true },
  ],
})
export class DatetimeField implements ControlValueAccessor {
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
  protected readonly displayValue = computed(() => {
    const value = this.value();
    if (!value) {
      return '';
    }
    return this.presentation() === 'date' ? formatDateLabel(value) : value;
  });
  // La ventana del selector, abierta al pulsar el botón
  protected readonly isOpen = signal(false);

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor() {
    this.control.valueChanges.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe((value) => {
      this.value.set(value);
      this.onChange(value);
      this.onTouched();
    });
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
