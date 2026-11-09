import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { ApiError } from '../../../core/models/api-error.model';
import { AdminIncidentsService } from '../../../core/services/admin/admin-incidents.service';
import { INCIDENT } from './admin-incident.testing';
import { AdminIncidentsPage } from './admin-incidents.page';

describe('AdminIncidentsPage', () => {
  let fixture: ComponentFixture<AdminIncidentsPage>;
  const list = vi.fn();

  async function render(params: Record<string, string> = {}): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [AdminIncidentsPage],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        { provide: AdminIncidentsService, useValue: { list } },
      ],
    });
    fixture = TestBed.createComponent(AdminIncidentsPage);
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
    list.mockResolvedValue({ items: [INCIDENT], total: 1 });
  });

  it('shows the open ones by default, one row each with its severity and a link', async () => {
    const root = await render();

    expect(list).toHaveBeenCalledWith({
      status: 'open',
      category: undefined,
      offset: 0,
      limit: 20,
    });
    const row = root.querySelector('tbody tr');
    expect(row?.classList).toContain('incidents__row--danger');
    const cells = Array.from(row?.querySelectorAll('td') ?? [], (cell) => cell.textContent?.trim());
    expect(cells.slice(0, 3)).toEqual([
      'INC-0042',
      'Con el conductor',
      'Roquetas de Mar → Campus UAL',
    ]);
    expect(cells[4]).toBe('Abierta');
    expect(row?.querySelector('a')?.getAttribute('href')).toBe('/i1');
    // Se gestiona solo desde el detalle
    expect(root.textContent).not.toContain('Marcar revisada');
  });

  it('reads all the incidents and a category from the URL', async () => {
    await render({ status: 'all', category: 'technical', offset: '20' });

    expect(list).toHaveBeenCalledWith({
      status: undefined,
      category: 'technical',
      offset: 20,
      limit: 20,
    });
  });

  it('lists what is not the default and removes or clears it', async () => {
    await render({ status: 'reviewed', category: 'driver' });
    const page = fixture.componentInstance;
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    expect(page.activeFilters()).toEqual([
      { key: 'status', label: 'Revisadas' },
      { key: 'category', label: 'Con el conductor' },
    ]);
    await page.handleRemoveFilter('status');
    expect(navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({ queryParams: { status: null, offset: null } }),
    );
    await page.handleClearFilters();
    expect(navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({ queryParams: { status: null, category: null, offset: null } }),
    );
    navigate.mockClear();
    await page.handleRemoveFilter('offset');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('changes the filters going back to the first page', async () => {
    await render();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    await fixture.componentInstance.handleStatus('reviewed');
    expect(navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({ queryParams: { status: 'reviewed', offset: null } }),
    );
    await fixture.componentInstance.handleStatus('open');
    expect(navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({ queryParams: { status: null, offset: null } }),
    );
    await fixture.componentInstance.handleCategory('');
    expect(navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({ queryParams: { category: null, offset: null } }),
    );
    await fixture.componentInstance.handleOffset(20);
    expect(navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({ queryParams: { offset: 20 } }),
    );
  });

  it('says there are no open incidents and shows errors with a retry', async () => {
    list.mockResolvedValue({ items: [], total: 0 });
    expect((await render()).textContent).toContain('No hay incidencias abiertas');

    TestBed.resetTestingModule();
    list.mockRejectedValueOnce(new ApiError('INTERNAL_ERROR', 500));
    const root = await render({ status: 'reviewed' });
    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'No hemos podido cargar las incidencias',
    );
    fixture.componentInstance.handleRetry();
    await fixture.whenStable();
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'reviewed' }));
  });
});
