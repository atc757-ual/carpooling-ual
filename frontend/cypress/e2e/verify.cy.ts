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

// Una cifra en cada casilla, como al escribirlo a mano
function typeCode(code: string): void {
  cy.get('ion-input-otp input').each(($input, index) => {
    cy.wrap($input).type(code[index]);
  });
}

for (const viewport of VIEWPORTS) {
  describe(`Verify email (${viewport.name})`, () => {
    beforeEach(() => {
      cy.viewport(viewport.width, viewport.height);
      // El correo pendiente lo deja el registro (o el login) en sessionStorage
      cy.visit('/auth/verify', {
        onBeforeLoad: (win) => win.sessionStorage.setItem('auth.pending-verification-email', EMAIL),
      });
    });

    it('shows where the code was sent, without the email in the URL', () => {
      cy.contains(EMAIL).should('be.visible');
      cy.location('search').should('eq', '');
      cy.contains('ion-button', 'Reenviar código en 00:').should('have.attr', 'disabled');
    });

    it('verifies the code, opens the session and goes to choose the mode', () => {
      cy.intercept('POST', VERIFY_URL, ACCESS_TOKEN).as('verify');

      typeCode('042619');
      cy.contains('ion-button', 'Verificar correo').click();

      cy.wait('@verify').its('request.body').should('deep.equal', { email: EMAIL, code: '042619' });
      cy.location('pathname').should('be.oneOf', ['/tabs/search', '/tabs/publish']);
    });

    it('explains a wrong code', () => {
      cy.intercept('POST', VERIFY_URL, {
        statusCode: 400,
        body: {
          '@type': 'Error',
          code: 'INVALID_VERIFICATION_CODE',
          reason: 'Invalid verification code',
          message: 'The code is not valid',
          status: '400',
        },
      }).as('verify');

      typeCode('284610');
      cy.contains('ion-button', 'Verificar correo').click();

      cy.wait('@verify');
      cy.get('ion-toast')
        .shadow()
        .find('.toast-message')
        .should('contain', 'Ese código no es válido.');
    });

    it('asks for a new code with the resend button', () => {
      cy.intercept('POST', '/api/auth/verify-email/resend', { statusCode: 202 }).as('resend');
      // La cuenta atrás de un minuto la prueban los tests unitarios: aquí se
      // termina ya (ng solo existe en desarrollo) para probar el botón
      cy.get('app-verify').then(($page) => {
        const win = $page[0].ownerDocument.defaultView as unknown as {
          ng: { getComponent: (el: Element) => { secondsToResend: { set: (s: number) => void } } };
        };
        win.ng.getComponent($page[0]).secondsToResend.set(0);
      });

      const resend = 'ion-button[form="verify-resend"]';
      cy.get(resend).should('not.have.attr', 'disabled');
      cy.get(resend).click();

      cy.wait('@resend').its('request.body').should('deep.equal', { email: EMAIL });
      cy.contains('te hemos enviado un código nuevo').should('be.visible');
    });

    it('goes back to the register to change the email', () => {
      cy.contains('ion-button', 'Editar correo electrónico').click();
      cy.location('pathname').should('eq', '/auth/register');
    });
  });
}
