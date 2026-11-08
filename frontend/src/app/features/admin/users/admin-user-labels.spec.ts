import { AdminUserRow } from '../../../core/models/admin-user.model';
import { initials, rolesLabel, statusChips } from './admin-user-labels';

function row(overrides: Partial<AdminUserRow> = {}): AdminUserRow {
  return {
    id: 'u1',
    href: '/api/users/u1',
    name: 'Lucía Cortés',
    email: 'lcc123@inlumine.ual.es',
    profiles: [
      { profile: 'passenger', isActive: true },
      { profile: 'driver', isActive: true },
    ],
    statuses: ['active'],
    tripCount: 42,
    openIncidents: 0,
    suspensions: null,
    createdAt: '2026-10-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('admin user labels', () => {
  it('takes the initials of the first two words of the name', () => {
    expect(initials('Lucía Cortés Martín')).toBe('LC');
    expect(initials('  álvaro ')).toBe('Á');
  });

  it('lists the active profiles in a fixed order', () => {
    expect(rolesLabel(row())).toBe('Conductor · Pasajero');
    expect(
      rolesLabel(
        row({
          profiles: [
            { profile: 'admin', isActive: true },
            { profile: 'passenger', isActive: false },
          ],
        }),
      ),
    ).toBe('Administrador');
    expect(rolesLabel(row({ profiles: [] }))).toBe('Sin perfil activo');
  });

  it('gives one chip per status with its tone', () => {
    expect(statusChips(row())).toEqual([{ label: 'Activo', tone: 'success' }]);
    expect(statusChips(row({ statuses: ['email_unverified', 'deleted'] }))).toEqual([
      { label: 'Correo sin verificar', tone: 'info' },
      { label: 'Cuenta eliminada', tone: 'neutral' },
    ]);
  });

  it('counts the open incidents', () => {
    expect(statusChips(row({ statuses: ['open_incidents'], openIncidents: 1 }))[0].label).toBe(
      '1 incidencia',
    );
    expect(statusChips(row({ statuses: ['open_incidents'], openIncidents: 2 }))[0].label).toBe(
      '2 incidencias',
    );
  });

  it('tells until when the suspension lasts, the later of both roles', () => {
    const suspended = row({
      statuses: ['suspended'],
      suspensions: { driver: '2026-11-05T10:00:00.000Z', passenger: '2026-11-09T10:00:00.000Z' },
    });
    expect(statusChips(suspended)[0]).toEqual({
      label: 'Suspendido hasta el 9 nov',
      tone: 'warning',
    });
    expect(statusChips(row({ statuses: ['suspended'] }))[0].label).toBe('Suspendido');
  });
});
