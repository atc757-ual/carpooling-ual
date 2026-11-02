import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { ApiError } from '../../../core/models/api-error.model';
import { AdminOverviewService } from '../../../core/services/admin/admin-overview.service';
import { AdminDigitalTwinPage, OVERVIEW_REFRESH_MS } from './admin-digital-twin.page';

const OVERVIEW = {
  tripsPublishedToday: 24,
  tripsInProgress: 8,
  seatsOffered: 60,
  seatsTaken: 41,
  pendingRequests: 12,
};
const EVENT = {
  id: 'e1',
  href: '/api/admin/events/e1',
  sequence: 7,
  type: 'trip.published',
  version: 1,
  sourceEntityId: '3f2a9c1e-0000-4000-8000-000000000000',
  occurredAt: '2026-11-02T08:15:00.000Z',
};

describe('AdminDigitalTwinPage', () => {
  let fixture: ComponentFixture<AdminDigitalTwinPage>;
  const overview = vi.fn();
  const listEvents = vi.fn();
  const getEvent = vi.fn();

  async function render(params: Record<string, string> = {}): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [AdminDigitalTwinPage],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        { provide: AdminOverviewService, useValue: { overview, listEvents, getEvent } },
      ],
    });
    fixture = TestBed.createComponent(AdminDigitalTwinPage);
    for (const [key, value] of Object.entries(params)) {
      fixture.componentRef.setInput(key, value);
    }
    await settle();
    return fixture.nativeElement as HTMLElement;
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.clearAllMocks();
    overview.mockResolvedValue(OVERVIEW);
    listEvents.mockResolvedValue({ items: [EVENT], total: 41 });
    getEvent.mockResolvedValue({ ...EVENT, payload: { status: 'published' } });
  });

  it('shows the live overview and the latest events', async () => {
    const root = await render();

    const values = [...root.querySelectorAll('.twin__value')].map((value) => value.textContent);
    expect(values).toEqual(['24', '8', '60', '41', '12']);
    expect(root.textContent).toContain('68 % de ocupación');
    expect(root.querySelector('.notice--info')?.textContent).toContain(
      'El gemelo digital se conectará aquí',
    );
    expect(listEvents).toHaveBeenCalledWith({ type: undefined, offset: 0, limit: 20 });
    const row = root.querySelector('.twin__table tbody tr');
    expect(row?.textContent).toContain('Viaje publicado');
    expect(row?.textContent).toContain('Viaje · 3f2a9c1e');
  });

  it('reads a known type and the page from the URL', async () => {
    await render({ type: 'request.accepted', offset: '20' });
    expect(listEvents).toHaveBeenCalledWith({ type: 'request.accepted', offset: 20, limit: 20 });
  });

  it('ignores an unknown type in the URL', async () => {
    await render({ type: 'user.flew', offset: '-5' });
    expect(listEvents).toHaveBeenCalledWith({ type: undefined, offset: 0, limit: 20 });
  });

  it('opens and closes the payload of an event', async () => {
    const root = await render();
    const toggle = root.querySelector<HTMLButtonElement>('.twin__toggle');

    toggle?.click();
    await settle();
    expect(getEvent).toHaveBeenCalledWith('e1');
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    expect(root.querySelector('.event-payload__code')?.textContent).toContain(
      '"status": "published"',
    );

    toggle?.click();
    await settle();
    expect(root.querySelector('app-event-payload')).toBeNull();
  });

  it('shows the error of an event that cannot be loaded', async () => {
    getEvent.mockRejectedValue(new ApiError('EVENT_NOT_FOUND', 404));
    const root = await render();

    root.querySelector<HTMLButtonElement>('.twin__toggle')?.click();
    await settle();
    expect(root.querySelector('.event-payload__error')).not.toBeNull();
  });

  it('changes the type going back to the first page and closing the event', async () => {
    await render({ offset: '20' });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture.componentInstance.handleToggle('e1');

    await fixture.componentInstance.handleType('trip.started');
    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { type: 'trip.started', offset: null } }),
    );
    expect(fixture.componentInstance.expandedId()).toBeNull();

    await fixture.componentInstance.handleType('');
    await fixture.componentInstance.handleOffset(0);
    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { type: null, offset: null } }),
    );
    expect(navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({ queryParams: { offset: null } }),
    );
  });

  it('shows the empty state of a type without events', async () => {
    listEvents.mockResolvedValue({ items: [], total: 0 });
    const root = await render({ type: 'trip.started' });
    expect(root.querySelector('.twin__empty')?.textContent).toContain(
      'No hay eventos de este tipo',
    );
  });

  it('shows the errors with a retry', async () => {
    overview.mockRejectedValue(new ApiError('INTERNAL_ERROR', 500));
    listEvents.mockRejectedValue(new ApiError('INTERNAL_ERROR', 500));
    const root = await render();

    const alerts = root.querySelectorAll('.notice--danger');
    expect(alerts).toHaveLength(2);
    expect(alerts[0].textContent).toContain('No hemos podido cargar el resumen.');
    expect(alerts[1].textContent).toContain('No hemos podido cargar los eventos.');
  });

  it('refreshes the overview by itself and on demand', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    try {
      await render();
      expect(overview).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(OVERVIEW_REFRESH_MS);
      await settle();
      expect(overview).toHaveBeenCalledTimes(2);

      fixture.componentInstance.handleRefresh();
      await settle();
      expect(overview).toHaveBeenCalledTimes(3);
      expect(listEvents).toHaveBeenCalledTimes(2);
    } finally {
      fixture.destroy();
      vi.useRealTimers();
    }
  });
});
