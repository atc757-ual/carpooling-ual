import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { Vehicle } from '../../../core/models/driver.model';
import { CampusParking } from '../../../core/models/place.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { LocationService } from '../../../core/services/location/location.service';
import { PlacesService } from '../../../core/services/places/places.service';
import { CelebrationService } from '../../../core/services/ui/celebration.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { stubIntersectionObserver } from '../../matching/trip-search.testing';
import { PublishTripPage } from './publish-trip.page';

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
  coordinates: [-2.6, 36.76] as [number, number],
};

// El primer test de la página la monta en frío (todos sus componentes): con
// la máquina cargada pasa de los 5 s por defecto
const COLD_START_TIMEOUT_MS = 15_000;

describe('PublishTripPage', () => {
  let harness: RouterTestingHarness;
  let page: PublishTripPage;
  let router: Router;
  let driver: Record<string, ReturnType<typeof vi.fn>>;
  let showError: ReturnType<typeof vi.fn>;
  let celebrate: ReturnType<typeof vi.fn>;

  async function openPage(
    url = '/publish',
    { vehicles = [VEHICLE], hasLicenseDeclared = true } = {},
  ): Promise<void> {
    stubIntersectionObserver();
    driver = {
      getStatus: vi.fn().mockResolvedValue({ hasLicenseDeclared }),
      listVehicles: vi.fn().mockResolvedValue(vehicles),
      acceptDeclaration: vi.fn().mockResolvedValue({ hasLicenseDeclared: true }),
      publishTrip: vi.fn().mockResolvedValue({ id: 't1', offeredSeats: 2, maxDetourMin: 10 }),
    };
    showError = vi.fn().mockResolvedValue(undefined);
    celebrate = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        provideIonicAngular(),
        provideRouter([
          {
            path: 'publish',
            component: PublishTripPage,
            data: { heading: { title: 'Publicar viaje', subtitle: 'Comparte tu recorrido.' } },
          },
        ]),
        { provide: DriverService, useValue: driver },
        {
          provide: AuthService,
          useValue: { hasProfile: () => true, refreshAccessToken: vi.fn().mockResolvedValue('t') },
        },
        {
          provide: PlacesService,
          useValue: { parkings: signal([P1]), loadParkings: vi.fn().mockResolvedValue(undefined) },
        },
        {
          provide: LocationService,
          useValue: { checkPermission: () => Promise.resolve('prompt') },
        },
        { provide: CelebrationService, useValue: { celebrate } },
        { provide: ToastService, useValue: { showError, showSuccess: vi.fn() } },
      ],
    });
    harness = await RouterTestingHarness.create();
    page = await harness.navigateByUrl(url, PublishTripPage);
    router = TestBed.inject(Router);
    await harness.fixture.whenStable();
  }

  // Trayecto completo (y, si se pide, el vehículo) sin pasar por la interfaz
  function fillTrip({ withVehicle = false } = {}): void {
    page.tripForm.patchValue({
      place: PLACE,
      parking: 'p1',
      date: '2099-01-15',
      time: '07:40',
      seats: 2,
      ...(withVehicle ? { vehicleId: 'v1' } : {}),
    });
  }

  async function submit(): Promise<void> {
    await page.handleSubmit();
    await harness.fixture.whenStable();
  }

  it('starts on Trayecto, with «Siguiente» waiting for the address and the parking', async () => {
    await openPage();

    expect(page.loadState()).toBe('ready');
    expect(page.step()).toBe(1);
    expect(page.isRouteComplete()).toBe(false);

    fillTrip();

    expect(page.isRouteComplete()).toBe(true);
  });

  it(
    'goes back to the first step on reload and never jumps ahead by itself',
    async () => {
      await openPage('/publish?step=3');

      expect(router.url).toBe('/publish');
      expect(page.step()).toBe(1);

      // El origen y el vehículo se rellenan solos: sigue en el paso 1
      fillTrip({ withVehicle: true });
      expect(page.step()).toBe(1);
    },
    COLD_START_TIMEOUT_MS,
  );

  it('moves forward with the buttons and back to the previous step by its name', async () => {
    await openPage();
    fillTrip();

    await submit();

    expect(router.url).toBe('/publish?step=2');
    expect(page.step()).toBe(2);
    expect(page.previousStep()).toEqual({ number: 1, name: 'Trayecto' });

    page.tripForm.controls.vehicleId.setValue('v1');
    await submit();

    expect(page.step()).toBe(3);
    expect(page.previousStep()).toEqual({ number: 2, name: 'Vehículo' });
  });

  it('marks the address in red instead of moving on without it', async () => {
    await openPage();

    await submit();

    expect(page.step()).toBe(1);
    expect(page.tripForm.controls.place.touched).toBe(true);
  });

  it('reviews the trip with the approximate arrival and what passengers save', async () => {
    await openPage();
    fillTrip({ withVehicle: true });

    expect(page.stops()?.[1]).toEqual(
      expect.objectContaining({ name: 'Campus UAL', detail: 'Parking P1' }),
    );
    expect(page.stops()?.[1].time).not.toBe('07:40');
    expect(page.impact()?.seats).toBe(2);
    expect(page.dateLabel()).toContain('15');
  });

  it('needs the declaration the first time, publishes and celebrates in step 4', async () => {
    await openPage('/publish', { hasLicenseDeclared: false });
    fillTrip({ withVehicle: true });
    await page.goToStep(2);
    await page.goToStep(3);

    expect(page.needsDeclaration()).toBe(true);

    page.tripForm.controls.declaration.setValue(true);
    await submit();

    expect(driver['acceptDeclaration']).toHaveBeenCalled();
    expect(driver['publishTrip']).toHaveBeenCalledWith(
      expect.objectContaining({ vehicleId: 'v1', offeredSeats: 2, originName: 'Roquetas de Mar' }),
    );
    expect(page.step()).toBe(4);
    expect(page.previousStep()).toBeNull();
    expect(celebrate).toHaveBeenCalled();
  });

  it('shows the API error and stays in the review', async () => {
    await openPage();
    driver['publishTrip'].mockRejectedValue(new Error('down'));
    fillTrip({ withVehicle: true });
    await page.goToStep(2);
    await page.goToStep(3);

    await submit();

    expect(showError).toHaveBeenCalled();
    expect(page.step()).toBe(3);
    expect(page.isSaving()).toBe(false);
  });

  it('publishes another trip from the first step', async () => {
    await openPage();
    fillTrip({ withVehicle: true });
    await page.goToStep(2);
    await page.goToStep(3);
    await submit();

    await page.handlePublishAnother();
    await harness.fixture.whenStable();

    expect(page.published()).toBeNull();
    expect(page.step()).toBe(1);
    expect(page.tripForm.controls.place.value).toEqual(PLACE);
  });

  it('offers to retry when the vehicles cannot be loaded', async () => {
    await openPage();
    driver['listVehicles'].mockRejectedValue(new Error('down'));

    await page.load();

    expect(page.loadState()).toBe('error');
  });

  it('asks for nothing without the driver profile: step 2 starts by registering the car', async () => {
    await openPage();
    const auth = TestBed.inject(AuthService) as unknown as {
      hasProfile: (profile: string) => boolean;
    };
    auth.hasProfile = (profile) => profile !== 'driver';
    driver['getStatus'].mockClear();

    await page.load();

    expect(driver['getStatus']).not.toHaveBeenCalled();
    expect(page.vehicles()).toEqual([]);
    expect(page.loadState()).toBe('ready');
  });
});
