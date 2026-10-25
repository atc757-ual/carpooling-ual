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

    it('logs in and goes to the home page', () => {
      cy.intercept('POST', LOGIN_URL, ACCESS_TOKEN).as('login');

      fillForm('ana@ual.es', 'secreta123');
      cy.contains('ion-button', 'Iniciar sesión').click();

      cy.wait('@login')
        .its('request.body')
        .should('deep.equal', { email: 'ana@ual.es', password: 'secreta123' });
      cy.location('pathname').should('eq', '/');
      cy.contains('h1', 'Hola, Ana').should('be.visible');
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
      cy.get('.login__error')
        .should('be.visible')
        .and('contain', 'Correo o contraseña incorrectos.');
      cy.location('pathname').should('eq', '/auth/login');
    });

    it('does not call the API while the form is invalid', () => {
      cy.intercept('POST', LOGIN_URL, cy.spy().as('login'));

      cy.get('ion-input[formControlName="email"] input').type('no-es-un-correo');
      cy.contains('ion-button', 'Iniciar sesión').click();

      cy.contains('Introduce un correo válido.').should('be.visible');
      cy.contains('Introduce tu contraseña.').should('be.visible');
      cy.get('@login').should('not.have.been.called');
    });

    it('does not call the API with an email from outside the UAL', () => {
      cy.intercept('POST', LOGIN_URL, cy.spy().as('login'));

      fillForm('ana@gmail.com', 'secreta123');
      cy.contains('ion-button', 'Iniciar sesión').click();

      cy.contains('Usa tu correo de la Universidad de Almería.').should('be.visible');
      cy.get('@login').should('not.have.been.called');
    });

    it('shows the password on demand', () => {
      cy.get('ion-input[formControlName="password"] input').should('have.attr', 'type', 'password');
      cy.get('.login__password-toggle').click();
      cy.get('ion-input[formControlName="password"] input').should('have.attr', 'type', 'text');
    });

    it('links to the register screen', () => {
      cy.contains('ion-button', 'Crear cuenta').should('be.visible');
    });

    it('goes back to the welcome screen', () => {
      const backButton =
        viewport.name === 'mobile' ? 'ion-header ion-back-button' : '.top-bar ion-back-button';
      cy.get(backButton).click();
      cy.location('pathname').should('eq', '/auth/welcome');
    });
  });
}
