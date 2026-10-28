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
  cy.location('pathname').should('eq', '/tabs/home');
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
    });

    it('shows the five destinations, with Buscar as a passenger', () => {
      logIn(['passenger']);

      destinationLabels().should('deep.equal', [
        'Inicio',
        'Mis viajes',
        'Buscar',
        'Avisos',
        'Perfil',
      ]);
    });

    if (isDesktop) {
      it('has the top menu and, below, the greeting', () => {
        logIn(['passenger']);

        cy.get('app-tabs .top-nav app-brand-logo').should('be.visible');
        cy.contains('app-tabs .top-nav__link', 'Inicio').should(
          'have.attr',
          'aria-current',
          'page',
        );
        cy.contains('app-tabs .greeting-bar', '¡Hola, Mario!').should('be.visible');
        cy.get('app-tabs ion-tab-bar').should('not.be.visible');
      });

      it('shows the title of Buscar in the fixed bar instead of the greeting', () => {
        logIn(['passenger']);

        goTo('Buscar');

        cy.contains('app-tabs .greeting-bar', 'Buscar viaje').should('be.visible');
        cy.contains('app-tabs .greeting-bar', 'encajan con tu ruta').should('be.visible');
        cy.contains('app-tabs .greeting-bar', '¡Hola, Mario!').should('not.exist');
      });

      it('logs out from the top menu', () => {
        cy.intercept('POST', '/api/auth/logout', { statusCode: 204 }).as('logout');
        logIn(['passenger']);

        cy.get('app-tabs .top-nav .logout-button').click();

        cy.wait('@logout');
        cy.location('pathname').should('eq', '/auth/welcome');
      });
    } else {
      it('has the header with the logo and the tabs at the bottom', () => {
        logIn(['passenger']);

        cy.get('app-tabs .app-header app-brand-logo').should('be.visible');
        cy.get('app-tabs ion-tab-bar').should('be.visible');
        cy.get('app-tabs .top-nav').should('not.be.visible');
        cy.contains('ion-tab-button', 'Inicio').should('have.class', 'tab-selected');
      });

      it('shows only the way back and the title in the header of Buscar', () => {
        logIn(['passenger']);

        goTo('Buscar');

        cy.contains('app-tabs .app-header ion-title', 'Buscar viaje').should('be.visible');
        cy.get('app-tabs .app-header app-brand-logo').should('not.exist');
        cy.get('app-tabs .app-header .bell-button').should('not.exist');
        cy.get('app-tabs .app-header .back-button').click();

        cy.location('pathname').should('eq', '/tabs/home');
        cy.get('app-tabs .app-header app-brand-logo').should('be.visible');
      });

      it('logs out from the header', () => {
        cy.intercept('POST', '/api/auth/logout', { statusCode: 204 }).as('logout');
        logIn(['passenger']);

        cy.get('app-tabs .app-header .logout-button').click();

        cy.wait('@logout');
        cy.location('pathname').should('eq', '/auth/welcome');
      });

      it('logs out from Perfil', () => {
        cy.intercept('POST', '/api/auth/logout', { statusCode: 204 }).as('logout');
        logIn(['passenger']);

        goTo('Perfil');
        cy.contains('app-profile', EMAIL).should('be.visible');
        cy.contains('app-profile ion-button', 'Cerrar sesión').click();
        // Pide confirmación
        cy.contains('ion-alert button', 'Cerrar sesión').click();

        cy.wait('@logout');
        cy.location('pathname').should('eq', '/auth/welcome');
      });
    }

    it('shows Publicar instead of Buscar as a driver, without a mode to change', () => {
      logIn(['driver']);

      destinationLabels().should('contain', 'Publicar').and('not.contain', 'Buscar');
      cy.get('app-mode-selector ion-segment').should('not.exist');
    });

    it('starts as a passenger with both profiles and can change to driver from Inicio', () => {
      logIn(['passenger', 'driver']);
      destinationLabels().should('contain', 'Buscar');
      cy.get('app-home app-trip-search-form').should('exist');

      cy.intercept('PUT', '/api/users/me/active-mode', { activeMode: 'driver' }).as('mode');

      cy.contains('app-mode-selector ion-segment-button', 'Conductor').click();

      cy.wait('@mode').its('request.body').should('deep.equal', { mode: 'driver' });
      destinationLabels().should('contain', 'Publicar').and('not.contain', 'Buscar');
      cy.contains('app-home ion-button', 'Ofrecer plaza').should('be.visible');
    });

    it('starts with the mode kept on the server', () => {
      logIn(['passenger', 'driver'], 'driver');

      destinationLabels().should('contain', 'Publicar').and('not.contain', 'Buscar');
      cy.contains('app-home ion-button', 'Ofrecer plaza').should('be.visible');
    });

    it('goes from one destination to another', () => {
      logIn(['passenger']);
      cy.intercept('GET', '/api/users/me/requests*', []);

      goTo('Mis viajes');

      cy.location('pathname').should('eq', '/tabs/trips');
      // El título lo pone la cabecera; el h1 de la página es para lectores
      cy.get('app-my-trips h1').should('contain', 'Mis viajes');
      cy.contains('app-my-trips', 'Aún no has pedido plaza en ningún viaje').should('be.visible');
    });

    it('opens Avisos with the bell', () => {
      cy.intercept('GET', '/api/users/me/notifications*', []);
      logIn(['passenger']);

      cy.get('app-tabs .bell-button').filter(':visible').click();

      cy.location('pathname').should('eq', '/tabs/notifications');
      cy.get('app-notifications h1').should('contain', 'Avisos');
      cy.contains('app-notifications', 'No tienes avisos').should('be.visible');
    });

    it('sends a guest opening the app to the welcome screen', () => {
      cy.visit('/');

      cy.location('pathname').should('eq', '/auth/welcome');
    });
  });
}
