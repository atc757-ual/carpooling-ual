import { renderHeadingContent } from '../../../core/services/ui/heading-content.testing';
import { Location } from '@angular/common';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { ApiError } from '../../../core/models/api-error.model';
import { AdminIncident } from '../../../core/models/admin-incident.model';
import { AdminIncidentsService } from '../../../core/services/admin/admin-incidents.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { AdminIncidentDetailPage } from './admin-incident-detail.page';
import { INCIDENT } from './admin-incident.testing';

const ADA = { id: 'a1', name: 'Ada Admin' };
const IN_REVIEW: AdminIncident = {
  ...INCIDENT,
  status: 'in_review',
  reviewInProgress: { by: ADA, since: '2026-11-02T09:00:00.000Z' },
};

describe('AdminIncidentDetailPage', () => {
  let fixture: ComponentFixture<AdminIncidentDetailPage>;
  const get = vi.fn();
  const review = vi.fn().mockResolvedValue(undefined);
  const startReview = vi.fn().mockResolvedValue(undefined);
  const releaseReview = vi.fn().mockResolvedValue(undefined);
  const showSuccess = vi.fn().mockResolvedValue(undefined);
  const showError = vi.fn().mockResolvedValue(undefined);
  const create = vi.fn();

  async function render(): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [AdminIncidentDetailPage],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        {
          provide: AdminIncidentsService,
          useValue: { get, review, startReview, releaseReview },
        },
        { provide: ToastService, useValue: { showSuccess, showError } },
        { provide: AuthService, useValue: { currentUser: signal({ id: ADA.id }) } },
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
    expect(heading.querySelector('.status')?.textContent).toBe('Registrada');
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

  it('resolves it with the resolution when it is mine, and reloads', async () => {
    get.mockResolvedValue(IN_REVIEW);
    const root = await render();
    const actions = Array.from(root.querySelectorAll('.incident-review__actions ion-button'));
    expect(actions.map((button) => button.textContent?.trim())).toEqual([
      'Marcar atendida',
      'Dejar de revisar',
    ]);
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
    expect(showSuccess).toHaveBeenCalledWith('Incidencia atendida.');
    await fixture.whenStable();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('shows the moments of a resolved incident with its resolution and no actions', async () => {
    get.mockResolvedValue({
      ...INCIDENT,
      status: 'reviewed',
      review: {
        by: ADA,
        startedAt: '2026-11-02T09:00:00.000Z',
        reviewedAt: '2026-11-02T10:00:00.000Z',
        resolution: 'Both were contacted',
      },
    });

    const root = await render();

    const moments = Array.from(root.querySelectorAll('.incident-moments__moment'));
    expect(moments).toHaveLength(3);
    expect(moments.every((moment) => moment.matches('.incident-moments__moment--done'))).toBe(true);
    expect(moments[2].textContent).toContain('Por Ada Admin');
    expect(root.querySelector('.incident-moments__note')?.textContent).toBe('Both were contacted');
    expect(root.querySelector('.incident-review__actions')).toBeNull();
  });

  it('starts the review of a registered one, with the moments still pending', async () => {
    const root = await render();
    expect(root.querySelectorAll('.incident-moments__moment--done')).toHaveLength(1);
    expect(root.textContent).toContain('Pendiente');

    // Dos toques seguidos: una sola petición
    await Promise.all([
      fixture.componentInstance.handleStartReview(),
      fixture.componentInstance.handleStartReview(),
    ]);

    expect(startReview).toHaveBeenCalledTimes(1);
    expect(startReview).toHaveBeenCalledWith('i1');
    expect(showSuccess).toHaveBeenCalledWith('Has empezado a revisar la incidencia.');
    expect(fixture.componentInstance.isBusy()).toBe(false);
    await fixture.whenStable();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('leaves the review it has, and says why when it cannot', async () => {
    get.mockResolvedValue(IN_REVIEW);
    await render();

    await fixture.componentInstance.handleReleaseReview();
    expect(releaseReview).toHaveBeenCalledWith('i1');
    expect(showSuccess).toHaveBeenCalledWith('Has dejado de revisar la incidencia.');
    await fixture.whenStable();

    startReview.mockRejectedValueOnce(new ApiError('INCIDENT_REVIEW_TAKEN', 409));
    await fixture.componentInstance.handleStartReview();
    expect(showError).toHaveBeenCalled();
    await fixture.whenStable();
    expect(get).toHaveBeenCalledTimes(3);
  });

  it('only shows who reviews it when another admin has it', async () => {
    get.mockResolvedValue({
      ...IN_REVIEW,
      reviewInProgress: { by: { id: 'b2', name: 'Bea Admin' }, since: '2026-11-02T09:00:00.000Z' },
    });

    const root = await render();

    expect(root.querySelector('.notice--info')?.textContent).toContain(
      'La está revisando Bea Admin',
    );
    expect(root.querySelector('.incident-review__actions')).toBeNull();
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
