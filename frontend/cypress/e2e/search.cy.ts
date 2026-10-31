import { chooseParking, choosePlace, VIEWPORTS } from '../support/e2e';

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
    driver: { id: 'd1', name: 'Lucía Cortés', avatarKey: 'sun' },
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
  cy.location('pathname').should('be.oneOf', ['/tabs/search', '/tabs/publish']);
}

// Busca desde Buscar (adonde lleva el login de un pasajero)
function searchTrips(place: string): void {
  choosePlace('app-trip-search app-trip-search-form', place);
  chooseParking('app-trip-search app-trip-search-form', 'Parking P1');
  cy.contains('app-trip-search app-trip-search-form ion-button', 'Buscar viaje').click();
  cy.location('pathname').should('eq', '/tabs/search/results');
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
      cy.intercept('GET', '/api/avatars', [
        {
          '@type': 'Avatar',
          id: 'sun',
          href: '/api/avatars/sun',
          name: 'Sol',
          svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="20" /></svg>',
        },
      ]);
      // Aún sin solicitudes de plaza
      cy.intercept('GET', '/api/users/me/requests*', []);
      logIn(['passenger']);
    });

    it('shows the compatible trips', () => {
      searchTrips('Roquetas de Mar');

      // El resumen de la búsqueda, con el trayecto
      cy.contains('app-search-results app-route-timeline', 'Roquetas de Mar');
      cy.wait('@search').its('request.body').should('include', { parkingId: 'p1', seats: 1 });
      cy.contains('app-search-results', '1 en tu margen').should('be.visible');
      cy.contains('app-search-results app-trip-result-card', 'Lucía Cortés').should('be.visible');
      cy.contains('app-search-results app-trip-result-card', '07:20 → 07:52').should('be.visible');
      cy.contains('app-search-results app-trip-result-card', 'Nuevo conductor').should(
        'be.visible',
      );
      cy.contains(
        'app-search-results app-trip-result-card',
        'Desvío de 3 min para recogerte',
      ).should('be.visible');
    });

    it('requests a seat from the trip and shows it pending', () => {
      cy.intercept('POST', '/api/trips/t1/requests', {
        statusCode: 201,
        body: {
          '@type': 'SeatRequest',
          id: 'r1',
          trip: { id: 't1' },
          status: 'pending',
          seats: 1,
          requestedAt: new Date().toISOString(),
          vehiclePlate: null,
        },
      }).as('request');
      searchTrips('Roquetas de Mar');
      cy.get('app-search-results app-trip-result-card .trip-card__link').click();

      cy.contains('app-trip-detail ion-button', 'Solicitar 1 plaza').click();

      cy.wait('@request').its('request.body').should('deep.equal', { seats: 1 });
      cy.contains('app-trip-detail', 'Solicitud enviada. Falta la respuesta de Lucía.').should(
        'be.visible',
      );
      cy.contains('app-trip-detail ion-button', 'Cancelar solicitud').should('be.visible');
    });

    it('opens a trip and comes back to the same search', () => {
      searchTrips('Roquetas de Mar');

      cy.get('app-search-results app-trip-result-card .trip-card__link').click();

      cy.location('pathname').should('eq', '/tabs/search/trips/t1');
      // El mismo viaje de la búsqueda, con quien conduce y cómo se pide plaza
      cy.get('app-trip-detail .route-timeline__stop').first().should('contain', 'Roquetas de Mar');
      cy.get('app-trip-detail .route-timeline__stop').last().should('contain', 'Parking P1');
      cy.contains('app-trip-detail app-trip-driver', 'Lucía Cortés').should('be.visible');
      cy.contains('app-trip-detail .notice', 'Primero solicitas; Lucía decide.').should(
        'be.visible',
      );
      if (isDesktop) {
        // Por los breadcrumbs: Buscar viaje › Tu búsqueda › Detalle
        cy.get('app-tabs .greeting-bar ion-breadcrumb').should('have.length', 3);
        cy.contains('app-tabs .greeting-bar ion-breadcrumb', 'Tu búsqueda').click();
      } else {
        cy.contains('app-tabs .app-header ion-title', 'Detalle del viaje').should('be.visible');
        cy.get('app-tabs .app-header .back-button').click();
      }

      cy.location('pathname').should('eq', '/tabs/search/results');
      cy.contains('app-search-results app-trip-result-card', 'Lucía Cortés').should('be.visible');
    });

    it('edits the search in a window and shows the new results', () => {
      searchTrips('Roquetas de Mar');

      cy.get('app-search-results .search-results__edit-icon').filter(':visible').click();
      choosePlace('ion-modal', 'Huércal de Almería');
      cy.contains('ion-modal app-trip-search-form ion-button', 'Buscar viaje').click();

      cy.get('ion-modal app-trip-search-form').should('not.exist');
      cy.location('pathname').should('eq', '/tabs/search/results');
      cy.contains('app-search-results app-route-timeline', 'Huércal de Almería');
    });

    it('says when there are no trips', () => {
      cy.intercept('POST', '/api/trips/search', []).as('empty');
      searchTrips('Roquetas de Mar');

      cy.wait('@empty').its('request.body').should('include', { marginMin: 20 });
      cy.contains('app-search-results', 'Aún no hay viajes para esa hora').should('be.visible');
      // ±20 min ya es el margen mayor: no se ofrece ampliarlo
      cy.contains('app-search-results ion-button', 'Ampliar margen').should('not.exist');
    });

    it('keeps the search in Buscar and starts a new one with the form empty', () => {
      searchTrips('Roquetas de Mar');

      // De vuelta a Buscar (la pestaña recordaría Tu búsqueda): la flecha en
      // el móvil, las migas en escritorio
      if (isDesktop) {
        cy.contains('app-tabs .greeting-bar ion-breadcrumb', 'Buscar viaje').click();
      } else {
        cy.get('app-tabs .app-header .back-button').click();
      }
      cy.location('pathname').should('eq', '/tabs/search');
      cy.get('app-trip-search app-place-field input').should('have.value', 'Roquetas de Mar');

      cy.contains('app-trip-search .search-form__new', 'Nueva búsqueda').click();

      cy.get('app-trip-search app-place-field input').should('have.value', '');
      cy.contains('app-trip-search .search-form__new', 'Nueva búsqueda').should('not.exist');
    });

    it('shows the search card with the questions', () => {
      goTo('Buscar');

      // El saludo con el nombre va en la cabecera del layout (BrandGreeting)
      cy.contains('app-tabs app-brand-greeting, app-tabs .top-nav__hello', '¡Hola, Mario!').should(
        'exist',
      );
      cy.get('app-trip-search app-trip-search-form').should('be.visible');
      cy.contains('app-trip-search', 'Preguntas frecuentes').should('be.visible');
    });
  });
}
