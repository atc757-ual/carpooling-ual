import { VIEWPORTS } from '../support/e2e';

const REGISTER_URL = '/api/auth/register';

function fillForm(email: string): void {
  cy.get('ion-input[formControlName="name"] input').type('Mario Pérez');
  cy.get('ion-input[formControlName="phone"] input').type('612 345 678');
  cy.get('ion-input[formControlName="email"] input').type(email);
  cy.get('ion-input[formControlName="password"] input').type('secreta123');
  cy.get('ion-checkbox[formControlName="acceptedTerms"]').click();
}

for (const viewport of VIEWPORTS) {
  describe(`Register (${viewport.name})`, () => {
    beforeEach(() => {
      cy.viewport(viewport.width, viewport.height);
      cy.visit('/auth/register');
    });

    it('sends the account data, with a Spanish phone in international format', () => {
      cy.intercept('POST', REGISTER_URL, { statusCode: 201, body: {} }).as('register');

      fillForm('mario.perez@ual.es');
      cy.contains('ion-button', 'Crear cuenta y verificar correo').click();

      cy.wait('@register').its('request.body').should('deep.equal', {
        name: 'Mario Pérez',
        phone: '+34612345678',
        email: 'mario.perez@ual.es',
        password: 'secreta123',
        acceptedTerms: true,
      });
      cy.location('pathname').should('eq', '/auth/verify');
      cy.contains('h1', 'Mira tu bandeja de entrada.').should('be.visible');
      cy.location('search').should('eq', '');
    });

    it('shows the API error when the email is already registered', () => {
      cy.intercept('POST', REGISTER_URL, {
        statusCode: 409,
        body: {
          '@type': 'Error',
          code: 'EMAIL_ALREADY_REGISTERED',
          reason: 'Email already registered',
          message: 'There is already an account with this email',
          status: '409',
        },
      }).as('register');

      fillForm('mario.perez@ual.es');
      cy.contains('ion-button', 'Crear cuenta y verificar correo').click();

      cy.wait('@register');
      cy.get('ion-toast')
        .shadow()
        .find('.toast-message')
        .should('contain', 'Ya hay una cuenta con este correo.');
    });

    it('enables the button only when every field is right and the terms are accepted', () => {
      const submit = 'ion-button[type="submit"]';
      cy.get(submit).should('have.attr', 'disabled');

      fillForm('mario.perez@ual.es');
      cy.get(submit).should('not.have.attr', 'disabled');

      cy.get('ion-checkbox[formControlName="acceptedTerms"]').click();
      cy.get(submit).should('have.attr', 'disabled');
    });

    it('opens the privacy policy without checking the box', () => {
      cy.contains('button', 'política de privacidad').click();

      cy.get('ion-modal').contains('ion-title', 'Política de privacidad').should('be.visible');
      cy.get('ion-modal').contains('h2', 'Tus derechos').should('exist');
      cy.get('ion-modal ion-buttons ion-button').click();
      cy.get('ion-modal').should('not.exist');
      cy.get('ion-checkbox[formControlName="acceptedTerms"]').should(
        'not.have.class',
        'checkbox-checked',
      );
    });

    it('goes back to the welcome screen', () => {
      const backButton =
        viewport.name === 'mobile' ? 'ion-header .back-button' : '.top-bar .back-button';
      cy.get(backButton).click();
      cy.location('pathname').should('eq', '/auth/welcome');
    });

    it('links to the login screen', () => {
      cy.contains('ion-button', 'Ya tengo cuenta').click();
      cy.location('pathname').should('eq', '/auth/login');
    });
  });
}
