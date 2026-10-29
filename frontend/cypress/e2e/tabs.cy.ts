import { VIEWPORTS } from '../support/e2e';

const EMAIL = 'mario.perez@ual.es';

function accessToken(profiles: string[], activeMode: string | null) {
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
      activeMode,
    },
  };
}

// Se entra como en la app, por el login, con esos perfiles y el modo guardado
// en el servidor
function logIn(profiles: string[], activeMode: string | null = null): void {
  cy.intercept('POST', '/api/auth/login', accessToken(profiles, activeMode));
  cy.visit('/auth/login');
  cy.get('app-login ion-input[formControlName="email"] input').type(EMAIL);
  cy.get('app-login ion-input[formControlName="password"] input').type('secreta123');
  cy.contains('ion-button', 'Iniciar sesión').click();
  cy.location('pathname').should('be.oneOf', ['/tabs/search', '/tabs/publish']);
}

for (const viewport of VIEWPORTS) {
  const isDesktop = viewport.name === 'desktop';
  // Los destinos: el menú superior en escritorio y la barra de abajo en el móvil
  const DESTINATION = isDesktop ? 'app-tabs .top-nav__link' : 'app-tabs ion-tab-button';

  function destinationLabels(): Cypress.Chainable<string[]> {
    return cy
      .get(DESTINATION)
      .then(($items) => [...$items].map((item) => item.textContent?.trim() ?? ''));
  }

  function goTo(label: string): void {
    cy.contains(DESTINATION, label).click();
  }

  describe(`Tabs (${viewport.name})`, () => {
    beforeEach(() => {
      cy.viewport(viewport.width, viewport.height);
      cy.intercept('GET', '/api/users/me/notifications*', []);
    });

    it('shows the five fixed destinations and opens Buscar', () => {
      logIn(['passenger']);

      cy.location('pathname').should('eq', '/tabs/search');
      destinationLabels().should('deep.equal', [
        'Buscar',
        'Publicar',
        'Mis viajes',
        'Mensajes',
        'Perfil',
      ]);
    });

    it('opens Publicar when that was the last side used', () => {
      logIn(['passenger', 'driver'], 'driver');

      cy.location('pathname').should('eq', '/tabs/publish');
    });

    it('remembers the side when going to Publicar', () => {
      cy.intercept('PUT', '/api/users/me/active-mode', { activeMode: 'driver' }).as('mode');
      cy.intercept('GET', '/api/users/me/driver-status', { isReady: false });
      cy.intercept('GET', '/api/vehicles*', []);
      logIn(['passenger', 'driver']);

      goTo('Publicar');

      cy.wait('@mode').its('request.body').should('deep.equal', { mode: 'driver' });
    });

    it('asks a passenger without a car to register one in Publicar', () => {
      logIn(['passenger']);

      goTo('Publicar');

      cy.contains('app-publish-trip', 'Antes de tu primer viaje').should('be.visible');
    });

    it('opens Avisos with the bell', () => {
      logIn(['passenger']);

      cy.get('app-tabs .bell-button').filter(':visible').click();

      cy.location('pathname').should('eq', '/tabs/notifications');
      cy.contains('app-notifications', 'No tienes avisos').should('be.visible');
    });

    it('shows Mensajes, coming soon', () => {
      logIn(['passenger']);

      goTo('Mensajes');

      cy.contains('app-messages', 'Muy pronto podrás escribir aquí').should('be.visible');
    });

    it('logs out from Perfil after confirming it', () => {
      cy.intercept('POST', '/api/auth/logout', { statusCode: 204 }).as('logout');
      logIn(['passenger']);

      goTo('Perfil');
      cy.contains('app-profile ion-button', 'Cerrar sesión').click();
      cy.contains('ion-alert button', 'Cerrar sesión').click();

      cy.wait('@logout');
      cy.location('pathname').should('eq', '/auth/welcome');
    });

    if (isDesktop) {
      it('has the top menu and, below, the greeting', () => {
        logIn(['passenger']);

        cy.get('app-tabs .top-nav app-brand-logo').should('be.visible');
        cy.contains('app-tabs .top-nav__link', 'Buscar').should(
          'have.attr',
          'aria-current',
          'page',
        );
        cy.contains('app-trip-search h1', '¡Hola, Mario!').should('be.visible');
        cy.get('app-tabs ion-tab-bar').should('not.be.visible');
      });
    } else {
      it('has the header with the logo and the bell, and the tabs at the bottom', () => {
        logIn(['passenger']);

        cy.get('app-tabs .app-header app-brand-logo').should('be.visible');
        cy.contains('app-trip-search h1', '¡Hola, Mario!').should('be.visible');
        cy.get('app-tabs .app-header .bell-button').should('be.visible');
        cy.get('app-tabs .app-header .back-button').should('not.exist');
        cy.contains('ion-tab-button', 'Buscar').should('have.class', 'tab-selected');
      });
    }

    it('sends a guest opening the app to the welcome screen', () => {
      cy.visit('/');

      cy.location('pathname').should('eq', '/auth/welcome');
    });
  });
}
