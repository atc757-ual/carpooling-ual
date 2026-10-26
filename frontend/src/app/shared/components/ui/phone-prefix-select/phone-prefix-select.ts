import { Component, computed, forwardRef, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { IonContent, IonIcon, IonPopover } from '@ionic/angular';
import { caretDownOutline } from 'ionicons/icons';
import { getPrefixCountry, PHONE_PREFIXES, SPANISH_PREFIX } from '../../../utils/phone-prefixes';

let nextId = 0;

// Prefijo del país del teléfono: un botón con la bandera y el código (va
// dentro del campo del número, slot="start") que abre hacia abajo la lista de
// prefijos, cada uno con su bandera. Propio y no ion-select porque las
// opciones de ion-select solo admiten texto. Se usa como cualquier campo de un
// formulario reactivo: <app-phone-prefix-select formControlName="phonePrefix" />
@Component({
  selector: 'app-phone-prefix-select',
  imports: [IonPopover, IonContent, IonIcon],
  templateUrl: './phone-prefix-select.html',
  styleUrl: './phone-prefix-select.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PhonePrefixSelect),
      multi: true,
    },
  ],
})
export class PhonePrefixSelect implements ControlValueAccessor {
  readonly value = signal(SPANISH_PREFIX);
  readonly isOpen = signal(false);
  readonly isDisabled = signal(false);
  readonly country = computed(() => getPrefixCountry(this.value()));

  // El popover se abre desde el botón (trigger), que necesita un id único
  protected readonly triggerId = `phone-prefix-${nextId++}`;
  protected readonly prefixes = PHONE_PREFIXES;
  protected readonly getPrefixCountry = getPrefixCountry;
  protected readonly caretIcon = caretDownOutline;

  private onChange: (prefix: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  handleChoose(prefix: string): void {
    this.value.set(prefix);
    this.onChange(prefix);
    this.onTouched();
  }

  writeValue(prefix: string | null): void {
    this.value.set(prefix ?? SPANISH_PREFIX);
  }

  registerOnChange(onChange: (prefix: string) => void): void {
    this.onChange = onChange;
  }

  registerOnTouched(onTouched: () => void): void {
    this.onTouched = onTouched;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
  }
}
