import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { Vehicle } from '../../../core/models/driver.model';
import { CampusParking } from '../../../core/models/place.model';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { PlacesService } from '../../../core/services/places/places.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { PublishTripPage, toDepartureAt } from './publish-trip.page';

const P1: CampusParking = {
  id: 'p1',
  name: 'Parking P1',
  location: { type: 'Point', coordinates: [-2.4045, 36.8322] },
};
const VEHICLE: Vehicle = { id: 'v1', plate: '1234BCD', capacity: 3, status: 'available' };
const PLACE = {
  id: 'roq',
  name: 'Roquetas de Mar',
  locality: 'Roquetas',
  coordinates: [-2.6, 36.76],
};

describe('PublishTripPage', () => {
  let page: PublishTripPage;
  let driver: Record<string, ReturnType<typeof vi.fn>>;
  let showError: ReturnType<typeof vi.fn>;

  async function createPage(vehicles: Vehicle[], hasLicenseDeclared = true): Promise<void> {
    driver = {
      getStatus: vi.fn().mockResolvedValue({ hasLicenseDeclared }),
      listVehicles: vi.fn().mockResolvedValue(vehicles),
      registerVehicle: vi.fn().mockResolvedValue(VEHICLE),
      acceptDeclaration: vi.fn().mockResolvedValue({ hasLicenseDeclared: true }),
      publishTrip: vi.fn().mockResolvedValue({ id: 't1', offeredSeats: 2, maxDetourMin: 10 }),
    };
    showError = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      imports: [PublishTripPage],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        { provide: DriverService, useValue: driver },
        {
          provide: PlacesService,
          useValue: { parkings: signal([P1]), loadParkings: vi.fn().mockResolvedValue(undefined) },
        },
        { provide: ToastService, useValue: { showError, showSuccess: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(PublishTripPage);
    page = fixture.componentInstance;
    await fixture.whenStable();
  }

  function fillTrip(): void {
    page.tripForm.patchValue({ place: PLACE as never, date: '2099-01-15', time: '07:40' });
  }

  it('asks for a vehicle first and continues with it', async () => {
    await createPage([]);
    expect(page.loadState()).toBe('ready');
    page.vehicleForm.setValue({ plate: '1234 bcd', capacity: 3 });

    await page.handleRegisterVehicle();

    expect(driver['registerVehicle']).toHaveBeenCalledWith({ plate: '1234BCD', capacity: 3 });
    expect(page.vehicles()).toEqual([VEHICLE]);
    expect(page.tripForm.controls.vehicleId.value).toBe('v1');
  });

  it('rejects a plate that is not Spanish', async () => {
    await createPage([]);
    page.vehicleForm.setValue({ plate: 'ABC', capacity: 3 });

    await page.handleRegisterVehicle();

    expect(driver['registerVehicle']).not.toHaveBeenCalled();
  });

  it('keeps the offered seats between 1 and the vehicle capacity', async () => {
    await createPage([VEHICLE]);

    page.changeSeats(-1);
    expect(page.tripForm.controls.seats.value).toBe(1);
    page.changeSeats(5);
    expect(page.tripForm.controls.seats.value).toBe(3);
    expect(page.canAddSeat()).toBe(false);
  });

  it('publishes to the campus from the chosen place', async () => {
    await createPage([VEHICLE]);
    fillTrip();

    await page.handlePublish();

    expect(driver['acceptDeclaration']).not.toHaveBeenCalled();
    expect(driver['publishTrip']).toHaveBeenCalledWith({
      vehicleId: 'v1',
      origin: { type: 'Point', coordinates: PLACE.coordinates },
      destination: P1.location,
      departureAt: toDepartureAt('2099-01-15', '07:40'),
      offeredSeats: 1,
      maxDetourMin: 10,
    });
    expect(page.published()?.id).toBe('t1');
  });

  it('needs the declaration the first time and accepts it before publishing', async () => {
    await createPage([VEHICLE], false);
    fillTrip();

    await page.handlePublish();
    expect(driver['publishTrip']).not.toHaveBeenCalled();

    page.tripForm.controls.declaration.setValue(true);
    page.handleSwap();
    await page.handlePublish();

    expect(driver['acceptDeclaration']).toHaveBeenCalled();
    expect(driver['publishTrip'].mock.calls[0][0].origin).toEqual(P1.location);
    expect(page.hasDeclared()).toBe(true);
  });

  it('shows the API error and keeps the form', async () => {
    await createPage([VEHICLE]);
    fillTrip();
    driver['publishTrip'].mockRejectedValue(new Error('down'));

    await page.handlePublish();

    expect(showError).toHaveBeenCalled();
    expect(page.published()).toBeNull();
    expect(page.tripForm.controls.time.value).toBe('07:40');
  });

  it('offers to retry when the vehicles cannot be loaded', async () => {
    await createPage([VEHICLE]);
    driver['listVehicles'].mockRejectedValue(new Error('down'));

    await page.load();

    expect(page.loadState()).toBe('error');
  });
});
