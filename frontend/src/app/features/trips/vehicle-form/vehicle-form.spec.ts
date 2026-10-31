import { ComponentRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { Vehicle } from '../../../core/models/driver.model';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { VehicleForm } from './vehicle-form';

const VEHICLE: Vehicle = {
  id: 'v1',
  plate: '1234BCD',
  model: 'Seat Ibiza',
  capacity: 3,
  status: 'available',
};

describe('VehicleForm', () => {
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
    const fixture = TestBed.createComponent(VehicleForm);
    form = fixture.componentInstance;
    ref = fixture.componentRef;
    saved = [];
    form.saved.subscribe((vehicle) => saved.push(vehicle));
    await fixture.whenStable();
  });

  it('can be saved only once the fields are complete', () => {
    expect(form.isComplete()).toBe(false);

    form.form.setValue({ brand: 'Seat', model: 'Ibiza', plate: '1234BCD', totalSeats: 4 });

    expect(form.isComplete()).toBe(true);
  });

  it('registers the vehicle with brand and model together and the passenger seats', async () => {
    form.form.setValue({ brand: ' Seat ', model: ' Ibiza ', plate: '1234 bcd', totalSeats: 4 });

    await form.handleSubmit();

    expect(driver['registerVehicle']).toHaveBeenCalledWith({
      model: 'Seat Ibiza',
      plate: '1234BCD',
      capacity: 3,
    });
    expect(saved).toEqual([VEHICLE]);
  });

  it('does not save without brand and model or with a plate that is not Spanish', async () => {
    form.form.setValue({ brand: '', model: '', plate: 'ABC', totalSeats: 4 });

    await form.handleSubmit();

    expect(driver['registerVehicle']).not.toHaveBeenCalled();
    expect(form.form.controls.brand.touched).toBe(true);
  });

  it('edits only the seats: brand, model and plate cannot change', async () => {
    ref.setInput('vehicle', VEHICLE);
    TestBed.tick();

    expect(form.form.getRawValue()).toEqual({
      brand: 'Seat',
      model: 'Ibiza',
      plate: '1234BCD',
      totalSeats: 4,
    });
    expect(form.form.controls.brand.disabled).toBe(true);
    expect(form.form.controls.model.disabled).toBe(true);
    expect(form.form.controls.plate.disabled).toBe(true);

    form.form.controls.totalSeats.setValue(5);
    await form.handleSubmit();

    expect(driver['updateVehicle']).toHaveBeenCalledWith('v1', { capacity: 4 });
    expect(saved).toHaveLength(1);
  });

  it('shows the API error and keeps what was written', async () => {
    driver['registerVehicle'].mockRejectedValue(new Error('down'));
    form.form.setValue({ brand: 'Seat', model: 'Ibiza', plate: '1234BCD', totalSeats: 4 });

    await form.handleSubmit();

    expect(showError).toHaveBeenCalled();
    expect(saved).toEqual([]);
    expect(form.isSaving()).toBe(false);
    expect(form.form.controls.brand.value).toBe('Seat');
  });
});
