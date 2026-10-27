import { choosePlace, stubLocation, UNCOVERED_PLACE, VIEWPORTS } from '../support/e2e';

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
      choosePlace('app-trip-search-form', 'Roquetas de Mar');
      cy.get('app-trip-search-form ion-input[formControlName="seats"] input').clear();
      cy.get('app-trip-search-form ion-input[formControlName="seats"] input').type('2');
      cy.contains('app-trip-search-form ion-button', 'Buscar viaje').click();

      cy.location('pathname').should('eq', '/tabs/search');
      // La búsqueda no va en la URL: la muestra Buscar
      cy.location('search').should('eq', '');
      cy.get('app-trip-search .route-timeline__stop').first().should('contain', 'Roquetas de Mar');
      cy.get('app-trip-search .route-timeline__stop').last().should('contain', 'Parking P1');
      cy.contains('app-trip-search .search-summary__details', '2 plazas').should('exist');
    });

    it('does not search from an address out of the area, and says so', () => {
      choosePlace('app-trip-search-form', `${UNCOVERED_PLACE} centro`);

      cy.contains(
        'app-trip-search-form .place-field__message',
        `Aún no llegamos a ${UNCOVERED_PLACE}.`,
      ).should('be.visible');
      cy.contains('app-trip-search-form ion-button', 'Buscar viaje').click();
      cy.location('pathname').should('eq', '/tabs/home');
      // Un aviso basta: el de cobertura, sin el error en rojo
      cy.get('app-trip-search-form app-place-field ion-input').should(
        'not.have.class',
        'ion-invalid',
      );
    });

    it('asks for the permission the first time, then fills the address in', () => {
      // Aún sin permiso: primero explica para qué se usa
      stubLocation('prompt');

      cy.get('app-trip-search-form .place-field__locate').click();
      cy.contains('app-location-modal', 'Solo la usamos para esta búsqueda').should('be.visible');
      cy.contains('app-location-modal ion-button', 'Buscar mi ubicación').click();

      cy.get('app-location-modal').should('not.exist');
      cy.get('app-trip-search-form app-place-field input').should(
        'have.value',
        'Calle Lachambre, 4',
      );
    });

    it('fills the address in straight away with the permission, and adjusts it on a map', () => {
      stubLocation('granted');

      cy.get('app-trip-search-form .place-field__locate').click();

      cy.get('app-location-modal').should('not.exist');
      cy.get('app-trip-search-form app-place-field input').should(
        'have.value',
        'Calle Lachambre, 4',
      );

      cy.contains('app-trip-search-form .place-field__adjust', 'Ajustar en el mapa').click();
      cy.get('app-location-modal .location__map .map-pin').should('exist');
      cy.contains('app-location-modal ion-button', 'Usar esta dirección').click();
      cy.get('app-location-modal').should('not.exist');
    });

    it('shows the campus parking on the map', () => {
      cy.contains('app-trip-search-form .search-form__map-link', 'Ver en el mapa').click();

      cy.contains('app-location-modal ion-title', 'Campus UAL · Parking P1').should('be.visible');
      cy.get('app-location-modal .location__map .map-pin').should('exist');
      cy.contains('app-location-modal ion-button', 'Usar esta dirección').should('not.exist');
    });

    it('offers the location only on the origin', () => {
      cy.get('app-trip-search-form')
        .find('.search-form__swap, .search-form__swap-link')
        .filter(':visible')
        .click();

      cy.get('app-trip-search-form .place-field__locate').should('not.exist');
    });

    it('swaps the direction: from the campus parking to the place', () => {
      choosePlace('app-trip-search-form', 'Roquetas de Mar');

      cy.get('app-trip-search-form')
        .find('.search-form__swap, .search-form__swap-link')
        .filter(':visible')
        .click();

      cy.get('app-trip-search-form .search-form__route > :first-child').should(
        'match',
        '.search-form__parking',
      );
      cy.contains('app-trip-search-form ion-button', 'Buscar viaje').click();

      cy.get('app-trip-search .route-timeline__stop').first().should('contain', 'Campus UAL');
      cy.get('app-trip-search .route-timeline__stop').last().should('contain', 'Roquetas de Mar');
    });

    it('asks for the place before searching', () => {
      cy.contains('app-trip-search-form ion-button', 'Buscar viaje').click();

      cy.location('pathname').should('eq', '/tabs/home');
      cy.contains('app-trip-search-form', 'Elige una dirección de la lista.').should('be.visible');
    });

    it('shows the impact marked as example data and how it works', () => {
      cy.contains('app-home ion-card', 'Tu impacto').should('contain', 'Datos de ejemplo');
      cy.contains('app-home ion-card', '¿Cómo funciona?').find('ion-item').should('have.length', 3);
    });
  });
}
