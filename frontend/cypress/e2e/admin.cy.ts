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

      cy.contains('.admin-nav__link', 'Usuarios').click();

      cy.location('pathname').should('eq', '/admin/users');
      cy.contains('.admin-nav__link', 'Usuarios').should('have.attr', 'aria-current', 'page');
      cy.contains('h1', 'Usuarios');
      cy.contains('output.admin-empty', 'Disponible pronto');
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
