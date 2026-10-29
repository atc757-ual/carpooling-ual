import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Place } from '../../../core/models/place.model';
import { SearchPlace } from '../../../core/models/trip-search.model';
import { LocationError, LocationService } from '../../../core/services/location/location.service';
import { PlacesService } from '../../../core/services/places/places.service';
import { ROQUETAS } from '../trip-search.testing';
import { By } from '@angular/platform-browser';
import { PlaceField } from './place-field';

const SUGGESTION = { id: 'a1', name: 'Avenida del Mediterraneo, 120', locality: 'Almería' };
const PLACE: Place = {
  ...SUGGESTION,
  municipality: 'Almería',
  location: { type: 'Point', coordinates: [-2.44615, 36.83256] },
  isCovered: true,
};

@Component({
  imports: [PlaceField, ReactiveFormsModule],
  template: `<app-place-field
    [formControl]="place"
    label="Origen"
    placeholder="¿Desde dónde sales?"
    icon="ellipse-outline"
    [canLocate]="canLocate()"
    [showError]="showError()"
  />`,
})
class Host {
  readonly place = new FormControl<SearchPlace | null>(null);
  readonly showError = signal(false);
  readonly canLocate = signal(true);
}

describe('PlaceField', () => {
  let fixture: ComponentFixture<Host>;
  const places = { suggest: vi.fn(), getPlace: vi.fn(), reverse: vi.fn() };
  const location = { checkPermission: vi.fn(), getCurrentPoint: vi.fn() };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        provideIonicAngular(),
        { provide: PlacesService, useValue: places },
        { provide: LocationService, useValue: location },
      ],
    });
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  });

  afterEach(() => vi.useRealTimers());

  const field = (): PlaceField => fixture.debugElement.children[0].componentInstance as PlaceField;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;

  function type(text: string): void {
    field().handleInput(text);
    vi.advanceTimersByTime(300);
    fixture.detectChanges();
  }

  it('suggests addresses from 3 letters on, with the data credit', () => {
    places.suggest.mockReturnValue(of([SUGGESTION]));

    type('av');
    expect(places.suggest).not.toHaveBeenCalled();

    type('avenida');
    expect(places.suggest).toHaveBeenCalledWith('avenida');
    expect(root().querySelector('.place-field__suggestion')?.textContent).toContain(
      'Avenida del Mediterraneo, 120',
    );
    expect(root().textContent).toContain('CartoCiudad cedido por © Instituto Geográfico Nacional');
  });

  it('takes the chosen address, with its point, as the value', async () => {
    places.getPlace.mockResolvedValue(PLACE);

    await field().handleSelect(SUGGESTION);

    expect(fixture.componentInstance.place.value).toEqual({
      id: 'a1',
      name: 'Avenida del Mediterraneo, 120',
      locality: 'Almería',
      coordinates: [-2.44615, 36.83256],
    });
    expect(field().text()).toBe('Avenida del Mediterraneo, 120');
  });

  it('does not take an address out of the area, and says so', async () => {
    places.getPlace.mockResolvedValue({ ...PLACE, municipality: 'Vera', isCovered: false });

    await field().handleSelect(SUGGESTION);
    fixture.detectChanges();

    expect(fixture.componentInstance.place.value).toBeNull();
    expect(root().querySelector('.place-field__message')?.textContent).toBe(
      'Aún no llegamos a Vera. Esperamos tener cobertura allí pronto.',
    );
  });

  it('warns when the address service is down', () => {
    places.suggest.mockReturnValue(throwError(() => new Error('503')));

    type('avenida');

    expect(field().message()).toContain('Ahora no podemos buscar direcciones');
  });

  it('shows the chosen address and forgets it when typing again', () => {
    fixture.componentInstance.place.setValue(ROQUETAS);
    fixture.detectChanges();
    expect(field().text()).toBe('Roquetas de Mar');

    field().handleInput('Roquetas');

    expect(fixture.componentInstance.place.value).toBeNull();
  });

  // La ventana de la ubicación, simulada: se cierra con ese resultado
  function stubModal(data: unknown, role: string) {
    return vi.spyOn(TestBed.inject(ModalController), 'create').mockResolvedValue({
      present: vi.fn(),
      onDidDismiss: vi.fn().mockResolvedValue({ data, role }),
    } as unknown as HTMLIonModalElement);
  }

  it('offers the location only on the origin', () => {
    expect(root().querySelector('.place-field__locate')).not.toBeNull();

    fixture.componentInstance.canLocate.set(false);
    fixture.detectChanges();

    expect(root().querySelector('.place-field__locate')).toBeNull();
  });

  it('fills the address in straight away when the permission was given', async () => {
    location.checkPermission.mockResolvedValue('granted');
    location.getCurrentPoint.mockResolvedValue([-2.44615, 36.83256]);
    places.reverse.mockResolvedValue(PLACE);
    const create = stubModal(null, 'cancel');

    await field().handleUseLocation();

    expect(create).not.toHaveBeenCalled();
    expect(places.reverse).toHaveBeenCalledWith([-2.44615, 36.83256]);
    expect(fixture.componentInstance.place.value).toMatchObject({ id: 'a1' });
  });

  it('asks for the permission in the window the first time, then fills the address in', async () => {
    location.checkPermission.mockResolvedValue('prompt');
    places.reverse.mockResolvedValue(PLACE);
    const create = stubModal([-2.44615, 36.83256], 'located');

    await field().handleUseLocation();

    expect(create).toHaveBeenCalled();
    expect(fixture.componentInstance.place.value).toMatchObject({ id: 'a1' });
  });

  it('keeps the field as it was when the window is closed', async () => {
    location.checkPermission.mockResolvedValue('prompt');
    stubModal(null, 'cancel');

    await field().handleUseLocation();

    expect(places.reverse).not.toHaveBeenCalled();
    expect(fixture.componentInstance.place.value).toBeNull();
  });

  it('says why the location did not come', async () => {
    location.checkPermission.mockResolvedValue('granted');
    location.getCurrentPoint.mockRejectedValue(new LocationError('unavailable'));

    await field().handleUseLocation();

    expect(field().message()).toContain('No hemos podido saber dónde estás');
  });

  it('adjusts the chosen address on the map', async () => {
    fixture.componentInstance.place.setValue(ROQUETAS);
    fixture.detectChanges();
    const create = stubModal(PLACE, 'select');

    await field().handleAdjust();

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ componentProps: { adjustPoint: ROQUETAS.coordinates } }),
    );
    expect(fixture.componentInstance.place.value).toMatchObject({ id: 'a1' });
  });

  it('shows the error that the form decides', () => {
    fixture.componentInstance.showError.set(true);
    fixture.detectChanges();

    expect(root().querySelector('ion-input')?.classList).toContain('ion-invalid');
  });

  it('fills in quietly with the current location and shows it on the button', async () => {
    const field = fixture.debugElement.query(By.directive(PlaceField))
      .componentInstance as PlaceField;
    places.reverse.mockResolvedValue(PLACE);

    await field.fillQuietly([-2.4, 36.83]);
    fixture.detectChanges();

    expect(fixture.componentInstance.place.value).toMatchObject({ id: 'a1' });
    expect(field.isFromLocation()).toBe(true);
    expect(root().querySelector('.place-field__locate--active')?.getAttribute('aria-label')).toBe(
      'Usando tu ubicación actual',
    );

    field.handleInput('Otra');
    expect(field.isFromLocation()).toBe(false);
  });

  it('leaves the field empty, without warnings, outside the service area or on errors', async () => {
    const field = fixture.debugElement.query(By.directive(PlaceField))
      .componentInstance as PlaceField;
    places.reverse.mockResolvedValueOnce({ ...PLACE, municipality: 'Vera', isCovered: false });

    await field.fillQuietly([-1.8, 37.2]);
    places.reverse.mockRejectedValueOnce(new Error('down'));
    await field.fillQuietly([-1.8, 37.2]);

    expect(fixture.componentInstance.place.value).toBeNull();
    expect(field.message()).toBeNull();
    expect(field.isFromLocation()).toBe(false);
  });

  it('marks the address it has as the current location, only if it has one', () => {
    const field = fixture.debugElement.query(By.directive(PlaceField))
      .componentInstance as PlaceField;

    field.markFromLocation();
    expect(field.isFromLocation()).toBe(false);

    fixture.componentInstance.place.setValue({
      id: 'a1',
      name: 'Avenida del Mediterraneo, 120',
      locality: 'Almería',
      coordinates: [-2.4, 36.83],
    });
    field.markFromLocation();
    expect(field.isFromLocation()).toBe(true);
  });
});
