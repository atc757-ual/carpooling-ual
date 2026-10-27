import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { Place } from '../../../core/models/place.model';
import { LocationError, LocationService } from '../../../core/services/location/location.service';
import { PlacesService } from '../../../core/services/places/places.service';
import { LocationModal } from './location-modal';

const PLACE: Place = {
  id: 'b1',
  name: 'Calle Lachambre, 4',
  locality: 'Almería',
  municipality: 'Almería',
  location: { type: 'Point', coordinates: [-2.46381, 36.8381] },
  isCovered: true,
};

describe('LocationModal', () => {
  let fixture: ComponentFixture<LocationModal>;
  let modal: LocationModal;
  const location = { getCurrentPoint: vi.fn() };
  const places = { reverse: vi.fn() };
  const modalController = { dismiss: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [LocationModal],
      providers: [
        provideIonicAngular(),
        { provide: LocationService, useValue: location },
        { provide: PlacesService, useValue: places },
        { provide: ModalController, useValue: modalController },
      ],
    });
    fixture = TestBed.createComponent(LocationModal);
    modal = fixture.componentInstance;
    fixture.detectChanges();
  });

  const text = (): string => (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('explains what the location is for before asking for it', () => {
    expect(text()).toContain('Solo la usamos para esta búsqueda y no la guardamos.');
    expect(location.getCurrentPoint).not.toHaveBeenCalled();
  });

  it('finds the address of the device and returns it', async () => {
    location.getCurrentPoint.mockResolvedValue([-2.4637, 36.8381]);
    places.reverse.mockResolvedValue(PLACE);

    await modal.handleLocate();
    fixture.detectChanges();

    expect(places.reverse).toHaveBeenCalledWith([-2.4637, 36.8381]);
    expect(text()).toContain('Calle Lachambre, 4');
    await modal.handleUse();
    expect(modalController.dismiss).toHaveBeenCalledWith(PLACE, 'select');
  });

  it('does not return an address out of the area', async () => {
    location.getCurrentPoint.mockResolvedValue([-1.86, 37.24]);
    places.reverse.mockResolvedValue({ ...PLACE, municipality: 'Vera', isCovered: false });

    await modal.handleLocate();
    fixture.detectChanges();

    expect(text()).toContain('Aún no llegamos a Vera');
    await modal.handleUse();
    expect(modalController.dismiss).not.toHaveBeenCalled();
  });

  it('moves the pin and looks for the new address', async () => {
    places.reverse.mockRejectedValueOnce({ status: 404 }).mockResolvedValueOnce(PLACE);

    await modal.movePin([-2.5, 36.9]);
    expect(modal.addressError()).toContain('No encontramos una dirección aquí');

    await modal.movePin([-2.46, 36.84]);
    expect(modal.place()).toEqual(PLACE);
    expect(modal.addressError()).toBeNull();
  });

  it('tells a missing permission from a location that does not come', async () => {
    location.getCurrentPoint.mockRejectedValueOnce(new LocationError('denied'));
    await modal.handleLocate();
    expect(modal.step()).toBe('denied');

    location.getCurrentPoint.mockRejectedValueOnce(new LocationError('unavailable'));
    await modal.handleLocate();
    expect(modal.step()).toBe('unavailable');
  });
});
