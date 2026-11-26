import { provideAppTransloco } from '../../../../core/i18n/testing-transloco';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { CatalogsService } from '../../../../core/services/catalogs/catalogs.service';
import { BrandField } from './brand-field';

const BRANDS = ['Abarth', 'SEAT', 'Škoda'];

describe('BrandField', () => {
  let fixture: ComponentFixture<BrandField>;
  let component: BrandField;

  const vehicleBrandNames = vi.fn();

  beforeEach(async () => {
    vehicleBrandNames.mockResolvedValue(BRANDS);
    TestBed.configureTestingModule({
      imports: [BrandField],
      providers: [
        provideAppTransloco(),
        provideIonicAngular(),
        { provide: CatalogsService, useValue: { vehicleBrandNames } },
      ],
    });
    fixture = TestBed.createComponent(BrandField);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('starts closed and shows the catalog brands when the search is activated', async () => {
    expect(fixture.nativeElement.querySelector('.brand-field__dropdown')).toBeNull();

    input().click();
    fixture.detectChanges();
    await fixture.whenStable();

    const options = Array.from(
      fixture.nativeElement.querySelectorAll('[role="option"]'),
    ) as HTMLElement[];
    expect(options.map((option) => option.textContent?.trim())).toEqual([...BRANDS, 'Otra']);
  });

  it('filters brands and sends the selected brand through ControlValueAccessor', async () => {
    const changes: string[] = [];
    const change = vi.fn((value: string) => changes.push(value));
    component.registerOnChange(change);
    input().click();
    sendInput('seat');
    fixture.detectChanges();
    await fixture.whenStable();

    const options = Array.from(
      fixture.nativeElement.querySelectorAll('[role="option"]'),
    ) as HTMLElement[];
    expect(options.map((option) => option.textContent?.trim())).toEqual(['SEAT', 'Otra']);
    options[0].click();
    fixture.detectChanges();

    expect(changes).toEqual(['', 'SEAT']);
    expect(input().value).toBe('SEAT');
    expect(fixture.nativeElement.querySelector('.brand-field__dropdown')).toBeNull();
  });

  it('allows a free-text brand after choosing Otra', async () => {
    const changes: string[] = [];
    component.registerOnChange((value) => changes.push(value));
    input().click();
    fixture.detectChanges();
    const options = Array.from(
      fixture.nativeElement.querySelectorAll('[role="option"]'),
    ) as HTMLElement[];
    options.at(-1)?.click();
    fixture.detectChanges();

    expect(input().placeholder).toBe('Escribe la marca');
    sendInput('Rivian');

    expect(changes).toEqual(['', 'Rivian']);
    expect(input().value).toBe('Rivian');
  });

  it('shows a legacy free-text brand provided by the form', () => {
    component.writeValue('Rivian');
    fixture.detectChanges();

    expect(input().placeholder).toBe('Escribe la marca');
    expect(input().value).toBe('Rivian');
    expect(fixture.nativeElement.querySelector('.brand-field__dropdown')).toBeNull();
  });

  it('offers only Otra when the brands cannot be loaded', async () => {
    TestBed.resetTestingModule();
    vehicleBrandNames.mockRejectedValue(new Error('offline'));
    TestBed.configureTestingModule({
      imports: [BrandField],
      providers: [
        provideAppTransloco(),
        provideIonicAngular(),
        { provide: CatalogsService, useValue: { vehicleBrandNames } },
      ],
    });
    fixture = TestBed.createComponent(BrandField);
    fixture.detectChanges();
    await fixture.whenStable();

    input().click();
    fixture.detectChanges();
    const options = Array.from(
      fixture.nativeElement.querySelectorAll('[role="option"]'),
    ) as HTMLElement[];
    expect(options.map((option) => option.textContent?.trim())).toEqual(['Otra']);
  });

  it('recognizes a known brand written before the brands arrive', async () => {
    TestBed.resetTestingModule();
    let resolveBrands: (brands: string[]) => void = () => undefined;
    vehicleBrandNames.mockReturnValue(
      new Promise<string[]>((resolve) => (resolveBrands = resolve)),
    );
    TestBed.configureTestingModule({
      imports: [BrandField],
      providers: [
        provideAppTransloco(),
        provideIonicAngular(),
        { provide: CatalogsService, useValue: { vehicleBrandNames } },
      ],
    });
    fixture = TestBed.createComponent(BrandField);
    fixture.componentInstance.writeValue('SEAT');
    fixture.detectChanges();
    expect(input().placeholder).toBe('Escribe la marca');

    resolveBrands(BRANDS);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(input().placeholder).not.toBe('Escribe la marca');
    expect(input().value).toBe('SEAT');
  });

  it('covers keyboard selection, blur, returnToBrandList, disabled state, and null writeValue', async () => {
    // Default onChange/onTouched before registering callbacks
    sendInput('a');
    (component as unknown as { handleBlur: () => void }).handleBlur();

    const touched = vi.fn();
    component.registerOnTouched(touched);

    // Null writeValue
    component.writeValue(null);
    fixture.detectChanges();
    expect(input().value).toBe('');

    // Disabled state blocks activateSearch
    component.setDisabledState(true);
    input().click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.brand-field__dropdown')).toBeNull();

    // Enable and use combobox keyboard callback to select a brand
    component.setDisabledState(false);
    input().click();
    fixture.detectChanges();
    (
      component as unknown as {
        combobox: { chooseActive: () => void };
      }
    ).combobox.chooseActive();
    expect(touched).toHaveBeenCalled();

    // Null query update and returnToBrandList from otherMode
    (component as unknown as { chooseBrand: (b: string) => void }).chooseBrand('Otra');
    (component as unknown as { updateQuery: (v: null) => void }).updateQuery(null);
    (component as unknown as { returnToBrandList: () => void }).returnToBrandList();
    expect((component as unknown as { otherMode: () => boolean }).otherMode()).toBe(false);
    expect((component as unknown as { searchActive: () => boolean }).searchActive()).toBe(true);
  });

  function input(): HTMLIonInputElement {
    return fixture.nativeElement.querySelector('ion-input') as HTMLIonInputElement;
  }

  function sendInput(value: string): void {
    input().dispatchEvent(
      new CustomEvent('ionInput', { bubbles: true, composed: true, detail: { value } }),
    );
    fixture.detectChanges();
  }
});
