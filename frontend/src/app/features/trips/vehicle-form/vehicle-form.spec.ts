import { ComponentRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { Vehicle } from '../../../core/models/driver.model';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { provideCatalogsForTests } from '../../../core/services/catalogs/catalogs.testing';
import { LegalDocumentsService } from '../../../core/services/users/legal-documents.service';
import { VehicleForm } from './vehicle-form';

const VEHICLE: Vehicle = {
  id: 'v1',
  plateCountry: 'ES',

  plate: '1234BCD',
  brand: 'Seat',
  model: 'Ibiza',
  color: 'blue',
  engine: 'hybrid',
  capacity: 3,
  status: 'available',
  isDeclared: true,
};

describe('VehicleForm', () => {
  let fixture: ComponentFixture<VehicleForm>;
  let form: VehicleForm;
  let ref: ComponentRef<VehicleForm>;
  let driver: Record<string, ReturnType<typeof vi.fn>>;
  let showError: ReturnType<typeof vi.fn>;
  let saved: Vehicle[];

  beforeEach(async () => {
    driver = {
      registerVehicle: vi.fn().mockResolvedValue(VEHICLE),
      updateVehicle: vi.fn().mockResolvedValue({ ...VEHICLE, capacity: 4 }),
    };
    showError = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      imports: [VehicleForm],
      providers: [
        provideIonicAngular(),
        provideCatalogsForTests(),
        { provide: DriverService, useValue: driver },
        { provide: ToastService, useValue: { showError } },
        {
          provide: LegalDocumentsService,
          useValue: { getCurrent: vi.fn().mockResolvedValue({ version: '1.0' }) },
        },
      ],
    });
    fixture = TestBed.createComponent(VehicleForm);
    form = fixture.componentInstance;
    ref = fixture.componentRef;
    saved = [];
    form.saved.subscribe((vehicle) => saved.push(vehicle));
    await fixture.whenStable();
  });

  it('requires all vehicle fields before saving', () => {
    expect(form.isComplete()).toBe(false);
    form.form.setValue({
      brand: 'Seat',
      model: 'Ibiza',
      plateCountry: 'ES',

      plate: '1234BCD',
      totalSeats: 4,
      declared: true,
      color: 'blue',
      engine: 'hybrid',
    });
    expect(form.isComplete()).toBe(true);

    form.form.controls.declared.setValue(false);

    expect(form.isComplete()).toBe(false);
  });

  it('shows the 8 colors and 3 engines as options, chosen with one tap', () => {
    const root = fixture.nativeElement as HTMLElement;
    const colors = root.querySelectorAll<HTMLInputElement>('input[formControlName="color"]');
    const engines = root.querySelectorAll<HTMLInputElement>('input[formControlName="engine"]');

    colors[4].click();
    engines[1].click();

    expect(colors).toHaveLength(8);
    expect(engines).toHaveLength(3);
    expect(form.form.getRawValue()).toMatchObject({ color: 'blue', engine: 'hybrid' });
  });

  it('names each option for screen readers and the chosen one beside its label', () => {
    const root = fixture.nativeElement as HTMLElement;
    expect(form.colorLabel()).toBeNull();
    expect(form.engineLabel()).toBeNull();

    root.querySelector<HTMLInputElement>('input[aria-label="Azul"]')?.click();
    root.querySelector<HTMLInputElement>('input[aria-label="Híbrido"]')?.click();
    fixture.detectChanges();

    expect(form.colorLabel()).toBe('Azul');
    expect(form.engineLabel()).toBe('Híbrido');
    const legends = [...root.querySelectorAll('legend')].map((legend) => legend.textContent);
    expect(legends.join(' ')).toContain('· Azul');
    expect(legends.join(' ')).toContain('· Híbrido');
  });

  it('shows the vehicle declaration in its own window and ticks it when accepted', async () => {
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    root.querySelector<HTMLButtonElement>('.declaration-field__link')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(form.isReadingDeclaration()).toBe(true);
    expect(root.querySelector('.vehicle-form__fields--hidden')).not.toBeNull();
    expect(root.querySelector('.vehicle-form__declaration-step')?.textContent).toContain(
      'Declaración del vehículo',
    );

    form.handleDeclarationAccepted();
    fixture.detectChanges();
    expect(form.form.controls.declared.value).toBe(true);
    expect(root.querySelector('.vehicle-form__declaration-step')).toBeNull();
  });

  it('shows the plate field and no summary when registering', () => {
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(form.summary()).toBeNull();
    expect(root.querySelector('.vehicle-form__summary')).toBeNull();
    expect(root.querySelector('ion-input[formControlName="plate"]')).not.toBeNull();
  });

  it('shows the name and plate read-only when editing, without their fields', async () => {
    ref.setInput('vehicle', VEHICLE);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    expect(form.summary()).toEqual({ name: 'Seat Ibiza', plate: '1234 BCD', sign: 'E' });
    expect(root.querySelector('.vehicle-form__summary-name')?.textContent).toContain('Seat Ibiza');
    expect(root.querySelector('.vehicle-form__summary app-license-plate')).not.toBeNull();
    expect(root.querySelector('ion-input[formControlName="plate"]')).toBeNull();
    expect(root.querySelector('app-brand-field')).toBeNull();
    expect(root.querySelector('.vehicle-form__grid--edit')).not.toBeNull();
    expect(form.colorLabel()).toBe('Azul');
  });

  it('registers the separated details and passenger seats', async () => {
    form.form.setValue({
      brand: ' Seat ',
      model: ' Ibiza ',
      plateCountry: 'ES',

      plate: '1234 bcd',
      totalSeats: 4,
      declared: true,
      color: 'blue',
      engine: 'hybrid',
    });
    await form.handleSubmit();
    expect(driver['registerVehicle']).toHaveBeenCalledWith({
      brand: 'Seat',
      model: 'Ibiza',
      color: 'blue',
      engine: 'hybrid',
      plateCountry: 'ES',

      plate: '1234BCD',
      capacity: 3,
      declarationVersion: '1.0',
    });
    expect(saved).toEqual([VEHICLE]);
  });

  it('validates the plate with the format of its country and sends the country', async () => {
    form.form.setValue({
      brand: 'Peugeot',
      model: '208',
      plateCountry: 'ES',
      plate: 'AA-00-AA',
      totalSeats: 5,
      declared: true,
      color: 'blue',
      engine: 'other',
    });
    expect(form.form.controls.plate.hasError('plate')).toBe(true);
    expect(form.isSpanishPlate()).toBe(true);

    form.form.controls.plateCountry.setValue('PT');

    expect(form.form.controls.plate.valid).toBe(true);
    expect(form.isSpanishPlate()).toBe(false);
    await form.handleSubmit();
    expect(driver['registerVehicle']).toHaveBeenCalledWith(
      expect.objectContaining({ plate: 'AA00AA', plateCountry: 'PT' }),
    );
  });

  it('accepts old provincial Spanish plates', () => {
    form.form.controls.plate.setValue('AL 1234 AB');

    expect(form.form.controls.plate.valid).toBe(true);
  });

  it('does not save incomplete or invalid data', async () => {
    form.form.setValue({
      brand: '',
      model: '',
      plateCountry: 'ES',

      plate: 'ABC',
      totalSeats: 4,
      declared: true,
      color: '',
      engine: '',
    });
    await form.handleSubmit();
    expect(driver['registerVehicle']).not.toHaveBeenCalled();
    expect(form.form.controls.brand.touched).toBe(true);
  });

  it('edits color and engine but keeps brand, model and plate fixed', async () => {
    ref.setInput('vehicle', VEHICLE);
    TestBed.tick();
    expect(form.form.getRawValue()).toEqual({
      brand: 'Seat',
      model: 'Ibiza',
      plateCountry: 'ES',

      plate: '1234BCD',
      totalSeats: 4,
      declared: true,
      color: 'blue',
      engine: 'hybrid',
    });
    expect(form.form.controls.brand.disabled).toBe(true);
    expect(form.form.controls.model.disabled).toBe(true);
    expect(form.form.controls.plate.disabled).toBe(true);
    form.form.controls.totalSeats.setValue(5);
    form.form.controls.color.setValue('red');
    form.form.controls.engine.setValue('electric');
    await form.handleSubmit();
    expect(driver['updateVehicle']).toHaveBeenCalledWith('v1', {
      capacity: 4,
      color: 'red',
      engine: 'electric',
    });
    expect(saved).toHaveLength(1);
  });

  it('requires color and engine for legacy vehicles with null values', async () => {
    ref.setInput('vehicle', { ...VEHICLE, color: null, engine: null });
    TestBed.tick();
    expect(form.isComplete()).toBe(false);
    form.form.controls.color.setValue('white');
    form.form.controls.engine.setValue('other');
    expect(form.isComplete()).toBe(true);
  });

  it('shows API errors and preserves entered data', async () => {
    driver['registerVehicle'].mockRejectedValue(new Error('down'));
    form.form.setValue({
      brand: 'Seat',
      model: 'Ibiza',
      plateCountry: 'ES',

      plate: '1234BCD',
      totalSeats: 4,
      declared: true,
      color: 'blue',
      engine: 'hybrid',
    });
    await form.handleSubmit();
    expect(showError).toHaveBeenCalled();
    expect(saved).toEqual([]);
    expect(form.isSaving()).toBe(false);
    expect(form.form.controls.brand.value).toBe('Seat');
  });

  it('keeps showing the color of an edited vehicle that is no longer offered', async () => {
    ref.setInput('vehicle', { ...VEHICLE, color: 'gold' });
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    const colors = root.querySelectorAll<HTMLInputElement>('input[formControlName="color"]');
    expect(colors).toHaveLength(9);
    expect(colors[8].checked).toBe(true);
  });
});
