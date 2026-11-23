import { provideAppTransloco } from '../../../core/i18n/testing-transloco';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ApiError, NETWORK_ERROR } from '../../../core/models/api-error.model';
import { Place } from '../../../core/models/place.model';
import { LocationError, LocationService } from '../../../core/services/location/location.service';
import { PlacesService } from '../../../core/services/places/places.service';
import { PlaceSearchModal } from './place-search-modal';

const SUGGESTION = { id: 'a1', name: 'Rambla Obispo Orberá, 20', locality: 'Almería' };
const PLACE: Place = {
  ...SUGGESTION,
  municipality: 'Almería',
  location: { type: 'Point', coordinates: [-2.45, 36.837] },
  isCovered: true,
};

describe('PlaceSearchModal', () => {
  let fixture: ComponentFixture<PlaceSearchModal>;
  const places = { suggest: vi.fn(), reverse: vi.fn() };
  const location = { checkPermission: vi.fn(), getCurrentPoint: vi.fn() };
  const dismiss = vi.fn().mockResolvedValue(true);

  function create(props: Partial<PlaceSearchModal> = {}): HTMLElement {
    TestBed.configureTestingModule({
      imports: [PlaceSearchModal],
      providers: [
        provideAppTransloco(),
        provideIonicAngular(),
        { provide: PlacesService, useValue: places },
        { provide: LocationService, useValue: location },
        { provide: ModalController, useValue: { dismiss } },
      ],
    });
    fixture = TestBed.createComponent(PlaceSearchModal);
    Object.assign(fixture.componentInstance, { title: 'Origen', placeholder: '¿Desde dónde?' });
    Object.assign(fixture.componentInstance, props);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const modal = (): PlaceSearchModal => fixture.componentInstance;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    places.suggest.mockReturnValue(of([SUGGESTION]));
  });

  afterEach(() => vi.useRealTimers());

  it('opens with the address it had and offers removing it without clearing the text first', () => {
    const root = create({ canLocate: true, initialText: 'Calle Real, 3' });

    expect(modal().text()).toBe('Calle Real, 3');
    expect(root.textContent).not.toContain('Elegir en el mapa');
    expect(root.querySelector('.place-search__clear')?.textContent).toContain(
      'Quitar la dirección',
    );

    modal().handleInput('');
    fixture.detectChanges();

    expect(root.textContent).toContain('Usar mi ubicación');
    expect(root.textContent).toContain('Elegir en el mapa');
    expect(root.querySelectorAll('.place-search__clear')).toHaveLength(1);
  });

  it('has no location on the destination and nothing to remove when empty', () => {
    const root = create({ canLocate: false });

    expect(root.textContent).not.toContain('Usar mi ubicación');
    expect(root.textContent).not.toContain('Quitar la dirección');
    expect(root.textContent).toContain('Elegir en el mapa');
  });

  it('suggests addresses while typing and returns the chosen one', async () => {
    const root = create();

    modal().handleInput('Rambla');
    vi.advanceTimersByTime(300);
    fixture.detectChanges();

    expect(places.suggest).toHaveBeenCalledWith('Rambla');
    expect(root.textContent).toContain('Rambla Obispo Orberá, 20');
    expect(root.textContent).toContain('CartoCiudad');
    await modal().handleSelect(SUGGESTION);
    expect(dismiss).toHaveBeenCalledWith(SUGGESTION, 'suggestion');
  });

  it('says so when the address service is down', () => {
    places.suggest.mockReturnValue(throwError(() => new ApiError(NETWORK_ERROR, 0)));
    const root = create();

    modal().handleInput('Rambla');
    vi.advanceTimersByTime(300);
    fixture.detectChanges();

    expect(root.querySelector('.place-search__message')).not.toBeNull();
  });

  it('shows the current address to confirm it, and returns it when tapped', async () => {
    location.checkPermission.mockResolvedValue('granted');
    location.getCurrentPoint.mockResolvedValue(PLACE.location.coordinates);
    places.reverse.mockResolvedValue(PLACE);
    const root = create({ canLocate: true });

    await modal().handleLocate();
    fixture.detectChanges();

    expect(dismiss).not.toHaveBeenCalled();
    expect(root.textContent).toContain('Tu ubicación');
    expect(root.textContent).toContain('Rambla Obispo Orberá, 20');
    await modal().handleUseLocated(PLACE);
    expect(dismiss).toHaveBeenCalledWith(PLACE, 'place');
  });

  it('does not offer an address out of the service area', async () => {
    location.checkPermission.mockResolvedValue('granted');
    location.getCurrentPoint.mockResolvedValue([-1.8, 37.2]);
    places.reverse.mockResolvedValue({ ...PLACE, isCovered: false, municipality: 'Vera' });
    create({ canLocate: true });

    await modal().handleLocate();

    expect(modal().located()).toBeNull();
    expect(modal().message()).toContain('Vera');
  });

  it('says why the location did not come', async () => {
    location.checkPermission.mockResolvedValue('granted');
    location.getCurrentPoint.mockRejectedValue(new LocationError('unavailable'));
    create({ canLocate: true });

    await modal().handleLocate();

    expect(modal().message()).toContain('No hemos podido saber dónde estás');
    expect(modal().status()).toBeNull();
  });

  it('leaves the permission to the field the first time', async () => {
    location.checkPermission.mockResolvedValue('prompt');
    create({ canLocate: true });

    await modal().handleLocate();

    expect(location.getCurrentPoint).not.toHaveBeenCalled();
    expect(dismiss).toHaveBeenCalledWith(null, 'locate');
  });

  it('returns the map, the removal or nothing', async () => {
    create();

    await modal().handleMap();
    await modal().handleClear();
    await modal().handleClose();

    expect(dismiss).toHaveBeenNthCalledWith(1, null, 'map');
    expect(dismiss).toHaveBeenNthCalledWith(2, null, 'clear');
    expect(dismiss).toHaveBeenNthCalledWith(3, null, 'cancel');
  });
});
