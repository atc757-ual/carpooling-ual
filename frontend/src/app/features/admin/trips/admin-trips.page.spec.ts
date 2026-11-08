import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { AdminTripRow } from '../../../core/models/admin-trip.model';
import { ApiError } from '../../../core/models/api-error.model';
import { AdminTripsService } from '../../../core/services/admin/admin-trips.service';
import { AdminTripsPage } from './admin-trips.page';

const TRIP: AdminTripRow = {
  id: 't1',
  href: '/api/admin/trips/t1',
  status: 'confirmed',
  departureAt: '2026-11-02T07:30:00.000Z',
  originName: 'Roquetas de Mar',
  destinationName: 'Campus UAL',
  driver: { id: 'u1', name: 'Javier Pardo' },
  offeredSeats: 3,
  availableSeats: 2,
  requests: { pending: 2, accepted: 1 },
};

describe('AdminTripsPage', () => {
  let fixture: ComponentFixture<AdminTripsPage>;
  const list = vi.fn();

  async function render(params: Record<string, string> = {}): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [AdminTripsPage],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        { provide: AdminTripsService, useValue: { list } },
      ],
    });
    fixture = TestBed.createComponent(AdminTripsPage);
    for (const [key, value] of Object.entries(params)) {
      fixture.componentRef.setInput(key, value);
    }
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    list.mockResolvedValue({ items: [TRIP], total: 1 });
  });

  it('shows each trip with its route, driver, seats, requests and status', async () => {
    const root = await render();

    expect(list).toHaveBeenCalledWith({
      driver: undefined,
      status: undefined,
      from: undefined,
      to: undefined,
      offset: 0,
      limit: 20,
    });
    const row = root.querySelector('.admin-trips__table tbody tr');
    expect(row?.textContent).toContain('Roquetas de Mar → Campus UAL');
    expect(row?.textContent).toContain('Javier Pardo');
    expect(row?.textContent).toContain('2 de 3 libres');
    expect(row?.textContent).toContain('1 aceptada · 2 pendientes');
    expect(row?.querySelector('.status--accepted')?.textContent).toBe('Confirmado');
    expect(root.querySelector('.pagination__range')?.textContent).toContain('1');
  });

  it('names a deleted driver', async () => {
    list.mockResolvedValue({ items: [{ ...TRIP, driver: { id: 'u1', name: null } }], total: 1 });
    const root = await render();
    expect(root.querySelector('tbody')?.textContent).toContain('Cuenta eliminada');
  });

  it('reads valid filters from the URL and ignores the rest', async () => {
    await render({
      driver: ' javier ',
      status: 'in_progress',
      from: '2026-11-02',
      to: '02/11/2026',
      offset: '40',
    });
    expect(list).toHaveBeenCalledWith({
      driver: 'javier',
      status: 'in_progress',
      from: '2026-11-02',
      to: undefined,
      offset: 40,
      limit: 20,
    });

    TestBed.resetTestingModule();
    await render({ status: 'flying', offset: '-1' });
    expect(list).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: undefined, offset: 0 }),
    );
  });

  it('changes a filter going back to the first page and clears them all', async () => {
    await render({ offset: '20' });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const page = fixture.componentInstance;

    await page.handleFilter('from', '2026-11-02');
    expect(navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({ queryParams: { from: '2026-11-02', offset: null } }),
    );
    await page.handleFilter('driver', '');
    expect(navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({ queryParams: { driver: null, offset: null } }),
    );
    await page.handleOffset(40);
    expect(navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({ queryParams: { offset: 40 } }),
    );
    await page.handleClearFilters();
    expect(navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({
        queryParams: { driver: null, status: null, from: null, to: null, offset: null },
      }),
    );
  });

  it('lists the applied status and days and removes each one from the summary', async () => {
    await render({ status: 'confirmed', from: '2026-11-03', to: '2026-11-10' });
    const page = fixture.componentInstance;
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    expect(page.activeFilters().map((filter) => filter.key)).toEqual(['status', 'from', 'to']);
    expect(page.activeFilters()[0].label).toBe('Confirmado');
    expect(page.activeFilters()[1].label).toContain('Desde el');
    await page.handleRemoveFilter('from');
    expect(navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({ queryParams: { from: null, offset: null } }),
    );
    navigate.mockClear();
    await page.handleRemoveFilter('driver');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('offers to clear the filters when nothing matches', async () => {
    list.mockResolvedValue({ items: [], total: 0 });
    const root = await render({ status: 'cancelled' });
    expect(root.querySelector('.admin-empty')?.textContent).toContain(
      'No hay viajes con estos filtros',
    );
  });

  it('says there are no trips yet without filters', async () => {
    list.mockResolvedValue({ items: [], total: 0 });
    const root = await render();
    expect(root.querySelector('.admin-empty')?.textContent).toContain('Aún no hay viajes');
  });

  it('shows the error with a retry', async () => {
    list.mockRejectedValue(new ApiError('INTERNAL_ERROR', 500));
    const root = await render();
    expect(root.querySelector('.notice--danger')?.textContent).toContain(
      'No hemos podido cargar los viajes.',
    );

    list.mockResolvedValue({ items: [TRIP], total: 1 });
    fixture.componentInstance.handleRetry();
    await fixture.whenStable();
    expect(list).toHaveBeenCalledTimes(2);
  });
});
