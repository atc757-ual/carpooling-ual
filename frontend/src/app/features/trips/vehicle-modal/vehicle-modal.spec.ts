import { TestBed } from '@angular/core/testing';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { Vehicle } from '../../../core/models/driver.model';
import { ToastService } from '../../../core/services/ui/toast.service';
import { VehicleModal } from './vehicle-modal';

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

describe('VehicleModal', () => {
  const showSuccess = vi.fn().mockResolvedValue(undefined);
  let dismiss: ReturnType<typeof vi.fn>;

  function create(): VehicleModal {
    dismiss = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      imports: [VehicleModal],
      providers: [
        provideIonicAngular(),
        { provide: ModalController, useValue: { dismiss } },
        { provide: ToastService, useValue: { showSuccess } },
      ],
    });
    const modal = TestBed.createComponent(VehicleModal).componentInstance;
    modal.vehicle = VEHICLE;
    return modal;
  }

  it('says the vehicle was updated and closes with it', async () => {
    const modal = create();

    await modal.handleSaved(VEHICLE);

    expect(showSuccess).toHaveBeenCalledWith('Vehículo actualizado.');
    expect(dismiss).toHaveBeenCalledWith(VEHICLE, 'saved');
  });

  it('says the vehicle was registered when it is a new one', async () => {
    const modal = create();
    modal.vehicle = null;

    await modal.handleSaved(VEHICLE);

    expect(showSuccess).toHaveBeenCalledWith('Vehículo registrado.');
  });
});
