import { VIEWPORTS } from '../support/e2e';

const EMAIL = 'lucia.cortes@ual.es';

function accessToken(profiles: string[]) {
  return {
    '@type': 'AccessToken',
    accessToken: 'access-1',
    tokenType: 'Bearer',
    expiresIn: 900,
    refreshToken: 'refresh-1',
    refreshTokenExpiresAt: '2026-11-01T00:00:00.000Z',
    user: {
      '@type': 'User',
      id: 'user-1',
      href: '/api/users/user-1',
      name: 'Lucía Cortés',
      email: EMAIL,
      phone: '+34612345678',
      profiles,
      activeMode: null,
    },
  };
}

const VEHICLE = {
  '@type': 'Vehicle',
  id: 'v1',
  plate: '1234BCD',
  model: 'Seat León',
  capacity: 3,
  status: 'available',
};

// Se entra por el login con esos perfiles y se abre el Perfil
function openProfile(profiles: string[]): void {
  cy.intercept('POST', '/api/auth/login', accessToken(profiles));
  cy.visit('/auth/login');
  cy.get('app-login ion-input[formControlName="email"] input').type(EMAIL);
  cy.get('app-login ion-input[formControlName="password"] input').type('secreta123');
  cy.contains('ion-button', 'Iniciar sesión').click();
  cy.location('pathname').should('be.oneOf', ['/tabs/search', '/tabs/publish']);
  cy.contains('app-tabs .top-nav__link:visible, app-tabs ion-tab-button:visible', 'Perfil').click();
  cy.location('pathname').should('eq', '/tabs/profile');
}

for (const viewport of VIEWPORTS) {
  describe(`Profile (${viewport.name})`, () => {
    beforeEach(() => {
      cy.viewport(viewport.width, viewport.height);
      cy.intercept('GET', '/api/vehicles*', [VEHICLE]);
    });

    it('shows the account and the vehicles of a driver', () => {
      openProfile(['driver']);

      cy.contains('app-profile', 'Lucía Cortés').should('be.visible');
      cy.contains('app-profile', '+34 612 345 678');
      cy.contains('app-profile-vehicles', '1234BCD');
      cy.contains('app-profile-vehicles', 'Seat León · hasta 3 pasajeros');
    });

    it('removes a vehicle after confirming it', () => {
      cy.intercept('DELETE', '/api/vehicles/v1', { statusCode: 204 }).as('remove');
      openProfile(['driver']);

      cy.contains('app-profile-vehicles ion-button', 'Eliminar').click();
      cy.contains('ion-alert button', 'Eliminar').click();

      cy.wait('@remove');
    });
  });
}
