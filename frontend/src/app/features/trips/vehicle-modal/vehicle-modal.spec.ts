import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { Vehicle } from '../../../core/models/driver.model';
import { provideCatalogsForTests } from '../../../core/services/catalogs/catalogs.testing';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { LegalDocumentsService } from '../../../core/services/users/legal-documents.service';
import { VehicleForm } from '../vehicle-form/vehicle-form';
import { VehicleModal } from './vehicle-modal';

const VEHICLE: Vehicle = {
  id: 'v1',
  plate: '1234BCD',

  plateCountry: 'ES',
  brand: 'Seat',
  model: 'Ibiza',
  color: 'blue',
  engine: 'hybrid',
  capacity: 3,
  status: 'available',
  isDeclared: true,
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

  it('hides the close button while the declaration is read inside the window', async () => {
    TestBed.configureTestingModule({
      imports: [VehicleModal],
      providers: [
        provideIonicAngular(),
        provideCatalogsForTests(),
        { provide: ModalController, useValue: { dismiss: vi.fn() } },
        { provide: ToastService, useValue: { showSuccess } },
        { provide: DriverService, useValue: {} },
        {
          provide: LegalDocumentsService,
          useValue: { getCurrent: vi.fn().mockResolvedValue({ version: '1.0' }) },
        },
      ],
    });
    const fixture = TestBed.createComponent(VehicleModal);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const form = fixture.debugElement.query(By.directive(VehicleForm))
      .componentInstance as VehicleForm;
    expect(root.querySelector('.modal-close-button')).not.toBeNull();

    form.isReadingDeclaration.set(true);
    await fixture.whenStable();
    expect(root.querySelector('.modal-close-button')).toBeNull();

    form.isReadingDeclaration.set(false);
    await fixture.whenStable();
    expect(root.querySelector('.modal-close-button')).not.toBeNull();
  });
});
