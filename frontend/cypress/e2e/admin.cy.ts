import { VIEWPORTS } from '../support/e2e';

// Sesión recuperada al abrir la app: el token de renovación guardado
// (Preferences en la web) y la renovación que devuelve el usuario
function accessToken(profiles: string[]) {
  return {
    '@type': 'AccessToken',
    accessToken: 'access-1',
    tokenType: 'Bearer',
    expiresIn: 900,
    refreshToken: 'refresh-1',
    refreshTokenExpiresAt: '2026-12-01T00:00:00.000Z',
    user: {
      '@type': 'User',
      id: 'admin-1',
      href: '/api/users/admin-1',
      name: 'Admin UAL',
      email: 'admin@ual.es',
      profiles,
    },
  };
}

// Una fila de GET /api/admin/users
const USER_ROW = {
  '@type': 'AdminUserRow',
  id: '0b6f8a52-3c1e-4f7a-9d2b-5e8c1a4f7b90',
  href: '/api/users/0b6f8a52-3c1e-4f7a-9d2b-5e8c1a4f7b90',
  name: 'Lucía Cortés',
  email: 'lcc123@inlumine.ual.es',
  profiles: [
    { profile: 'driver', isActive: true },
    { profile: 'passenger', isActive: true },
  ],
  statuses: ['open_incidents'],
  tripCount: 42,
  openIncidents: 2,
  suspensions: null,
  createdAt: '2026-10-01T10:00:00.000Z',
};

// GET /api/admin/users/{id} de esa fila
const USER_DETAIL = {
  ...USER_ROW,
  '@type': 'AdminUserDetail',
  phone: '+34600123456',
  isPhoneVerified: true,
  avatarKey: null,
  ratings: { driver: { average: 4.5, count: 4 }, passenger: null },
  vehicles: [],
  trips: [],
  requests: [],
  incidents: [],
  lateCancellations: [],
  consents: null,
};

function visitWithSession(path: string, profiles: string[]): void {
  cy.intercept('POST', '/api/auth/refresh', accessToken(profiles));
  cy.visit(path, {
    onBeforeLoad(win) {
      win.localStorage.setItem('CapacitorStorage.auth.refresh-token', 'refresh-1');
    },
  });
}

for (const viewport of VIEWPORTS) {
  describe(`Admin panel (${viewport.name})`, () => {
    beforeEach(() => {
      cy.viewport(viewport.width, viewport.height);
      cy.intercept('GET', '/api/incidents?status=open*', {
        body: [],
        headers: { 'X-Total-Count': '2', 'Access-Control-Expose-Headers': 'X-Total-Count' },
      });
    });

    it('opens the simulation with the six sections and the open incidents', () => {
      visitWithSession('/admin', ['admin']);

      cy.location('pathname').should('eq', '/admin/simulation');
      cy.contains('.admin-header__brand', 'UAL Carpool · Admin');
      cy.contains('.admin-header__email', 'admin@ual.es');
      cy.get('.admin-nav__link').should('have.length', 6);
      cy.contains('.admin-nav__link', 'Incidencias')
        .find('.admin-nav__badge')
        .should('contain', '2');
      cy.contains('h1', 'Simulación de escenarios');
    });

    it('moves between sections', () => {
      visitWithSession('/admin', ['admin']);

      cy.contains('.admin-nav__link', 'Viajes').click();

      cy.location('pathname').should('eq', '/admin/trips');
      cy.contains('.admin-nav__link', 'Viajes').should('have.attr', 'aria-current', 'page');
      cy.contains('h1', 'Viajes');
      cy.contains('output.admin-empty', 'Disponible pronto');
    });

    it('opens a user and deactivates a profile with a reason', () => {
      cy.intercept('GET', '/api/admin/users?*', {
        body: [USER_ROW],
        headers: { 'X-Total-Count': '1', 'Access-Control-Expose-Headers': 'X-Total-Count' },
      });
      cy.intercept('GET', `/api/admin/users/${USER_ROW.id}`, USER_DETAIL).as('detail');
      cy.intercept('PUT', `/api/users/${USER_ROW.id}/profiles/driver`, {}).as('profile');
      visitWithSession('/admin/users', ['admin']);

      cy.contains('a', 'Ver perfil').click();
      cy.wait('@detail');
      cy.contains('h1', 'Lucía Cortés');
      cy.contains('li', 'Conductor').contains('ion-button', 'Desactivar').click();

      cy.get('app-reason-confirm-modal').within(() => {
        cy.contains('¿Desactivar el perfil de conductor?');
        cy.contains('ion-button', 'Desactivar perfil').should('have.attr', 'disabled');
        cy.get('ion-textarea textarea').type('Several reports on the same week');
        cy.contains('ion-button', 'Desactivar perfil').should('not.have.attr', 'disabled');
        cy.contains('ion-button', 'Desactivar perfil').click();
      });

      cy.wait('@profile')
        .its('request.body')
        .should('deep.equal', { isActive: false, reason: 'Several reports on the same week' });
      cy.get('ion-toast')
        .shadow()
        .find('.toast-message')
        .should('contain', 'Perfil de conductor desactivado.');
    });

    it('lists the users, filters them and keeps the filters in the URL', () => {
      cy.intercept('GET', '/api/admin/users?*', (request) => {
        const isSuspended = request.query['status'] === 'suspended';
        request.reply({
          body: isSuspended ? [] : [USER_ROW],
          headers: {
            'X-Total-Count': isSuspended ? '0' : '1284',
            'Access-Control-Expose-Headers': 'X-Total-Count',
          },
        });
      }).as('users');
      visitWithSession('/admin/users', ['admin']);

      cy.wait('@users');
      cy.contains('h1', 'Usuarios · 1');
      cy.contains('tbody tr', 'Lucía Cortés').within(() => {
        cy.contains('Conductor · Pasajero');
        cy.contains('.status', '2 incidencias');
        cy.contains('a', 'Ver perfil').should('have.attr', 'href', `/admin/users/${USER_ROW.id}`);
      });
      cy.contains('.pagination__range', '1–20 de 1');

      visitWithSession('/admin/users?status=suspended', ['admin']);
      cy.contains('Ningún usuario coincide');
      cy.contains('ion-button', 'Quitar filtros').click();
      cy.location('search').should('eq', '');
      cy.contains('tbody tr', 'Lucía Cortés');
    });

    it('sends users without the admin profile to their profile', () => {
      visitWithSession('/admin', ['passenger']);

      cy.location('pathname').should('eq', '/tabs/profile');
    });

    it('logs an admin without other profiles into the panel and keeps them there', () => {
      cy.intercept('POST', '/api/auth/login', accessToken(['admin']));
      cy.visit('/auth/login');
      cy.get('app-login ion-input[formControlName="email"] input').type('admin@ual.es');
      cy.get('app-login ion-input[formControlName="password"] input').type('secreta123');
      cy.contains('ion-button', 'Iniciar sesión').click();

      cy.location('pathname').should('eq', '/admin/simulation');
      visitWithSession('/tabs/publish', ['admin']);
      cy.location('pathname').should('eq', '/admin/simulation');
    });

    it('offers going to the app only to admins who also travel', () => {
      visitWithSession('/admin', ['admin']);
      cy.get('#admin-account-trigger').click();
      cy.get('ion-popover ion-item').should('have.length', 1).and('contain', 'Cerrar sesión');

      visitWithSession('/admin', ['passenger', 'admin']);
      cy.get('#admin-account-trigger').click();
      cy.contains('ion-popover ion-item', 'Ir a la app').click();
      cy.location('pathname').should('match', /^\/tabs/);
    });
  });
}
