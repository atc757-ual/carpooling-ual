import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { provideAppTransloco } from '../../../core/i18n/testing-transloco';
import { DriverTrip, Vehicle } from '../../../core/models/driver.model';
import { provideCatalogsForTests } from '../../../core/services/catalogs/catalogs.testing';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import {
  confirmLabel,
  openVehicleTripsModal,
  vehicleTripRow,
  VehicleTripsMode,
  VehicleTripsModal,
} from './vehicle-trips-modal';

function vehicle(id: string, status: Vehicle['status'] = 'available'): Vehicle {
  return {
    id,
    plate: `${id}BCD`,
    plateCountry: 'ES',
    brand: 'Seat',
    model: 'Ibiza',
    color: 'blue',
    engine: 'hybrid',
    capacity: 4,
    status,
    isDeclared: true,
  };
}

function trip(id: string, availableSeats = 2): DriverTrip {
  return {
    id,
    vehicleId: 'old',
    offeredSeats: 3,
    availableSeats,
    departureAt: '2026-12-01T07:00:00.000Z',
    destinationName: 'Campus UAL',
  } as DriverTrip;
}

describe('VehicleTripsModal', () => {
  let fixture: ComponentFixture<VehicleTripsModal>;
  const dismiss = vi.fn().mockResolvedValue(true);
  const showError = vi.fn().mockResolvedValue(undefined);
  const driver = {
    listVehicles: vi.fn(),
    changeTripsVehicle: vi.fn().mockResolvedValue([]),
    cancelTrip: vi.fn().mockResolvedValue(undefined),
    deactivateVehicle: vi.fn().mockResolvedValue(undefined),
  };

  async function render(
    mode: VehicleTripsMode,
    vehicles: Vehicle[],
    trips = [trip('t1'), trip('t2', 3)],
  ): Promise<VehicleTripsModal> {
    TestBed.resetTestingModule();
    vi.clearAllMocks();
    driver.listVehicles.mockResolvedValue(vehicles);
    TestBed.configureTestingModule({
      imports: [VehicleTripsModal],
      providers: [
        provideAppTransloco(),
        provideIonicAngular(),
        provideCatalogsForTests(),
        { provide: DriverService, useValue: driver },
        { provide: ModalController, useValue: { dismiss } },
        { provide: ToastService, useValue: { showError, showSuccess: vi.fn() } },
      ],
    });
    fixture = TestBed.createComponent(VehicleTripsModal);
    const modal = fixture.componentInstance;
    modal.mode = mode;
    modal.vehicleId = 'old';
    modal.trips = trips;
    fixture.detectChanges();
    await fixture.whenStable();
    return modal;
  }

  function root(): HTMLElement {
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('says exactly what the button will do', () => {
    TestBed.configureTestingModule({ providers: [provideAppTransloco()] });
    TestBed.runInInjectionContext(() => {
      expect(confirmLabel(2, 0)).toBe('Mantener los viajes y eliminar el coche');
      expect(confirmLabel(0, 1)).toBe('Cancelar el viaje y eliminar el coche');
      expect(confirmLabel(0, 3)).toBe('Cancelar los 3 viajes y eliminar el coche');
      expect(confirmLabel(1, 2)).toBe('Mantener 1 y cancelar 2');
      expect(vehicleTripRow(trip('t', 3)).seats).toBe('Sin pasajeros');
      expect(vehicleTripRow(trip('t', 2)).seats).toBe('1 plaza ocupada');
      expect(vehicleTripRow(trip('t', 1)).seats).toBe('2 plazas ocupadas');
    });
  });

  it('keeps every trip by default and cancels the ones unticked', async () => {
    const modal = await render('remove', [vehicle('old'), vehicle('new')]);
    const boxes = root().querySelectorAll('ion-checkbox');
    expect(boxes).toHaveLength(2);
    expect([...boxes].every((box) => box.checked && !box.disabled)).toBe(true);
    expect(modal.confirmText()).toBe('Mantener los viajes y eliminar el coche');

    modal.handleToggle('t2', false);
    expect(modal.confirmText()).toBe('Mantener 1 y cancelar 1');
    modal.handleToggle('t2', true);
    expect(modal.cancelled()).toEqual([]);
  });

  it('moves the kept trips, then cancels the rest and then removes the car', async () => {
    const modal = await render('remove', [vehicle('old'), vehicle('new')]);
    modal.handleToggle('t2', false);

    await modal.handleConfirm();

    expect(driver.changeTripsVehicle).toHaveBeenCalledWith(['t1'], 'new');
    expect(driver.cancelTrip).toHaveBeenCalledWith('t2');
    expect(driver.deactivateVehicle).toHaveBeenCalledWith('old');
    const order = [driver.changeTripsVehicle, driver.cancelTrip, driver.deactivateVehicle].map(
      (call) => call.mock.invocationCallOrder[0],
    );
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(dismiss).toHaveBeenCalledWith(null, 'removed');
  });

  it('without another car, cancels them all (unticked) and offers to register one', async () => {
    const modal = await render('remove', [vehicle('old'), vehicle('gone', 'inactive')]);
    const boxes = [...root().querySelectorAll('ion-checkbox')];
    expect(boxes.every((box) => !box.checked && box.disabled)).toBe(true);
    expect(modal.confirmText()).toBe('Cancelar los 2 viajes y eliminar el coche');
    expect(root().textContent).toContain('Registrar otro coche');

    await modal.handleConfirm();

    expect(driver.changeTripsVehicle).not.toHaveBeenCalled();
    expect(driver.cancelTrip).toHaveBeenCalledTimes(2);
    expect(driver.deactivateVehicle).toHaveBeenCalledWith('old');
  });

  it('registers another car as a step of the same window and chooses it', async () => {
    const modal = await render('remove', [vehicle('old')]);

    modal.handleRegister();
    expect(root().querySelector('app-vehicle-form')).not.toBeNull();
    expect(root().querySelector('.modal-back-button')).not.toBeNull();
    expect(root().querySelector('.modal-close-button')).not.toBeNull();

    driver.listVehicles.mockResolvedValue([vehicle('old'), vehicle('new')]);
    modal.handleRegistered(vehicle('new'));
    await fixture.whenStable();
    expect(root().querySelector('app-vehicle-form')).toBeNull();
    expect(modal.targetId()).toBe('new');

    modal.handleRegister();
    modal.handleBack();
    expect(modal.isRegistering()).toBe(false);
  });

  it('changes the car of one trip, only with another car', async () => {
    const one = [trip('t1')];
    let modal = await render('change', [vehicle('old')], one);
    expect(modal.canConfirm()).toBe(false);
    expect(root().querySelector('ion-checkbox')).toBeNull();

    modal = await render('change', [vehicle('old'), vehicle('new')], one);
    expect(modal.confirmText()).toBe('Cambiar de coche');
    // El coche de ahora, solo para ver, y debajo a cuál se cambia
    fixture.detectChanges();
    expect(modal.currentVehicle()?.id).toBe('old');
    const current = root().querySelector('.vehicle-trips__current');
    expect(current?.textContent).toContain('Ahora vas en');
    expect(current?.querySelector('input[type="radio"]')).toBeNull();
    expect(root().textContent).toContain('Cambiar a');
    await modal.handleConfirm();

    expect(driver.changeTripsVehicle).toHaveBeenCalledWith(['t1'], 'new');
    expect(driver.deactivateVehicle).not.toHaveBeenCalled();
    expect(dismiss).toHaveBeenCalledWith(null, 'changed');
  });

  it('shows the API error and stays open', async () => {
    const modal = await render('remove', [vehicle('old'), vehicle('new')]);
    driver.changeTripsVehicle.mockRejectedValueOnce(new Error('down'));

    await modal.handleConfirm();

    expect(showError).toHaveBeenCalled();
    expect(dismiss).not.toHaveBeenCalled();
    expect(modal.isSaving()).toBe(false);
  });

  it('opens as a dialog and returns how it was closed', async () => {
    const create = vi.fn().mockResolvedValue({
      present: vi.fn().mockResolvedValue(undefined),
      onDidDismiss: () => Promise.resolve({ role: 'changed' }),
    });
    const props = { mode: 'change' as const, vehicleId: 'old', trips: [trip('t1')] };

    const role = await openVehicleTripsModal({ create } as unknown as ModalController, props);

    expect(role).toBe('changed');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ cssClass: 'info-dialog', componentProps: props }),
    );
  });
});
