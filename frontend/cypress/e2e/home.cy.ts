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

// Se entra como en la app, por el login, con esos perfiles
function logIn(profiles: string[]): void {
  cy.intercept('POST', '/api/auth/login', accessToken(profiles));
  cy.visit('/auth/login');
  cy.get('app-login ion-input[formControlName="email"] input').type(EMAIL);
  cy.get('app-login ion-input[formControlName="password"] input').type('secreta123');
  cy.contains('ion-button', 'Iniciar sesión').click();
  cy.location('pathname').should('eq', '/tabs/home');
}

for (const viewport of VIEWPORTS) {
  describe(`Home (${viewport.name})`, () => {
    beforeEach(() => {
      cy.viewport(viewport.width, viewport.height);
      logIn(['passenger']);
    });

    it('greets the passenger and offers the trip search', () => {
      // El saludo: en escritorio, en la franja fija; en el móvil, en Inicio
      cy.get('app-tabs .greeting-bar p, app-home .home__greeting p')
        .filter(':visible')
        .should('contain', '¿Vamos al campus hoy?');
      cy.contains('app-home ion-card-title', 'Tu camino al campus.').should('be.visible');
      cy.get('app-home .home__search img').should('not.exist');
      cy.contains(
        'app-home',
        /Verás viajes que llegan al campus entre las \d{2}:\d{2} y las \d{2}:\d{2}\./,
      ).should('exist');
    });

    it('searches from the origin to the campus with the chosen data', () => {
      cy.get('app-trip-search-form ion-input[formControlName="place"] input').type(
        'Roquetas de Mar',
      );
      cy.get('app-trip-search-form ion-input[formControlName="seats"] input').clear();
      cy.get('app-trip-search-form ion-input[formControlName="seats"] input').type('2');
      cy.contains('app-trip-search-form ion-button', 'Buscar viaje').click();

      cy.location('pathname').should('eq', '/tabs/search');
      cy.location('search').should('contain', 'place=Roquetas%20de%20Mar');
      cy.location('search').should('contain', 'entrance=north');
      cy.location('search').should('contain', 'direction=to-campus');
      cy.location('search').should('contain', 'seats=2');
    });

    it('swaps the direction: from the campus entrance to the place', () => {
      cy.get('app-trip-search-form ion-input[formControlName="place"] input').type(
        'Roquetas de Mar',
      );

      cy.get('app-trip-search-form .search-form__swap').click();

      cy.get('app-trip-search-form .search-form__route > :first-child').should(
        'match',
        'ion-select',
      );
      cy.contains('app-trip-search-form ion-button', 'Buscar viaje').click();

      cy.location('search').should('contain', 'place=Roquetas%20de%20Mar');
      cy.location('search').should('contain', 'direction=from-campus');
    });

    it('asks for the place before searching', () => {
      cy.contains('app-trip-search-form ion-button', 'Buscar viaje').click();

      cy.location('pathname').should('eq', '/tabs/home');
      cy.contains('app-trip-search-form', 'Escribe desde dónde sales.').should('be.visible');
    });

    it('shows the impact marked as example data and how it works', () => {
      cy.contains('app-home ion-card', 'Tu impacto').should('contain', 'Datos de ejemplo');
      cy.contains('app-home ion-card', '¿Cómo funciona?').find('ion-item').should('have.length', 3);
    });
  });
}
