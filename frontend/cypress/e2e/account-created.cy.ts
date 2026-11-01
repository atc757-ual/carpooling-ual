import { VIEWPORTS } from '../support/e2e';

const VERIFY_URL = '/api/auth/verify-email';
const EMAIL = 'mario.perez@ual.es';

const ACCESS_TOKEN = {
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
    profiles: ['passenger'],
  },
};

// La pantalla se abre al verificar el correo: se llega como en la app, desde la
// pantalla del código
function verifyAndReach(isNewAccount: boolean): void {
  cy.intercept('POST', VERIFY_URL, ACCESS_TOKEN).as('verify');
  cy.visit('/auth/verify', {
    onBeforeLoad: (win) => {
      win.sessionStorage.setItem('auth.pending-verification-email', EMAIL);
      win.sessionStorage.setItem('auth.pending-verification-is-new-account', String(isNewAccount));
    },
  });

  cy.get('ion-input-otp input').each(($input, index) => {
    cy.wrap($input).type('042619'[index]);
  });

  cy.wait('@verify');
  cy.location('pathname').should('eq', '/account-created');
}

for (const viewport of VIEWPORTS) {
  describe(`Account created (${viewport.name})`, () => {
    beforeEach(() => {
      cy.viewport(viewport.width, viewport.height);
    });

    it('says the account is ready and enters the app by Search', () => {
      verifyAndReach(true);

      cy.contains('h1', '¡Cuenta creada!').should('be.visible');
      cy.contains('ion-button', 'Entrar a la app').click();
      cy.location('pathname').should('eq', '/tabs/search');
    });

    it('closes the session and goes back to the welcome screen', () => {
      verifyAndReach(true);
      cy.intercept('POST', '/api/auth/logout', { statusCode: 204 }).as('logout');

      cy.contains('ion-button', 'Entrar más tarde').click();

      cy.wait('@logout');
      cy.location('pathname').should('eq', '/auth/welcome');
    });

    it('says the email is verified when the code came from a login', () => {
      verifyAndReach(false);

      cy.contains('h1', '¡Correo verificado!').should('be.visible');
    });
  });
}
