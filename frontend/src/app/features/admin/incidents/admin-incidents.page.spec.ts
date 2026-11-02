import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { ApiError } from '../../../core/models/api-error.model';
import { AdminIncidentsService } from '../../../core/services/admin/admin-incidents.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { INCIDENT } from './admin-incident-labels.spec';
import { AdminIncidentsPage } from './admin-incidents.page';

describe('AdminIncidentsPage', () => {
  let fixture: ComponentFixture<AdminIncidentsPage>;
  const list = vi.fn();
  const review = vi.fn().mockResolvedValue(undefined);
  const showSuccess = vi.fn().mockResolvedValue(undefined);
  const create = vi.fn();

  async function render(params: Record<string, string> = {}): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [AdminIncidentsPage],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        { provide: AdminIncidentsService, useValue: { list, review } },
        { provide: ToastService, useValue: { showSuccess } },
        { provide: ModalController, useValue: { create } },
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

  it('shows the open ones by default with their severity and people', async () => {
    const root = await render();

    expect(list).toHaveBeenCalledWith({
      status: 'open',
      category: undefined,
      offset: 0,
      limit: 20,
    });
    const card = root.querySelector('.incident-card');
    expect(card?.classList).toContain('incident-card--danger');
    expect(card?.textContent).toContain('Con el conductor');
    expect(card?.textContent).toContain('Lucía Cortés (pasajero) · conductor: Javier Pardo');
    expect(card?.textContent).toContain('Roquetas de Mar → Campus UAL');
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

  it('reviews an incident with its resolution and reloads', async () => {
    await render();
    create.mockImplementation(({ componentProps }) =>
      Promise.resolve({
        present: () => Promise.resolve(),
        onDidDismiss: async () => {
          await componentProps.action('Talked to both of them');
          return { role: 'confirm' };
        },
      }),
    );

    await fixture.componentInstance.handleReview(INCIDENT);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        componentProps: expect.objectContaining({ fieldLabel: 'Resolución', maxLength: 1000 }),
      }),
    );
    expect(review).toHaveBeenCalledWith('i1', 'Talked to both of them');
    expect(showSuccess).toHaveBeenCalledWith('Incidencia revisada.');
    await fixture.whenStable();
    expect(list).toHaveBeenCalledTimes(2);
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
