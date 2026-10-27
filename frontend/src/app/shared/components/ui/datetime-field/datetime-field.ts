import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, DestroyRef, forwardRef, inject, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ControlValueAccessor,
  FormControl,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
} from '@angular/forms';
import { IonDatetime, IonDatetimeButton, IonIcon, IonModal } from '@ionic/angular';
import { calendarOutline, timeOutline } from 'ionicons/icons';

export type DatetimePresentation = 'date' | 'time';

// De 5 en 5 minutos
const MINUTE_VALUES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
// Para que cada campo tenga sus propios id (en Inicio y Buscar puede haber
// dos formularios a la vez, y con el mismo id un botón abriría el selector
// del otro)
let nextId = 0;

// Fecha o hora con el selector nativo de Ionic (guía, «Campos»): etiqueta
// encima, el botón con el valor y su icono, y una ventana con el calendario
// en español (lunes primero) o las ruedas de la hora en 24 h, de 5 en 5
// minutos, con «Cancelar» y «Aceptar» de la app (los de Ionic van en
// mayúsculas y no se pueden cambiar). Valor: «2026-10-27» o «08:00»
@Component({
  selector: 'app-datetime-field',
  imports: [
    NgTemplateOutlet,
    ReactiveFormsModule,
    IonDatetime,
    IonDatetimeButton,
    IonIcon,
    IonModal,
  ],
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

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor() {
    this.control.valueChanges.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe((value) => {
      this.onChange(value);
      this.onTouched();
    });
  }

  writeValue(value: string | null): void {
    this.control.setValue(value ?? '', { emitEvent: false });
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
