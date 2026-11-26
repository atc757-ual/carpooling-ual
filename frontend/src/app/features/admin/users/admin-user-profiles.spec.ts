import { initAppTranslations } from '../../../core/i18n/testing-transloco';
import { AdminUserDetail } from '../../../core/models/admin-user.model';
import { profileMessage, profileRows, profileToast } from './admin-user-profiles';

const DETAIL = {
  id: 'u1',
  name: 'Lucía Cortés',
  profiles: [
    { profile: 'driver', isActive: true },
    { profile: 'passenger', isActive: false },
  ],
  ratings: { driver: { average: 4.5, count: 4 }, passenger: null },
} as AdminUserDetail;

describe('profileRows', () => {
  beforeEach(() => initAppTranslations());

  it('offers disabling or enabling the own profiles and granting admin', () => {
    expect(
      profileRows(DETAIL).map(({ profile, actionText, rating }) => [profile, actionText, rating]),
    ).toEqual([
      ['driver', 'Inhabilitar', '4,5 de 5 · 4 valoraciones'],
      ['passenger', 'Habilitar', 'Sin valoraciones'],
      ['admin', 'Conceder', null],
    ]);
  });

  it('always lists the three profiles and offers granting the missing ones', () => {
    const rows = profileRows({ ...DETAIL, profiles: [{ profile: 'admin', isActive: true }] });

    expect(
      rows.map(({ profile, stateText, actionText }) => [profile, stateText, actionText]),
    ).toEqual([
      ['driver', 'No lo tiene', 'Conceder'],
      ['passenger', 'No lo tiene', 'Conceder'],
      ['admin', 'Activo', 'Revocar'],
    ]);
  });

  it('does not offer changing the own admin profile', () => {
    const admin = { ...DETAIL, profiles: [{ profile: 'admin' as const, isActive: true }] };

    expect(profileRows(admin, 'u1').map(({ canChange }) => canChange)).toEqual([true, true, false]);
    expect(profileRows(admin, 'other').every(({ canChange }) => canChange)).toBe(true);
  });
});

describe('profileMessage and profileToast', () => {
  beforeEach(() => initAppTranslations());

  function rowOf(detail: AdminUserDetail, profile: string) {
    const row = profileRows(detail).find((candidate) => candidate.profile === profile);
    if (!row) {
      throw new Error(`No row for ${profile}`);
    }
    return row;
  }

  it('explains granting a driver profile still needs the declaration and a vehicle', () => {
    const none = { ...DETAIL, profiles: [] };

    expect(profileMessage(rowOf(none, 'driver'), 'Lucía')).toContain('declaración del conductor');
    expect(profileMessage(rowOf(none, 'passenger'), 'Lucía')).toContain('pedir plaza');
    expect(profileToast(rowOf(none, 'driver'))).toBe('Perfil de conductor concedido.');
  });

  it('describes enabling, disabling, granting and revoking', () => {
    const admin = {
      ...DETAIL,
      profiles: [...DETAIL.profiles, { profile: 'admin' as const, isActive: true }],
    };

    expect(profileMessage(rowOf(DETAIL, 'driver'), 'Lucía')).toContain('se cerrarán sus sesiones');
    expect(profileMessage(rowOf(DETAIL, 'passenger'), 'Lucía')).toContain('volver a usar');
    expect(profileMessage(rowOf(DETAIL, 'admin'), 'Lucía')).toContain('podrá entrar en el panel');
    expect(profileMessage(rowOf(admin, 'admin'), 'Lucía')).toContain('dejará de tener acceso');
    expect(profileToast(rowOf(DETAIL, 'driver'))).toBe('Perfil de conductor inhabilitado.');
    expect(profileToast(rowOf(DETAIL, 'passenger'))).toBe('Perfil de pasajero habilitado.');
    expect(profileToast(rowOf(admin, 'admin'))).toBe('Perfil de administrador revocado.');
    expect(
      profileToast(
        rowOf({ ...DETAIL, profiles: [{ profile: 'admin', isActive: false }] }, 'admin'),
      ),
    ).toBe('Perfil de administrador concedido.');
  });
});
