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
      updateVehicle: vi.fn().mockResolvedValue({ ...VEHICLE, model: 'Seat León' }),
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

  it('explains how many passengers fit', () => {
    expect(form.seatsNotice()).toBe('5 asientos = 1 conductor + hasta 4 pasajeros');

    form.form.controls.totalSeats.setValue(2);

    expect(form.seatsNotice()).toBe('2 asientos = 1 conductor + hasta 1 pasajero');
  });

  it('registers the vehicle with the passenger seats (total minus the driver)', async () => {
    form.form.setValue({ model: ' Seat Ibiza ', plate: '1234 bcd', totalSeats: 4 });

    await form.handleSubmit();

    expect(driver['registerVehicle']).toHaveBeenCalledWith({
      model: 'Seat Ibiza',
      plate: '1234BCD',
      capacity: 3,
    });
    expect(saved).toEqual([VEHICLE]);
  });

  it('does not save without the model or with a plate that is not Spanish', async () => {
    form.form.setValue({ model: '', plate: 'ABC', totalSeats: 4 });

    await form.handleSubmit();

    expect(driver['registerVehicle']).not.toHaveBeenCalled();
    expect(form.form.controls.model.touched).toBe(true);
  });

  it('edits a vehicle without changing its plate', async () => {
    ref.setInput('vehicle', VEHICLE);
    TestBed.tick();

    expect(form.form.getRawValue()).toEqual({
      model: 'Seat Ibiza',
      plate: '1234BCD',
      totalSeats: 4,
    });
    expect(form.form.controls.plate.disabled).toBe(true);

    form.form.controls.model.setValue('Seat León');
    await form.handleSubmit();

    expect(driver['updateVehicle']).toHaveBeenCalledWith('v1', { model: 'Seat León', capacity: 3 });
    expect(saved[0].model).toBe('Seat León');
  });

  it('shows the API error and keeps what was written', async () => {
    driver['registerVehicle'].mockRejectedValue(new Error('down'));
    form.form.setValue({ model: 'Seat Ibiza', plate: '1234BCD', totalSeats: 4 });

    await form.handleSubmit();

    expect(showError).toHaveBeenCalled();
    expect(saved).toEqual([]);
    expect(form.isSaving()).toBe(false);
    expect(form.form.controls.model.value).toBe('Seat Ibiza');
  });
});
