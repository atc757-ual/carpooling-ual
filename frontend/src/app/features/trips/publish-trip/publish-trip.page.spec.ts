import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ModalController, provideIonicAngular } from '@ionic/angular';
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
const VEHICLE: Vehicle = {
  id: 'v1',
  plate: '1234BCD',
  model: 'Seat Ibiza',
  capacity: 3,
  status: 'available',
};
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

    page.handleVehicleSaved(VEHICLE);

    expect(page.vehicles()).toEqual([VEHICLE]);
    expect(page.tripForm.controls.vehicleId.value).toBe('v1');
  });

  it('edits the chosen vehicle in a window and keeps the change', async () => {
    await createPage([VEHICLE]);
    const edited: Vehicle = { ...VEHICLE, model: 'Seat León', capacity: 2 };
    const create = vi.spyOn(TestBed.inject(ModalController), 'create').mockResolvedValue({
      present: vi.fn().mockResolvedValue(undefined),
      onWillDismiss: () => Promise.resolve({ data: edited, role: 'saved' }),
    } as unknown as HTMLIonModalElement);

    await page.handleEditVehicle(VEHICLE);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ componentProps: { vehicle: VEHICLE }, cssClass: 'info-dialog' }),
    );
    expect(page.selectedVehicle()).toEqual(edited);
    expect(page.maxSeats()).toBe(2);
  });

  it('summarises the trip while it is filled in', async () => {
    await createPage([VEHICLE]);
    expect(page.stops()).toBeNull();

    fillTrip();

    expect(page.stops()).toEqual([
      { name: 'Roquetas de Mar', detail: 'Roquetas', time: '07:40' },
      { name: 'Campus UAL', detail: 'Parking P1' },
    ]);
    expect(page.dateLabel()).toContain('15');
    page.handleSwap();
    expect(page.stops()?.[0]).toEqual({ name: 'Campus UAL', detail: 'Parking P1', time: '07:40' });
  });

  it('offers up to the capacity of the chosen vehicle', async () => {
    const small: Vehicle = { ...VEHICLE, id: 'v2', plate: '5678CDF', capacity: 1 };
    await createPage([VEHICLE, small]);

    expect(page.maxSeats()).toBe(3);
    expect(page.seatsHint()).toBe('Tu vehículo tiene 3 plazas para pasajeros.');
    page.tripForm.controls.seats.setValue(3);

    page.tripForm.controls.vehicleId.setValue('v2');
    TestBed.tick();

    expect(page.tripForm.controls.seats.value).toBe(1);
    expect(page.seatsHint()).toBe('Tu vehículo tiene 1 plaza para pasajeros.');
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
      originName: 'Roquetas de Mar',
      destinationName: 'Campus UAL · Parking P1',
    });
    expect(page.published()?.id).toBe('t1');
  });

  it('ticks the declaration when it is accepted in the window', async () => {
    await createPage([VEHICLE], false);
    const present = vi.fn().mockResolvedValue(undefined);
    const create = vi.spyOn(TestBed.inject(ModalController), 'create').mockResolvedValue({
      present,
      onWillDismiss: () => Promise.resolve({ role: 'accept' }),
    } as unknown as HTMLIonModalElement);

    await page.handleReadDeclaration();

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ cssClass: 'info-dialog' }));
    expect(page.tripForm.controls.declaration.value).toBe(true);
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

  it('says what is missing before it can publish', async () => {
    await createPage([VEHICLE], false);

    expect(page.missingToPublish()).toBe('Elige tu dirección para publicar el viaje.');
    page.tripForm.patchValue({ place: PLACE as never, vehicleId: '' });
    expect(page.missingToPublish()).toBe('Elige el parking y el vehículo para publicar el viaje.');
    page.tripForm.patchValue({ vehicleId: 'v1' });
    expect(page.missingToPublish()).toBe('Acepta la declaración para publicar tu primer viaje.');
    page.tripForm.patchValue({ declaration: true });
    expect(page.missingToPublish()).toBeNull();
  });

  it('offers to retry when the vehicles cannot be loaded', async () => {
    await createPage([VEHICLE]);
    driver['listVehicles'].mockRejectedValue(new Error('down'));

    await page.load();

    expect(page.loadState()).toBe('error');
  });
});
