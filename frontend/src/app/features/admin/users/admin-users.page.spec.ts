import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { AdminUserRow } from '../../../core/models/admin-user.model';
import { ApiError } from '../../../core/models/api-error.model';
import { AdminUsersService } from '../../../core/services/admin/admin-users.service';
import { AdminUsersPage } from './admin-users.page';

const ROW: AdminUserRow = {
  id: 'u1',
  href: '/api/users/u1',
  name: 'Lucía Cortés',
  email: 'lcc123@inlumine.ual.es',
  profiles: [{ profile: 'driver', isActive: true }],
  statuses: ['open_incidents'],
  tripCount: 9,
  openIncidents: 2,
  suspensions: null,
  createdAt: '2026-10-01T10:00:00.000Z',
};

describe('AdminUsersPage', () => {
  let fixture: ComponentFixture<AdminUsersPage>;
  const list = vi.fn();

  async function render(params: Record<string, string> = {}): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [AdminUsersPage],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        { provide: AdminUsersService, useValue: { list } },
      ],
    });
    fixture = TestBed.createComponent(AdminUsersPage);
    for (const [key, value] of Object.entries(params)) {
      fixture.componentRef.setInput(key, value);
    }
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => list.mockReset());

  it('shows the users with their role, trips and status', async () => {
    list.mockResolvedValue({ items: [ROW], total: 1284 });

    const root = await render();

    expect(root.querySelector('h1')?.textContent).toContain('Usuarios · 1 284');
    const cells = Array.from(root.querySelectorAll('tbody td')).map((td) => td.textContent?.trim());
    expect(cells).toEqual([
      expect.stringContaining('Lucía Cortés'),
      'Conductor',
      '9',
      '2 incidencias',
      'Ver perfil',
    ]);
    expect(list).toHaveBeenCalledWith({
      search: undefined,
      profile: undefined,
      status: undefined,
      offset: 0,
      limit: 20,
    });
  });

  it('reads the filters and the page from the URL and ignores wrong values', async () => {
    list.mockResolvedValue({ items: [ROW], total: 1 });

    await render({ search: ' ana ', profile: 'driver', status: 'sleeping', offset: '40' });

    expect(list).toHaveBeenCalledWith({
      search: 'ana',
      profile: 'driver',
      status: undefined,
      offset: 40,
      limit: 20,
    });
  });

  it('offers removing the filters when nothing matches', async () => {
    list.mockResolvedValue({ items: [], total: 0 });

    const root = await render({ status: 'suspended' });

    expect(root.textContent).toContain('Ningún usuario coincide');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await fixture.componentInstance.handleClearFilters();
    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { search: null, profile: null, status: null, offset: null },
      }),
    );
  });

  it('says there are no users yet without filters', async () => {
    list.mockResolvedValue({ items: [], total: 0 });

    expect((await render()).textContent).toContain('Aún no hay usuarios');
  });

  it('shows the error with a retry that keeps the filters', async () => {
    list.mockRejectedValueOnce(new ApiError('INTERNAL_ERROR', 500));

    const root = await render({ status: 'deleted' });

    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'No hemos podido cargar los usuarios',
    );
    list.mockResolvedValue({ items: [ROW], total: 1 });
    fixture.componentInstance.handleRetry();
    await fixture.whenStable();
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'deleted' }));
  });

  it('goes back to the first page when a filter changes and keeps the page otherwise', async () => {
    list.mockResolvedValue({ items: [ROW], total: 100 });
    await render({ offset: '40' });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    await fixture.componentInstance.handleSearch(
      new CustomEvent('ionInput', { detail: { value: 'ana' } }),
    );
    expect(navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({ queryParams: { search: 'ana', offset: null } }),
    );

    await fixture.componentInstance.handleFilter('profile', '');
    expect(navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({ queryParams: { profile: null, offset: null } }),
    );

    await fixture.componentInstance.handleOffset(60);
    expect(navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({ queryParams: { offset: 60 } }),
    );
  });
});
