import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { SearchPlace } from '../../../core/models/trip-search.model';
import { LocationService } from '../../../core/services/location/location.service';
import { PlacesService } from '../../../core/services/places/places.service';
import { PLACES_SERVICE_STUB, ROQUETAS, stubIntersectionObserver } from '../trip-search.testing';
import { RouteControls, RouteFields } from './route-fields';

const PARKING_POINT: [number, number] = [-2.4, 36.83];

interface RenderOptions {
  point?: [number, number];
  permission?: string;
  place?: SearchPlace | null;
}

describe('RouteFields', () => {
  const reverse = vi.fn();
  let fixture: ComponentFixture<RouteFields>;
  let fields: RouteFields;
  let controls: RouteControls;

  async function render({
    point = ROQUETAS.coordinates,
    permission = 'prompt',
    place = null,
  }: RenderOptions = {}): Promise<HTMLElement> {
    stubIntersectionObserver();
    reverse.mockReset().mockResolvedValue({
      id: 'a1',
      name: 'Avenida del Mediterraneo, 120',
      municipality: 'Almería',
      locality: 'Almería',
      location: { type: 'Point', coordinates: point },
      isCovered: true,
    });
    TestBed.configureTestingModule({
      imports: [RouteFields],
      providers: [
        provideIonicAngular(),
        { provide: PlacesService, useValue: { ...PLACES_SERVICE_STUB, reverse } },
        {
          provide: LocationService,
          useValue: {
            checkPermission: () => Promise.resolve(permission),
            getCurrentPoint: () => Promise.resolve(point),
          },
        },
      ],
    });
    controls = {
      place: new FormControl<SearchPlace | null>(place),
      parking: new FormControl('', { nonNullable: true }),
      isToCampus: new FormControl(true, { nonNullable: true }),
    };
    fixture = TestBed.createComponent(RouteFields);
    fixture.componentRef.setInput('controls', controls);
    fields = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('offers the campus parkings, none chosen until one is picked', async () => {
    const root = await render();
    const options = root.querySelectorAll('.route-fields__parking ion-select-option');

    expect(Array.from(options, (option) => option.textContent?.trim())).toEqual([
      'Campus UAL · Parking P1',
      'Campus UAL · Parking P3',
    ]);
    expect(controls.parking.value).toBe('');
  });

  it('shows «Ver en el mapa» only once a parking is chosen', async () => {
    const root = await render();

    expect(controls.parking.value).toBe('');
    expect(root.querySelector('.route-fields__map-link')).toBeNull();

    controls.parking.setValue('p3');
    fixture.detectChanges();

    expect(root.querySelector('.route-fields__map-link')).not.toBeNull();
  });

  it('shows the chosen parking on the map', async () => {
    await render();
    const create = vi.spyOn(TestBed.inject(ModalController), 'create').mockResolvedValue({
      present: vi.fn(),
    } as unknown as HTMLIonModalElement);
    controls.parking.setValue('p3');

    await fields.handleViewParking();

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        componentProps: { viewPoint: [-2.4, 36.83], viewTitle: 'Campus UAL · Parking P3' },
      }),
    );
  });

  it('swaps the direction: to the campus or back from it', async () => {
    await render();

    fields.handleSwap();

    expect(controls.isToCampus.value).toBe(false);
    expect(fields.isToCampus()).toBe(false);

    fields.handleSwap();

    expect(fields.isToCampus()).toBe(true);
  });

  describe('with the location already allowed', () => {
    it('fills the origin in with the current place', async () => {
      await render({ permission: 'granted' });

      await vi.waitFor(() => expect(reverse).toHaveBeenCalledWith(ROQUETAS.coordinates));
      expect(fields.isAtCampus()).toBe(false);
    });

    it('does not ask for the location when it is not allowed yet', async () => {
      await render();

      expect(reverse).not.toHaveBeenCalled();
    });

    it('suggests going home when it is at the campus, and swaps the direction', async () => {
      await render({ point: PARKING_POINT, permission: 'granted' });

      expect(reverse).not.toHaveBeenCalled();
      await vi.waitFor(() => expect(fields.isAtCampus()).toBe(true));

      fields.handleGoHome();

      expect(fields.isAtCampus()).toBe(false);
      expect(controls.isToCampus.value).toBe(false);
    });

    it('shows the chosen address as the current location when they are the same place', async () => {
      await render({ permission: 'granted', place: ROQUETAS });
      const field = fields['placeField']();

      await vi.waitFor(() => expect(field?.isFromLocation()).toBe(true));
      expect(reverse).not.toHaveBeenCalled();
    });
  });
});
