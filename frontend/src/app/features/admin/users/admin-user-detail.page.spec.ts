import { renderHeadingContent } from '../../../core/services/ui/heading-content.testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { AdminUserDetail } from '../../../core/models/admin-user.model';
import { ApiError } from '../../../core/models/api-error.model';
import { AdminUsersService } from '../../../core/services/admin/admin-users.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { AdminUserDetailPage, profileRows } from './admin-user-detail.page';

const DETAIL: AdminUserDetail = {
  id: 'u1',
  href: '/api/users/u1',
  name: 'Lucía Cortés',
  email: 'lcc123@inlumine.ual.es',
  profiles: [
    { profile: 'driver', isActive: true },
    { profile: 'passenger', isActive: false },
  ],
  statuses: ['suspended'],
  tripCount: 3,
  openIncidents: 0,
  suspensions: { driver: '2026-11-09T10:00:00.000Z', passenger: null },
  createdAt: '2026-10-01T10:00:00.000Z',
  phone: '+34600123456',
  isPhoneVerified: true,
  avatarKey: null,
  ratings: { driver: { average: 4.5, count: 4 }, passenger: null },
  vehicles: [],
  trips: [],
  requests: [],
  incidents: [],
  lateCancellations: [
    {
      tripId: 't1',
      role: 'driver',
      cancelledAt: '2026-11-01T08:00:00.000Z',
      waivedAt: null,
    },
  ],
  consents: null,
};

describe('profileRows', () => {
  it('offers activating or deactivating the own profiles and giving or removing admin', () => {
    expect(
      profileRows(DETAIL).map(({ profile, actionText, rating }) => [profile, actionText, rating]),
    ).toEqual([
      ['driver', 'Desactivar', '4,5 ★ (4)'],
      ['passenger', 'Activar', 'Sin valoraciones'],
      ['admin', 'Dar', null],
    ]);
    const admin = profileRows({ ...DETAIL, profiles: [{ profile: 'admin', isActive: true }] });
    expect(admin.map(({ actionText }) => actionText)).toEqual(['Quitar']);
  });
});

describe('AdminUserDetailPage', () => {
  let fixture: ComponentFixture<AdminUserDetailPage>;
  const get = vi.fn();
  const setProfileActive = vi.fn().mockResolvedValue(undefined);
  const liftSuspension = vi.fn().mockResolvedValue(undefined);
  const showSuccess = vi.fn().mockResolvedValue(undefined);
  const create = vi.fn();

  // El modal «confirma» ejecutando la acción con un motivo
  function confirmingModal(): void {
    create.mockImplementation(({ componentProps }) =>
      Promise.resolve({
        present: () => Promise.resolve(),
        onDidDismiss: async () => {
          await componentProps.action('Checked with the user');
          return { role: 'confirm' };
        },
      }),
    );
  }

  async function render(): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [AdminUserDetailPage],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        { provide: AdminUsersService, useValue: { get, setProfileActive, liftSuspension } },
        { provide: ToastService, useValue: { showSuccess } },
        { provide: ModalController, useValue: { create } },
      ],
    });
    fixture = TestBed.createComponent(AdminUserDetailPage);
    fixture.componentRef.setInput('id', 'u1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    get.mockResolvedValue(DETAIL);
  });

  it('shows the account, the suspension and the late cancellations', async () => {
    const root = await render();

    const heading = renderHeadingContent();
    expect(heading.querySelector('h1')?.textContent).toContain('Lucía Cortés');
    expect(heading.textContent).toContain('(verificado)');
    expect(root.textContent).toContain('Suspendido como conductor hasta el 9 nov 2026');
    expect(root.textContent).toContain('como conductor');
    expect(root.textContent).toContain('La cuenta está eliminada.');
  });

  it('changes a profile with the reason and reloads', async () => {
    await render();
    confirmingModal();

    await fixture.componentInstance.handleProfile(profileRows(DETAIL)[0]);

    expect(setProfileActive).toHaveBeenCalledWith('u1', {
      profile: 'driver',
      isActive: false,
      reason: 'Checked with the user',
    });
    expect(showSuccess).toHaveBeenCalledWith('Perfil de conductor desactivado.');
    await fixture.whenStable();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('lifts a suspension with the reason', async () => {
    await render();
    confirmingModal();

    await fixture.componentInstance.handleLiftSuspension('driver');

    expect(liftSuspension).toHaveBeenCalledWith('u1', {
      role: 'driver',
      reason: 'Checked with the user',
    });
    expect(showSuccess).toHaveBeenCalledWith('Suspensión levantada.');
  });

  it('does nothing when the confirmation is cancelled', async () => {
    await render();
    create.mockResolvedValue({
      present: () => Promise.resolve(),
      onDidDismiss: () => Promise.resolve({ role: 'cancel' }),
    });

    await fixture.componentInstance.handleLiftSuspension('driver');

    expect(liftSuspension).not.toHaveBeenCalled();
    expect(showSuccess).not.toHaveBeenCalled();
  });

  it('tells an unknown user apart from other errors', async () => {
    get.mockRejectedValue(new ApiError('USER_NOT_FOUND', 404));
    const root = await render();
    expect(root.textContent).toContain('No encontramos este usuario.');

    TestBed.resetTestingModule();
    get.mockRejectedValue(new ApiError('INTERNAL_ERROR', 500));
    const failing = await render();
    expect(failing.textContent).toContain('No hemos podido cargar el usuario.');
  });

  it('goes back to the list when it was opened directly', async () => {
    await render();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    await fixture.componentInstance.handleBack();

    expect(navigate).toHaveBeenCalledWith('/admin/users');
  });
});
