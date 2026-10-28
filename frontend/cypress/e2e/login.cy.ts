import { VIEWPORTS } from '../support/e2e';

const LOGIN_URL = '/api/auth/login';

const USER = {
  '@type': 'User',
  id: 'user-1',
  href: '/api/users/user-1',
  name: 'Ana García',
  email: 'ana@ual.es',
  phone: '+34600123456',
  profiles: ['passenger'],
};

const ACCESS_TOKEN = {
  '@type': 'AccessToken',
  accessToken: 'access-1',
  tokenType: 'Bearer',
  expiresIn: 900,
  refreshToken: 'refresh-1',
  refreshTokenExpiresAt: '2026-11-01T00:00:00.000Z',
  user: USER,
};

function fillForm(email: string, password: string): void {
  cy.get('ion-input[formControlName="email"] input').type(email);
  cy.get('ion-input[formControlName="password"] input').type(password);
}

for (const viewport of VIEWPORTS) {
  describe(`Login (${viewport.name})`, () => {
    beforeEach(() => {
      cy.viewport(viewport.width, viewport.height);
      cy.visit('/auth/login');
    });

    it('completes the email with a suggested UAL domain', () => {
      cy.get('ion-input[formControlName="email"] input').type('ana.garcia');

      cy.contains('app-email-suggestions [role="option"]', 'ana.garcia@inlumine.ual.es').click();

      cy.get('ion-input[formControlName="email"] input').should(
        'have.value',
        'ana.garcia@inlumine.ual.es',
      );
      cy.get('app-email-suggestions [role="listbox"]').should('not.exist');
      // Pulsar la sugerencia no quita el foco: el campo no se marca en rojo
      cy.get('ion-input[formControlName="email"]').should('not.have.class', 'ion-invalid');
    });

    it('chooses a suggestion with the keyboard, without leaving the field', () => {
      cy.get('ion-input[formControlName="email"] input')
        .type('ana.garcia')
        .should('have.attr', 'role', 'combobox')
        .type('{downArrow}')
        .should('have.attr', 'aria-activedescendant')
        .and('match', /option-1$/);

      cy.get('ion-input[formControlName="email"] input').type('{enter}');

      cy.get('ion-input[formControlName="email"] input')
        .should('have.value', 'ana.garcia@ual.es')
        .and('have.focus');
    });

    it('chooses the first suggestion with Tab and moves on', () => {
      cy.get('ion-input[formControlName="email"] input').type('ana.garcia');

      cy.get('ion-input[formControlName="email"] input').trigger('keydown', { key: 'Tab' }).blur();

      cy.get('ion-input[formControlName="email"] input').should(
        'have.value',
        'ana.garcia@inlumine.ual.es',
      );
      cy.get('app-email-suggestions [role="listbox"]').should('not.exist');
      cy.get('ion-input[formControlName="email"]').should('not.have.class', 'ion-invalid');
    });

    it('logs in and goes to the home page', () => {
      cy.intercept('POST', LOGIN_URL, ACCESS_TOKEN).as('login');

      fillForm('ana@ual.es', 'secreta123');
      cy.contains('ion-button', 'Iniciar sesión').click();

      cy.wait('@login')
        .its('request.body')
        .should('deep.equal', { email: 'ana@ual.es', password: 'secreta123' });
      cy.location('pathname').should('be.oneOf', ['/tabs/search', '/tabs/publish']);
      // El saludo: en escritorio, en la franja fija; en el móvil, en Inicio
      cy.get('.greeting-bar p, .home__greeting h1')
        .filter(':visible')
        .should('contain', '¡Hola, Ana!');
    });

    it('shows the API error when the credentials are wrong', () => {
      cy.intercept('POST', LOGIN_URL, {
        statusCode: 401,
        body: {
          '@type': 'Error',
          code: 'INVALID_CREDENTIALS',
          reason: 'Invalid credentials',
          message: 'Email or password is incorrect',
          status: '401',
        },
      }).as('login');

      fillForm('ana@ual.es', 'incorrecta');
      cy.contains('ion-button', 'Iniciar sesión').click();

      cy.wait('@login');
      cy.get('ion-toast')
        .shadow()
        .find('.toast-message')
        .should('contain', 'Correo o contraseña incorrectos.');
      cy.location('pathname').should('eq', '/auth/login');
    });

    it('goes to verify the email when it is not verified yet', () => {
      cy.intercept('POST', LOGIN_URL, {
        statusCode: 403,
        body: { '@type': 'Error', code: 'EMAIL_NOT_VERIFIED', status: '403' },
      });
      cy.intercept('POST', '/api/auth/verify-email/resend', { statusCode: 202 }).as('resend');

      fillForm('ana@ual.es', 'secreta123');
      cy.contains('ion-button', 'Iniciar sesión').click();

      cy.wait('@resend');
      cy.location('pathname').should('eq', '/auth/verify');
      cy.contains('ana@ual.es').should('be.visible');
    });

    it('enables the button only with a UAL email and a password of 8 or more', () => {
      const submit = 'ion-button[type="submit"]';
      cy.get(submit).should('have.attr', 'disabled');

      fillForm('ana@ual.es', 'corta');
      cy.get('ion-input[formControlName="password"] input').blur();
      cy.contains('Introduce tu contraseña (al menos 8 caracteres).').should('be.visible');
      cy.get(submit).should('have.attr', 'disabled');

      cy.get('ion-input[formControlName="password"] input').clear().type('secreta123');
      cy.get(submit).should('not.have.attr', 'disabled');
    });

    it('explains an email from outside the UAL and keeps the button disabled', () => {
      fillForm('ana@gmail.com', 'secreta123');
      cy.get('ion-input[formControlName="email"] input').focus().blur();

      cy.contains('Usa tu correo de la Universidad de Almería.').should('be.visible');
      cy.contains('ion-button', 'Iniciar sesión').should('have.attr', 'disabled');
    });

    it('shows the password on demand', () => {
      cy.get('ion-input[formControlName="password"] input').should('have.attr', 'type', 'password');
      cy.get('.auth-password-toggle').click();
      cy.get('ion-input[formControlName="password"] input').should('have.attr', 'type', 'text');
    });

    it('links to the register screen', () => {
      cy.contains('ion-button', 'Crear cuenta').should('be.visible');
    });

    it('goes back to the welcome screen', () => {
      const backButton =
        viewport.name === 'mobile' ? 'ion-header .back-button' : '.top-bar .back-button';
      cy.get(backButton).click();
      cy.location('pathname').should('eq', '/auth/welcome');
    });
  });
}
