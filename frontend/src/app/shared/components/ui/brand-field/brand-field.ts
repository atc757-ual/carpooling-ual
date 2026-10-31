import { Component, computed, forwardRef, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { IonIcon, IonInput } from '@ionic/angular';
import { searchOutline } from 'ionicons/icons';
import { Combobox, ComboboxState } from '../combobox/combobox';
import { VEHICLE_BRANDS } from '../../../utils/vehicle-brands';

const OTHER_BRAND = 'Otra';

@Component({
  selector: 'app-brand-field',
  imports: [Combobox, IonIcon, IonInput],
  templateUrl: './brand-field.html',
  styleUrl: './brand-field.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => BrandField),
      multi: true,
    },
  ],
})
export class BrandField implements ControlValueAccessor {
  protected readonly searchIcon = searchOutline;
  protected readonly value = signal('');
  protected readonly query = signal('');
  protected readonly searchActive = signal(false);
  protected readonly otherMode = signal(false);
  protected readonly disabled = signal(false);
  protected readonly filteredBrands = computed(() => {
    const search = normalize(this.query());
    const matches = VEHICLE_BRANDS.filter((brand) => normalize(brand).includes(search));
    return [...matches, OTHER_BRAND];
  });
  protected readonly combobox = new ComboboxState(
    () => this.filteredBrands().length,
    (index) => this.chooseBrand(this.filteredBrands()[index]),
  );

  private onChange: (value: string) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  // Angular escribe null al vaciar el formulario: entonces, sin marca
  writeValue(value: string | null): void {
    const brand = typeof value === 'string' ? value : '';
    this.value.set(brand);
    this.query.set(brand);
    this.otherMode.set(brand !== '' && !isKnownBrand(brand));
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  protected activateSearch(): void {
    if (!this.disabled() && !this.otherMode()) {
      this.searchActive.set(true);
      this.combobox.reset();
    }
  }

  protected updateQuery(value: string | number | null | undefined): void {
    const query = String(value ?? '').trimStart();
    this.query.set(query);
    if (this.otherMode()) {
      this.value.set(query);
      this.onChange(query);
    } else {
      this.value.set('');
      this.onChange('');
      this.searchActive.set(true);
      this.combobox.reset();
    }
  }

  protected chooseBrand(brand: string): void {
    this.searchActive.set(false);
    if (brand === OTHER_BRAND) {
      this.otherMode.set(true);
      this.value.set('');
      this.query.set('');
      this.onChange('');
    } else {
      this.otherMode.set(false);
      this.value.set(brand);
      this.query.set(brand);
      this.onChange(brand);
    }
    this.combobox.dismiss();
    this.onTouched();
  }

  protected handleBlur(): void {
    this.searchActive.set(false);
    this.combobox.dismiss();
    this.onTouched();
  }

  protected returnToBrandList(): void {
    this.otherMode.set(false);
    this.value.set('');
    this.query.set('');
    this.onChange('');
    this.searchActive.set(true);
    this.combobox.reset();
  }
}

function isKnownBrand(brand: string): boolean {
  return VEHICLE_BRANDS.some((knownBrand) => normalize(knownBrand) === normalize(brand));
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es');
}
