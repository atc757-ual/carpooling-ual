import { choosePlace, VIEWPORTS } from '../support/e2e';

const EMAIL = 'mario.perez@ual.es';

// Un viaje compatible (matching): sale 32 min antes y llega a las 07:52
// de mañana, con 3 min de desvío
function tripMatch() {
  const arrival = new Date();
  arrival.setDate(arrival.getDate() + 1);
  arrival.setHours(7, 52, 0, 0);
  return {
    '@type': 'TripMatch',
    id: 't1',
    href: '/api/trips/t1',
    driver: { id: 'd1', name: 'Lucía Cortés' },
    departureAt: new Date(arrival.getTime() - 32 * 60_000).toISOString(),
    arrivalAt: arrival.toISOString(),
    availableSeats: 2,
    detourMin: 3,
    timeDifferenceMin: -8,
    score: 0.86,
  };
}

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

// Busca desde Inicio: lleva a Buscar, que muestra la misma búsqueda
function searchFromHome(place: string): void {
  choosePlace('app-home app-trip-search-form', place);
  cy.contains('app-home app-trip-search-form ion-button', 'Buscar viaje').click();
  cy.location('pathname').should('eq', '/tabs/search');
}

for (const viewport of VIEWPORTS) {
  const isDesktop = viewport.width >= 768;

  // A otra pestaña: con el menú de arriba en escritorio y la barra en el móvil
  const goTo = (label: string): void => {
    cy.contains(isDesktop ? 'app-tabs .top-nav__link' : 'ion-tab-button', label).click();
  };

  describe(`Search (${viewport.name})`, () => {
    beforeEach(() => {
      cy.viewport(viewport.width, viewport.height);
      cy.intercept('POST', '/api/trips/search', [tripMatch()]).as('search');
      logIn(['passenger']);
    });

    it('shows the search from Inicio with the compatible trips', () => {
      searchFromHome('Roquetas de Mar');

      cy.get('app-trip-search .route-timeline__stop').first().should('contain', 'Roquetas de Mar');
      cy.get('app-trip-search .route-timeline__stop').last().should('contain', 'Parking P1');
      cy.contains('app-trip-search .search-summary__details', 'plaza').should('be.visible');
      cy.contains('app-trip-search .search-summary__details', 'Margen de llegada').should(
        'be.visible',
      );
      cy.wait('@search').its('request.body').should('include', { parkingId: 'p1', seats: 1 });
      cy.contains('app-trip-search', '1 en tu margen').should('be.visible');
      cy.contains('app-trip-search app-trip-result-card', 'Lucía Cortés').should('be.visible');
      cy.contains('app-trip-search app-trip-result-card', '07:20 → 07:52').should('be.visible');
    });

    it('opens a trip and comes back to the same search', () => {
      searchFromHome('Roquetas de Mar');

      cy.contains('app-trip-search app-trip-result-card ion-button', 'Ver viaje de Lucía').click();

      cy.location('pathname').should('eq', '/tabs/search/trips/t1');
      // El mismo viaje de la búsqueda, con quien conduce y cómo se pide plaza
      cy.get('app-trip-detail .route-timeline__stop').first().should('contain', 'Roquetas de Mar');
      cy.get('app-trip-detail .route-timeline__stop').last().should('contain', 'Parking P1');
      cy.contains('app-trip-detail app-trip-driver', 'Lucía Cortés').should('be.visible');
      cy.contains('app-trip-detail .notice', 'Primero solicitas; Lucía decide.').should(
        'be.visible',
      );
      if (isDesktop) {
        // Por los breadcrumbs de la franja: Inicio (la casa) › Buscar viaje › Detalle
        cy.get('app-tabs .greeting-bar ion-breadcrumb').should('have.length', 3);
        cy.contains('app-tabs .greeting-bar ion-breadcrumb', 'Buscar viaje').click();
      } else {
        cy.contains('app-tabs .app-header ion-title', 'Detalle del viaje').should('be.visible');
        cy.get('app-tabs .app-header .back-button').click();
      }

      cy.location('pathname').should('eq', '/tabs/search');
      cy.contains('app-trip-search .route-timeline__stop', 'Roquetas de Mar').should('be.visible');
    });

    it('edits the search with the form filled in and shows the new one', () => {
      searchFromHome('Roquetas de Mar');

      cy.contains('app-trip-search app-trip-search-summary ion-button', 'Editar').click();
      cy.get('app-trip-search app-place-field input').should('have.value', 'Roquetas de Mar');
      choosePlace('app-trip-search', 'Huércal de Almería');
      cy.contains('app-trip-search app-trip-search-form ion-button', 'Buscar viaje').click();

      cy.get('app-trip-search app-trip-search-form').should('not.exist');
      cy.contains('app-trip-search .route-timeline__stop', 'Huércal de Almería').should(
        'be.visible',
      );
    });

    it('says when there are no trips and offers to widen the margin', () => {
      cy.intercept('POST', '/api/trips/search', []).as('empty');
      searchFromHome('Roquetas de Mar');

      cy.contains('app-trip-search', 'Aún no hay viajes para esa hora').should('be.visible');
      cy.contains('app-trip-search ion-button', 'Ampliar margen a ±30 min').click();
      cy.wait('@empty');
      cy.wait('@empty').its('request.body').should('include', { marginMin: 30 });
    });

    it('closes the form without changing the search', () => {
      searchFromHome('Roquetas de Mar');

      cy.contains('app-trip-search app-trip-search-summary ion-button', 'Editar').click();
      cy.contains('app-trip-search ion-button', 'Cancelar').click();

      cy.get('app-trip-search app-trip-search-form').should('not.exist');
      cy.contains('app-trip-search .route-timeline__stop', 'Roquetas de Mar').should('be.visible');
    });

    it('keeps the search when going to another tab and coming back', () => {
      searchFromHome('Roquetas de Mar');

      goTo('Perfil');
      goTo('Buscar');

      cy.contains('app-trip-search .route-timeline__stop', 'Roquetas de Mar').should('be.visible');
    });

    it('fills Inicio in with the search made in Buscar', () => {
      searchFromHome('Roquetas de Mar');
      cy.contains('app-trip-search app-trip-search-summary ion-button', 'Editar').click();
      choosePlace('app-trip-search', 'Vícar');
      cy.contains('app-trip-search app-trip-search-form ion-button', 'Buscar viaje').click();

      goTo('Inicio');

      cy.get('app-home app-place-field input').should('have.value', 'Vícar');
    });

    it('starts a new search with the forms empty', () => {
      searchFromHome('Roquetas de Mar');

      cy.contains('app-trip-search app-trip-search-summary ion-button', 'Editar').click();
      cy.contains('app-trip-search ion-button', 'Nueva búsqueda').click();

      cy.get('app-trip-search app-trip-search-summary').should('not.exist');
      cy.get('app-trip-search app-place-field input').should('have.value', '');
      goTo('Inicio');
      cy.get('app-home app-place-field input').should('have.value', '');
    });

    it('shows the form when opened without a search', () => {
      goTo('Buscar');

      cy.get('app-trip-search app-trip-search-form').should('be.visible');
      cy.get('app-trip-search app-trip-search-summary').should('not.exist');
      if (isDesktop) {
        cy.contains('app-trip-search', 'Aquí verás los resultados de tu búsqueda').should(
          'be.visible',
        );
      }
    });
  });
}
