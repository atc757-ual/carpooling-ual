import { VIEWPORTS } from '../support/e2e';

const EMAIL = 'mario.perez@ual.es';

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
      name: 'Mario Pérez',
      email: EMAIL,
      phone: '+34612345678',
      profiles,
    },
  };
}

// Se llega como en la app: tras verificar el correo, que abre la sesión
function verifyEmail(): void {
  cy.intercept('POST', '/api/auth/verify-email', accessToken([]));
  cy.visit('/auth/verify', {
    onBeforeLoad: (win) => win.sessionStorage.setItem('auth.pending-verification-email', EMAIL),
  });
  cy.get('ion-input-otp input').each(($input, index) => {
    cy.wrap($input).type('284619'[index]);
  });
  cy.contains('ion-button', 'Verificar correo').click();
  cy.location('pathname').should('eq', '/modes');
}

for (const viewport of VIEWPORTS) {
  describe(`Choose mode (${viewport.name})`, () => {
    beforeEach(() => {
      cy.viewport(viewport.width, viewport.height);
      verifyEmail();
    });

    it('activates both profiles and starts as a passenger', () => {
      cy.intercept('PUT', '/api/users/me/profiles/*', { statusCode: 200, body: {} }).as('activate');
      cy.intercept('POST', '/api/auth/refresh', accessToken(['passenger', 'driver']));

      cy.get('ion-button').contains('Continuar').should('exist');
      cy.contains('label', 'Ambos').click();
      cy.contains('Empezarás en modo pasajero').should('be.visible');
      cy.contains('ion-button', 'Continuar como pasajero').click();

      cy.wait('@activate').its('request.url').should('contain', '/profiles/passenger');
      cy.wait('@activate').its('request.url').should('contain', '/profiles/driver');
      cy.location('pathname').should('eq', '/');
    });

    it('keeps the button disabled until a mode is chosen', () => {
      cy.get('ion-button').should('have.attr', 'disabled');
      cy.contains('label', 'Conductor').click();
      cy.contains('ion-button', 'Continuar como conductor').should('not.have.attr', 'disabled');
    });
  });
}
