import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Place } from '../../../core/models/place.model';
import { SearchPlace } from '../../../core/models/trip-search.model';
import { PlacesService } from '../../../core/services/places/places.service';
import { ROQUETAS } from '../trip-search.testing';
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
    [showError]="showError()"
  />`,
})
class Host {
  readonly place = new FormControl<SearchPlace | null>(null);
  readonly showError = signal(false);
}

describe('PlaceField', () => {
  let fixture: ComponentFixture<Host>;
  const places = { suggest: vi.fn(), getPlace: vi.fn() };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideIonicAngular(), { provide: PlacesService, useValue: places }],
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

  it('takes the address chosen on the map with «Usar mi ubicación»', async () => {
    const onDidDismiss = vi.fn().mockResolvedValue({ data: PLACE, role: 'select' });
    const create = vi
      .spyOn(TestBed.inject(ModalController), 'create')
      .mockResolvedValue({ present: vi.fn(), onDidDismiss } as unknown as HTMLIonModalElement);

    await field().handleUseLocation();

    expect(create).toHaveBeenCalled();
    expect(fixture.componentInstance.place.value).toMatchObject({ id: 'a1' });
  });

  it('keeps the field as it was when the map is closed', async () => {
    const onDidDismiss = vi.fn().mockResolvedValue({ data: null, role: 'cancel' });
    vi.spyOn(TestBed.inject(ModalController), 'create').mockResolvedValue({
      present: vi.fn(),
      onDidDismiss,
    } as unknown as HTMLIonModalElement);

    await field().handleUseLocation();

    expect(fixture.componentInstance.place.value).toBeNull();
  });

  it('shows the error that the form decides', () => {
    fixture.componentInstance.showError.set(true);
    fixture.detectChanges();

    expect(root().querySelector('ion-input')?.classList).toContain('ion-invalid');
  });
});
