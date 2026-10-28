import { VIEWPORTS } from '../support/e2e';

const RESET_URL = '/api/auth/password-reset';
const EMAIL = 'mario.perez@ual.es';
const NEW_PASSWORD = 'new-secret-password';

// Una cifra en cada casilla, como al escribirlo a mano
function typeCode(code: string): void {
  cy.get('app-reset-code ion-input-otp input').each(($input, index) => {
    cy.wrap($input).type(code[index]);
  });
}

function apiError(code: string, status: number): object {
  return {
    statusCode: status,
    body: { '@type': 'Error', code, reason: code, message: code, status: String(status) },
  };
}

function toastMessage(): Cypress.Chainable<JQuery<HTMLElement>> {
  return cy.get('ion-toast').shadow().find('.toast-message');
}

// Del login al código: el correo y el envío
function requestCode(): void {
  cy.intercept('POST', RESET_URL, { statusCode: 202 }).as('request');
  cy.visit('/auth/login');
  cy.contains('ion-button', '¿Has olvidado tu contraseña?').click();
  cy.location('pathname').should('eq', '/auth/forgot-password');
  cy.get('app-forgot-password ion-input[formControlName="email"] input').type(EMAIL);
  cy.contains('ion-button', 'Enviar código').click();
  cy.wait('@request').its('request.body').should('deep.equal', { email: EMAIL });
  cy.location('pathname').should('eq', '/auth/reset-code');
}

// Del código a la contraseña nueva
function checkCode(): void {
  cy.intercept('POST', `${RESET_URL}/verify`, { statusCode: 204 }).as('check');
  typeCode('042619');
  cy.wait('@check').its('request.body').should('deep.equal', { email: EMAIL, code: '042619' });
  cy.location('pathname').should('eq', '/auth/new-password');
}

function typeNewPassword(): void {
  cy.get('app-new-password ion-input[formControlName="password"] input').type(NEW_PASSWORD);
  cy.get('app-new-password ion-input[formControlName="confirmation"] input').type(NEW_PASSWORD);
  cy.contains('ion-button', 'Guardar nueva contraseña').click();
}

for (const viewport of VIEWPORTS) {
  describe(`Password reset (${viewport.name})`, () => {
    beforeEach(() => {
      cy.viewport(viewport.width, viewport.height);
    });

    it('changes the password with the code and goes to the login', () => {
      requestCode();
      cy.contains(EMAIL).should('be.visible');
      cy.location('search').should('eq', '');
      checkCode();
      cy.intercept('POST', `${RESET_URL}/confirm`, { statusCode: 204 }).as('confirm');

      typeNewPassword();

      cy.wait('@confirm')
        .its('request.body')
        .should('deep.equal', { email: EMAIL, code: '042619', password: NEW_PASSWORD });
      cy.contains('Contraseña actualizada').should('be.visible');
      cy.contains('ion-button', 'Ir a iniciar sesión').click();
      cy.location('pathname').should('eq', '/auth/login');
    });

    it('names the code boxes with their label', () => {
      requestCode();

      // Ionic pone la etiqueta en el grupo de las seis casillas
      cy.get('app-reset-code ion-input-otp .input-otp-group').should(
        'have.attr',
        'aria-labelledby',
        'reset-code-label',
      );
    });

    it('explains a wrong code and stays', () => {
      requestCode();
      cy.intercept('POST', `${RESET_URL}/verify`, apiError('INVALID_VERIFICATION_CODE', 400)).as(
        'check',
      );

      typeCode('284610');

      cy.wait('@check');
      toastMessage().should('contain', 'Ese código no es válido.');
      cy.location('pathname').should('eq', '/auth/reset-code');
    });

    it('explains that the new password must be different', () => {
      requestCode();
      checkCode();
      cy.intercept('POST', `${RESET_URL}/confirm`, apiError('PASSWORD_UNCHANGED', 400)).as(
        'confirm',
      );

      typeNewPassword();

      cy.wait('@confirm');
      toastMessage().should('contain', 'tiene que ser distinta de la actual');
    });

    it('warns when the code expired and offers a new one', () => {
      requestCode();
      checkCode();
      cy.intercept('POST', `${RESET_URL}/confirm`, apiError('INVALID_VERIFICATION_CODE', 400)).as(
        'confirm',
      );

      typeNewPassword();

      cy.wait('@confirm');
      cy.contains('El código ha caducado').should('be.visible');
      cy.contains('ion-button', 'Solicitar otro código').click();
      cy.location('pathname').should('eq', '/auth/forgot-password');
    });

    it('starts again after reloading the code screen (the email is not kept)', () => {
      cy.visit('/auth/reset-code');

      cy.location('pathname').should('eq', '/auth/forgot-password');
    });
  });
}
