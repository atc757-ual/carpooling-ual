import { renderHeadingContent } from '../../../core/services/ui/heading-content.testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { ApiError } from '../../../core/models/api-error.model';
import { AdminIncidentsService } from '../../../core/services/admin/admin-incidents.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { AdminIncidentDetailPage } from './admin-incident-detail.page';
import { INCIDENT } from './admin-incident.testing';

describe('AdminIncidentDetailPage', () => {
  let fixture: ComponentFixture<AdminIncidentDetailPage>;
  const get = vi.fn();
  const review = vi.fn().mockResolvedValue(undefined);
  const showSuccess = vi.fn().mockResolvedValue(undefined);
  const create = vi.fn();

  async function render(): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [AdminIncidentDetailPage],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        { provide: AdminIncidentsService, useValue: { get, review } },
        { provide: ToastService, useValue: { showSuccess } },
        { provide: ModalController, useValue: { create } },
      ],
    });
    fixture = TestBed.createComponent(AdminIncidentDetailPage);
    fixture.componentRef.setInput('id', 'i1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    get.mockResolvedValue(INCIDENT);
  });

  it('shows the report, the trip and links to the people involved', async () => {
    const root = await render();

    expect(renderHeadingContent().querySelector('h1')?.textContent).toContain('Con el conductor');
    expect(root.textContent).toContain('The driver did not stop at the pickup point');
    expect(root.textContent).toContain('Roquetas de Mar → Campus UAL');
    const links = Array.from(root.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(links).toEqual(['/admin/users/p1', '/admin/users/d1']);
    expect(root.querySelector('.incident__review')).not.toBeNull();
  });

  it('reviews it with the resolution and reloads', async () => {
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

    await fixture.componentInstance.handleReview();

    expect(review).toHaveBeenCalledWith('i1', 'Talked to both of them');
    expect(showSuccess).toHaveBeenCalledWith('Incidencia revisada.');
    await fixture.whenStable();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('shows the resolution of a reviewed incident without the review button', async () => {
    get.mockResolvedValue({
      ...INCIDENT,
      status: 'reviewed',
      review: { reviewedAt: '2026-11-02T10:00:00.000Z', resolution: 'Both were contacted' },
    });

    const root = await render();

    expect(root.textContent).toContain('Both were contacted');
    expect(root.querySelector('.incident__review')).toBeNull();
  });

  it('tells an unknown incident apart from other errors', async () => {
    get.mockRejectedValue(new ApiError('INCIDENT_NOT_FOUND', 404));
    expect((await render()).textContent).toContain('No encontramos esta incidencia.');

    TestBed.resetTestingModule();
    get.mockRejectedValue(new ApiError('INTERNAL_ERROR', 500));
    expect((await render()).textContent).toContain('No hemos podido cargarla.');
  });

  it('goes back to the list when it was opened directly', async () => {
    await render();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    await fixture.componentInstance.handleBack();

    expect(navigate).toHaveBeenCalledWith('/admin/incidents');
  });
});
