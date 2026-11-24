import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { provideAppTransloco } from '../../../../core/i18n/testing-transloco';
import { TripSearch } from '../../../../core/models/trip-search.model';
import { UsualTrip } from '../../../../core/models/usual-trip.model';
import { TripSearchStateService } from '../../trip-search-state.service';
import { UsualTripService } from '../usual-trip.service';
import { UsualTripCard, usualTripWhen } from './usual-trip-card';

const TRIP: UsualTrip = {
  place: { id: 'p1', name: 'Roquetas de Mar', locality: 'Roquetas', coordinates: [-2.6, 36.76] },
  parking: { id: 'P1', name: 'Parking P1' },
  weekdays: [1, 3, 5],
  arrivalTime: '08:00',
  returnTime: '14:00',
  margin: 20,
  seats: 1,
};

const SEARCH: TripSearch = {
  place: TRIP.place,
  parking: TRIP.parking,
  direction: 'to-campus',
  date: '2026-11-25',
  time: '09:00',
  margin: 20,
  seats: 1,
};

describe('UsualTripCard', () => {
  let fixture: ComponentFixture<UsualTripCard>;
  const create = vi.fn();
  const setSearch = vi.fn();

  function render(trip: UsualTrip | null, search: TripSearch | null): HTMLElement {
    vi.clearAllMocks();
    create.mockResolvedValue({ present: vi.fn().mockResolvedValue(undefined) });
    TestBed.configureTestingModule({
      imports: [UsualTripCard],
      providers: [
        provideAppTransloco(),
        provideIonicAngular(),
        provideRouter([]),
        {
          provide: UsualTripService,
          useValue: { trip: signal(trip), isLoaded: signal(true) },
        },
        { provide: TripSearchStateService, useValue: { search: signal(search), set: setSearch } },
        { provide: ModalController, useValue: { create } },
      ],
    });
    fixture = TestBed.createComponent(UsualTripCard);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('says which days and when, with or without the way back', () => {
    TestBed.configureTestingModule({ providers: [provideAppTransloco()] });
    TestBed.runInInjectionContext(() => {
      expect(usualTripWhen(TRIP)).toBe(
        'lunes, miércoles y viernes · llegar a las 08:00 y volver a las 14:00',
      );
      expect(usualTripWhen({ ...TRIP, weekdays: [2], returnTime: null })).toBe(
        'martes · llegar a las 08:00',
      );
    });
  });

  it('searches there or back for the next day in one tap', async () => {
    const root = render(TRIP, null);
    expect(root.querySelector('h2')?.textContent).toBe('Mi trayecto');
    expect(root.textContent).toContain('Roquetas de Mar → Parking P1');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    await fixture.componentInstance.handleSearch('from-campus');

    expect(setSearch).toHaveBeenCalledWith(
      expect.objectContaining({ direction: 'from-campus', time: '14:00' }),
    );
    expect(navigate).toHaveBeenCalledWith(['/tabs/search/results']);
  });

  it('offers only the way there without a way back', () => {
    const root = render({ ...TRIP, returnTime: null }, null);
    expect(root.textContent).toContain('Buscar ida');
    expect(root.textContent).not.toContain('Buscar vuelta');
  });

  it('opens the window to edit the saved route', async () => {
    render(TRIP, SEARCH);

    await fixture.componentInstance.handleEdit();

    expect(create.mock.calls[0][0]).toMatchObject({ componentProps: { trip: TRIP, isNew: false } });
  });

  it('offers to save the last search when there is no route yet', async () => {
    const root = render(null, SEARCH);
    expect(root.textContent).toContain('Guardar como mi trayecto habitual');

    await fixture.componentInstance.handleSave();

    expect(create.mock.calls[0][0]).toMatchObject({
      componentProps: { trip: { arrivalTime: '09:00', weekdays: [3] }, isNew: true },
    });
  });

  it('shows nothing without a route or a search', () => {
    const root = render(null, null);
    expect(root.querySelector('ion-card')).toBeNull();
  });
});
