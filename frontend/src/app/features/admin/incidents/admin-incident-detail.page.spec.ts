import { renderHeadingContent } from '../../../core/services/ui/heading-content.testing';
import { Location } from '@angular/common';
import { signal } from '@angular/core';
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

  it('titles it with its code and says what, when and who below', async () => {
    await render();
    const heading = renderHeadingContent();

    expect(heading.querySelector('h1')?.textContent).toBe('INC-0042');
    expect(heading.querySelector('.status')?.textContent).toBe('Abierta');
    const subtitle = heading.querySelector('.admin-heading__subtitle')?.textContent ?? '';
    expect(subtitle).toContain('Con el conductor');
    expect(subtitle).toContain('por Lucía Cortés (pasajero)');
    const crumbs = Array.from(
      heading.querySelectorAll('ion-breadcrumb'),
      (crumb) => crumb.textContent,
    );
    expect(crumbs).toEqual(['Incidencias', 'Detalle de incidencia']);
  });

  it('shows the report with its severity, the trip and links to the people', async () => {
    const root = await render();

    expect(root.querySelector('.incident-report--danger')?.textContent).toContain(
      'The driver did not stop at the pickup point',
    );
    expect(root.querySelector('.incident-stops')?.getAttribute('aria-label')).toBe(
      'Roquetas de Mar → Campus UAL',
    );
    expect(root.textContent).toContain('Salida:');
    const links = Array.from(root.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(links).toEqual(['/admin/trips/t1', '/admin/users/p1', '/admin/users/d1']);
  });

  it('says when the trip no longer exists', async () => {
    get.mockResolvedValue({
      ...INCIDENT,
      trip: { ...INCIDENT.trip, departureAt: null, driver: null },
    });

    const root = await render();

    expect(root.textContent).toContain('El viaje ya no existe.');
    expect(root.textContent).not.toContain('Salida:');
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
    expect(root.querySelector('.incident-review__action')).toBeNull();
  });

  it('tells an unknown incident apart from other errors and retries', async () => {
    get.mockRejectedValue(new ApiError('INCIDENT_NOT_FOUND', 404));
    expect((await render()).textContent).toContain('No encontramos esta incidencia.');

    TestBed.resetTestingModule();
    get.mockRejectedValue(new ApiError('INTERNAL_ERROR', 500));
    expect((await render()).textContent).toContain('No hemos podido cargar la incidencia.');

    get.mockResolvedValue(INCIDENT);
    fixture.componentInstance.handleRetry();
    await fixture.whenStable();
    expect(get).toHaveBeenCalledTimes(3);
  });

  it('goes back to the list when it was opened directly, without following the link', async () => {
    await render();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const event = new Event('click');
    const preventDefault = vi.spyOn(event, 'preventDefault');

    await fixture.componentInstance.handleBack(event);

    expect(preventDefault).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/admin/incidents');
  });

  it('goes back to the list with its filters when it came from it', async () => {
    await render();
    const router = TestBed.inject(Router);
    const fromList = signal({ previousNavigation: {} });
    Object.defineProperty(router, 'lastSuccessfulNavigation', { get: () => fromList });
    const back = vi.spyOn(TestBed.inject(Location), 'back').mockImplementation(() => undefined);

    await fixture.componentInstance.handleBack();

    expect(back).toHaveBeenCalled();
  });
});
