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
  // Esperar a que termine la transición: la verificación queda oculta debajo
  cy.get('app-verify').should('have.class', 'ion-page-hidden');
  // Se cierra el aviso «Correo UAL verificado», que en el móvil tapa la cabecera
  cy.get('ion-toast').then(($toast) => ($toast[0] as HTMLIonToastElement).dismiss());
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

      cy.contains('app-modes ion-button', 'Continuar').should('exist');
      cy.contains('label', 'Ambos').click();
      cy.contains('Empezarás en modo pasajero').should('be.visible');
      cy.contains('ion-button', 'Continuar como pasajero').click();

      cy.wait('@activate').its('request.url').should('contain', '/profiles/passenger');
      cy.wait('@activate').its('request.url').should('contain', '/profiles/driver');
      cy.location('pathname').should('eq', '/tabs/home');
    });

    it('ends the session and goes to the welcome screen with the back arrow', () => {
      cy.intercept('POST', '/api/auth/logout', { statusCode: 204 }).as('logout');
      const backButton =
        viewport.name === 'mobile' ? 'ion-header .back-button' : '.top-bar .back-button';

      cy.get(`app-modes ${backButton}`).click();

      cy.wait('@logout');
      cy.location('pathname').should('eq', '/auth/welcome');
    });

    it('ends the session too with the browser back button', () => {
      cy.intercept('POST', '/api/auth/logout', { statusCode: 204 }).as('logout');

      cy.go('back');

      cy.wait('@logout');
      cy.location('pathname').should('eq', '/auth/welcome');
    });

    it('keeps the button disabled until a mode is chosen', () => {
      cy.get('app-modes ion-button[type="submit"]').should('have.attr', 'disabled');
      cy.contains('label', 'Conductor').click();
      cy.contains('ion-button', 'Continuar como conductor').should('not.have.attr', 'disabled');
    });
  });
}
