import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  forwardRef,
  inject,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { IonIcon, IonInput } from '@ionic/angular';
import { searchOutline } from 'ionicons/icons';
import { VEHICLE_BRANDS } from '../../../utils/vehicle-brands';

const OTHER_BRAND = 'Otra';

@Component({
  selector: 'app-brand-field',
  imports: [IonIcon, IonInput],
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
  private readonly inputHost = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly brandListId = `vehicle-brand-list-${nextListId++}`;
  protected readonly searchIcon = searchOutline;
  protected readonly value = signal('');
  protected readonly query = signal('');
  protected readonly otherMode = signal(false);
  protected readonly disabled = signal(false);
  protected readonly filteredBrands = computed(() => {
    const search = normalize(this.query());
    const matches = VEHICLE_BRANDS.filter((brand) => normalize(brand).includes(search));
    return [...matches, OTHER_BRAND];
  });
  private onChange: (value: string) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  constructor() {
    afterNextRender(() => void this.setNativeInputList(this.brandListId));
  }

  writeValue(value: string | null = ''): void {
    const brand = value ?? '';
    this.value.set(brand);
    this.query.set(brand);
    this.otherMode.set(Boolean(brand) && !isKnownBrand(brand));
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

  protected updateQuery(value: string | number | null | undefined): void {
    const query = String(value ?? '').trimStart();
    const selectedBrand = findKnownBrand(query);
    if (this.otherMode()) {
      this.query.set(query);
      this.value.set(query);
      this.onChange(query);
    } else if (selectedBrand) {
      this.otherMode.set(false);
      this.query.set(selectedBrand);
      this.value.set(selectedBrand);
      this.onChange(selectedBrand);
    } else if (normalize(query) === normalize(OTHER_BRAND)) {
      this.otherMode.set(true);
      this.query.set('');
      this.value.set('');
      this.onChange('');
    } else {
      this.query.set(query);
      this.value.set('');
      this.onChange('');
    }
  }

  protected handleBlur(): void {
    this.onTouched();
  }

  protected returnToBrandList(): void {
    this.otherMode.set(false);
    this.value.set('');
    this.query.set('');
    this.onChange('');
  }

  private async setNativeInputList(listId: string): Promise<void> {
    const ionInput = this.inputHost.nativeElement.querySelector('ion-input');
    if (!ionInput) {
      return;
    }
    const inputElement = ionInput as HTMLIonInputElement;
    const input = await inputElement.getInputElement();
    input.setAttribute('list', listId);
  }
}

let nextListId = 0;

function isKnownBrand(brand: string): boolean {
  return findKnownBrand(brand) !== undefined;
}

function findKnownBrand(brand: string): string | undefined {
  return VEHICLE_BRANDS.find((knownBrand) => normalize(knownBrand) === normalize(brand));
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es');
}
