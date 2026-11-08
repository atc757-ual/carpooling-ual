import { Component, computed, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { IonContent, IonIcon, IonPopover } from '@ionic/angular';
import { caretDownOutline } from 'ionicons/icons';
import { DEFAULT_PLATE_COUNTRY, PLATE_COUNTRY_OPTIONS } from '../../../utils/plate-country.util';

let nextId = 0;

// País de la matrícula: un campo con la bandera y el nombre que abre, pegada
// debajo y de su mismo ancho, la lista de países con su bandera (como el
// prefijo del teléfono; nunca como una ventana encima de otra). Propio y no
// ion-select porque sus opciones solo admiten texto. Se usa como cualquier
// campo de un formulario reactivo: <app-plate-country-select formControlName="plateCountry" />
@Component({
  selector: 'app-plate-country-select',
  imports: [IonPopover, IonContent, IonIcon],
  templateUrl: './plate-country-select.html',
  styleUrl: './plate-country-select.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PlateCountrySelect),
      multi: true,
    },
  ],
})
export class PlateCountrySelect implements ControlValueAccessor {
  // Nombre del campo para el lector de pantalla
  readonly label = input('País de la matrícula');

  readonly value = signal(DEFAULT_PLATE_COUNTRY);
  readonly isOpen = signal(false);
  readonly isDisabled = signal(false);
  readonly selected = computed(
    () =>
      PLATE_COUNTRY_OPTIONS.find(({ code }) => code === this.value()) ?? PLATE_COUNTRY_OPTIONS[0],
  );

  // El desplegable se abre desde el campo (trigger), que necesita un id único
  protected readonly triggerId = `plate-country-${nextId++}`;
  protected readonly countries = PLATE_COUNTRY_OPTIONS;
  protected readonly caretIcon = caretDownOutline;

  private onChange: (code: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  // La bandera de flag-icons va en minúsculas (fi-es)
  protected flagOf(code: string): string {
    return `fi fi-${code.toLowerCase()}`;
  }

  handleChoose(code: string): void {
    this.value.set(code);
    this.onChange(code);
    this.onTouched();
  }

  writeValue(code: string | null): void {
    this.value.set(code ?? DEFAULT_PLATE_COUNTRY);
  }

  registerOnChange(onChange: (code: string) => void): void {
    this.onChange = onChange;
  }

  registerOnTouched(onTouched: () => void): void {
    this.onTouched = onTouched;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
  }
}
