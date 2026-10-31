import { ComponentRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { Vehicle } from '../../../core/models/driver.model';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { VehicleForm } from './vehicle-form';

const VEHICLE: Vehicle = {
  id: 'v1',
  plate: '1234BCD',
  brand: 'Seat',
  model: 'Ibiza',
  color: 'blue',
  engine: 'hybrid',
  capacity: 3,
  status: 'available',
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
        { provide: DriverService, useValue: driver },
        { provide: ToastService, useValue: { showError } },
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
      plate: '1234BCD',
      totalSeats: 4,
      color: 'blue',
      engine: 'hybrid',
    });
    expect(form.isComplete()).toBe(true);
  });

  it('keeps color and engine select placeholders short', () => {
    const color = fixture.nativeElement.querySelector(
      'ion-select[formControlName="color"]',
    ) as HTMLIonSelectElement;
    const engine = fixture.nativeElement.querySelector(
      'ion-select[formControlName="engine"]',
    ) as HTMLIonSelectElement;

    expect(color.placeholder).toBe('Elige');
    expect(engine.placeholder).toBe('Elige');
  });

  it('registers the separated details and passenger seats', async () => {
    form.form.setValue({
      brand: ' Seat ',
      model: ' Ibiza ',
      plate: '1234 bcd',
      totalSeats: 4,
      color: 'blue',
      engine: 'hybrid',
    });
    await form.handleSubmit();
    expect(driver['registerVehicle']).toHaveBeenCalledWith({
      brand: 'Seat',
      model: 'Ibiza',
      color: 'blue',
      engine: 'hybrid',
      plate: '1234BCD',
      capacity: 3,
    });
    expect(saved).toEqual([VEHICLE]);
  });

  it('does not save incomplete or invalid data', async () => {
    form.form.setValue({
      brand: '',
      model: '',
      plate: 'ABC',
      totalSeats: 4,
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
      plate: '1234BCD',
      totalSeats: 4,
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
      plate: '1234BCD',
      totalSeats: 4,
      color: 'blue',
      engine: 'hybrid',
    });
    await form.handleSubmit();
    expect(showError).toHaveBeenCalled();
    expect(saved).toEqual([]);
    expect(form.isSaving()).toBe(false);
    expect(form.form.controls.brand.value).toBe('Seat');
  });
});
