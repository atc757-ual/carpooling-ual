import { TestBed } from '@angular/core/testing';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { Vehicle } from '../../../core/models/driver.model';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { ConfirmService } from '../../../core/services/ui/confirm.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { VehicleModal } from './vehicle-modal';

const VEHICLE: Vehicle = {
  id: 'v1',
  plate: '1234BCD',
  model: 'Seat Ibiza',
  capacity: 3,
  status: 'available',
};

describe('VehicleModal', () => {
  const deactivateVehicle = vi.fn();
  const showError = vi.fn().mockResolvedValue(undefined);
  let dismiss: ReturnType<typeof vi.fn>;

  function create(isConfirmed: boolean): VehicleModal {
    dismiss = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      imports: [VehicleModal],
      providers: [
        provideIonicAngular(),
        { provide: ModalController, useValue: { dismiss } },
        { provide: DriverService, useValue: { deactivateVehicle } },
        { provide: ConfirmService, useValue: { ask: () => Promise.resolve(isConfirmed) } },
        { provide: ToastService, useValue: { showError } },
      ],
    });
    const modal = TestBed.createComponent(VehicleModal).componentInstance;
    modal.vehicle = VEHICLE;
    return modal;
  }

  it('removes the vehicle after confirming it and closes with «removed»', async () => {
    deactivateVehicle.mockResolvedValue(undefined);
    const modal = create(true);

    await modal.handleRemove(VEHICLE);

    expect(deactivateVehicle).toHaveBeenCalledWith('v1');
    expect(dismiss).toHaveBeenCalledWith(null, 'removed');
  });

  it('keeps the vehicle when the removal is not confirmed', async () => {
    deactivateVehicle.mockClear();
    const modal = create(false);

    await modal.handleRemove(VEHICLE);

    expect(deactivateVehicle).not.toHaveBeenCalled();
    expect(dismiss).not.toHaveBeenCalled();
  });

  it('shows the API error and stays open', async () => {
    deactivateVehicle.mockRejectedValue(new Error('down'));
    const modal = create(true);

    await modal.handleRemove(VEHICLE);

    expect(showError).toHaveBeenCalled();
    expect(dismiss).not.toHaveBeenCalled();
  });

  it('closes with the saved vehicle', async () => {
    const modal = create(true);

    await modal.handleSaved(VEHICLE);

    expect(dismiss).toHaveBeenCalledWith(VEHICLE, 'saved');
  });
});
