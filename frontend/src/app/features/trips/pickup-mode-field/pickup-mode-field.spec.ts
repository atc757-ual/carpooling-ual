import { Component, CUSTOM_ELEMENTS_SCHEMA, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ControlValueAccessor, FormControl, NG_VALUE_ACCESSOR } from '@angular/forms';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { PickupMode } from '../../../core/models/driver.model';
import { SearchPlace } from '../../../core/models/trip-search.model';
import { PlaceField } from '../../matching/place-field/place-field';
import { MAX_STOPS, PickupModeControls, PickupModeField } from './pickup-mode-field';

@Component({
  selector: 'app-place-field',
  template: '',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: PlaceFieldStub, multi: true }],
})
class PlaceFieldStub implements ControlValueAccessor {
  readonly label = input('');
  readonly placeholder = input('');
  readonly icon = input('');
  writeValue(): void {
    // Sin texto que mostrar
  }
  registerOnChange(): void {
    // El test elige la dirección en el control
  }
  registerOnTouched(): void {
    // Sin foco que avisar
  }
}

function place(id: string): SearchPlace {
  return { id, name: `Calle ${id}`, locality: 'Almería', coordinates: [-2.44, 36.83] };
}

describe('PickupModeField', () => {
  const dismissed = vi.fn();
  const create = vi.fn();
  const modalController = { create } as unknown as ModalController;
  let fixture: ComponentFixture<PickupModeField>;
  let controls: PickupModeControls;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PickupModeField],
      providers: [provideIonicAngular(), { provide: ModalController, useValue: modalController }],
    });
    // El buscador de direcciones llama a la API: aquí, uno que solo guarda
    TestBed.overrideComponent(PickupModeField, {
      remove: { imports: [PlaceField] },
      add: { imports: [PlaceFieldStub], schemas: [CUSTOM_ELEMENTS_SCHEMA] },
    });
    controls = {
      pickupMode: new FormControl<PickupMode>('on_route', { nonNullable: true }),
      maxDetourM: new FormControl(500, { nonNullable: true }),
      stops: new FormControl<SearchPlace[]>([], { nonNullable: true }),
    };
    fixture = TestBed.createComponent(PickupModeField);
    fixture.componentRef.setInput('controls', controls);
    fixture.detectChanges();
  });

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('starts picking up on the route, with the distance', () => {
    expect(root().querySelector('.pickup-mode__distance')).not.toBeNull();
    expect(root().querySelector('.pickup-mode__stops')).toBeNull();
  });

  it('marks the chosen card and switches to stops without an error yet', () => {
    const radios = root().querySelectorAll<HTMLInputElement>(
      '.pickup-mode__choice input[type="radio"]',
    );
    expect(radios[0].checked).toBe(true);

    radios[1].click();
    fixture.detectChanges();

    expect(controls.pickupMode.value).toBe('stops');
    expect(radios[1].checked).toBe(true);
    expect(radios[0].checked).toBe(false);
    expect(root().querySelector('.pickup-mode__distance')).toBeNull();
    expect(root().querySelector('.pickup-mode__stops-head')?.textContent).toContain(
      '0 de 5 paradas',
    );
    expect(root().querySelector('[role="alert"]')).toBeNull();
    fixture.componentInstance.handleMode('elsewhere');
    expect(controls.pickupMode.value).toBe('stops');
  });

  it('adds each chosen place once, up to the maximum, and removes it', () => {
    fixture.componentInstance.handleMode('stops');
    const { newStop } = fixture.componentInstance;
    newStop.setValue(place('a'));
    newStop.setValue(place('a'));
    newStop.setValue(place('b'));
    fixture.detectChanges();

    expect(controls.stops.value.map(({ id }) => id)).toEqual(['a', 'b']);
    expect(newStop.value).toBeNull();
    expect(root().querySelectorAll('.pickup-mode__stop')).toHaveLength(2);

    fixture.componentInstance.removeStop(0);
    expect(controls.stops.value.map(({ id }) => id)).toEqual(['b']);

    for (let index = 0; index < MAX_STOPS + 1; index++) {
      newStop.setValue(place(`extra-${index}`));
    }
    fixture.detectChanges();
    expect(controls.stops.value).toHaveLength(MAX_STOPS);
    expect(fixture.componentInstance.canAddStop()).toBe(false);
    expect(root().textContent).toContain(`Ya tienes ${MAX_STOPS} paradas`);
  });

  it('adds the address chosen on the map, opened at the start', async () => {
    fixture.componentRef.setInput('mapCenter', [-2.46, 36.84]);
    create.mockResolvedValue({ present: vi.fn(), onDidDismiss: dismissed });
    dismissed.mockResolvedValue({
      role: 'select',
      data: {
        id: 'm1',
        name: 'Ctra. Sacramento',
        locality: 'Almería',
        municipality: 'Almería',
        location: { type: 'Point', coordinates: [-2.41, 36.83] },
        isCovered: true,
      },
    });

    await fixture.componentInstance.handlePickOnMap();

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        componentProps: { adjustPoint: [-2.46, 36.84], adjustTitle: 'Elegir parada en el mapa' },
      }),
    );
    expect(controls.stops.value).toEqual([
      { id: 'm1', name: 'Ctra. Sacramento', locality: 'Almería', coordinates: [-2.41, 36.83] },
    ]);

    dismissed.mockResolvedValue({ role: 'cancel' });
    await fixture.componentInstance.handlePickOnMap();
    expect(controls.stops.value).toHaveLength(1);
  });
});
