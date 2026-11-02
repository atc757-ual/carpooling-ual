import { stubLocation, VIEWPORTS } from '../support/e2e';

const EMAIL = 'lucia.cortes@ual.es';

function accessToken() {
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
      name: 'Lucía Cortés',
      email: EMAIL,
      phone: '+34612345678',
      profiles: ['driver'],
    },
  };
}

// Un viaje mañana a las 7:40 o, con minutesAhead, dentro de esos minutos
function trip(availableSeats: number, status: string, minutesAhead?: number) {
  const departure = new Date();
  if (minutesAhead === undefined) {
    departure.setDate(departure.getDate() + 1);
    departure.setHours(7, 40, 0, 0);
  } else {
    departure.setMinutes(departure.getMinutes() + minutesAhead);
  }
  return {
    '@type': 'Trip',
    id: 't1',
    href: '/api/trips/t1',
    departureAt: departure.toISOString(),
    offeredSeats: 3,
    availableSeats,
    maxDetourMin: 10,
    origin: { type: 'Point', coordinates: [-2.6, 36.76] },
    destination: { type: 'Point', coordinates: [-2.4045, 36.8322] },
    status,
    originName: 'Roquetas de Mar',
    destinationName: 'Campus UAL · Parking P1 (Sur)',
  };
}

function seatRequest(status: string) {
  return {
    '@type': 'SeatRequest',
    id: 'r1',
    trip: { id: 't1' },
    passenger: { id: 'p1', name: 'Mario Pérez' },
    status,
    seats: 2,
    isPriority: false,
    requestedAt: new Date().toISOString(),
    vehiclePlate: null,
  };
}

for (const viewport of VIEWPORTS) {
  const isDesktop = viewport.width >= 768;

  describe(`My trips as a driver (${viewport.name})`, () => {
    // Entra como conductora y abre Tus viajes con estos viajes
    function openMyTrips(trips: object[]): void {
      cy.intercept('GET', '/api/users/me/trips*', trips).as('trips');
      cy.intercept('GET', '/api/trips/t1/requests', [seatRequest('pending')]).as('requests');
      cy.intercept('POST', '/api/auth/login', accessToken());
      cy.visit('/auth/login');
      stubLocation('granted');
      cy.get('app-login ion-input[formControlName="email"] input').type(EMAIL);
      cy.get('app-login ion-input[formControlName="password"] input').type('secreta123');
      cy.contains('ion-button', 'Entrar').click();
      cy.location('pathname').should('be.oneOf', ['/tabs/search', '/tabs/publish']);
      cy.contains(isDesktop ? 'app-tabs .top-nav__link' : 'ion-tab-button', 'Tus viajes').click();
    }

    beforeEach(() => {
      cy.viewport(viewport.width, viewport.height);
    });

    it('accepts a pending request of an upcoming trip', () => {
      openMyTrips([trip(3, 'published')]);
      cy.contains('app-my-trips', 'Roquetas de Mar → Campus UAL · Parking P1 (Sur)').should(
        'be.visible',
      );
      cy.contains('app-my-trips', '3 de 3 libres');
      cy.contains('app-my-trips .driver-trip__request', 'Mario Pérez').should(
        'contain',
        '2 plazas',
      );

      cy.intercept('POST', '/api/requests/r1/accept', seatRequest('accepted')).as('accept');
      cy.intercept('GET', '/api/users/me/trips*', [trip(1, 'confirmed')]);
      cy.intercept('GET', '/api/trips/t1/requests', [seatRequest('accepted')]);
      cy.contains('app-my-trips ion-button', 'Aceptar').click();

      cy.wait('@accept');
      cy.contains('app-my-trips', 'Confirmado');
      cy.contains('app-my-trips', '1 de 3 libres');
      cy.contains('app-my-trips .driver-trip__request', 'Aceptada');
    });

    it('confirms and cancels an upcoming trip', () => {
      openMyTrips([trip(3, 'published')]);
      cy.intercept('POST', '/api/trips/t1/cancel', {
        statusCode: 200,
        body: trip(3, 'cancelled'),
      }).as('cancelTrip');

      cy.contains('app-driver-trip-card ion-button', 'Cancelar viaje').click();
      cy.contains('app-confirm-modal', '¿Cancelar este viaje?').should('be.visible');
      cy.contains('app-confirm-modal ion-button', 'Cancelar viaje').click();

      cy.wait('@cancelTrip').its('request.method').should('eq', 'POST');
      cy.get('ion-toast')
        .shadow()
        .find('.toast-message')
        .should('contain', 'Viaje cancelado. Hemos avisado a los pasajeros.');
    });

    it('waits until 10 minutes before the departure to start', () => {
      openMyTrips([trip(1, 'confirmed', 60)]);

      cy.contains('app-driver-trip-card ion-button', 'Iniciar viaje').should(
        'have.attr',
        'disabled',
      );
      cy.contains('app-driver-trip-card', 'Podrás iniciarlo desde las');
    });

    it('shares the location to start the trip, and finishes it', () => {
      openMyTrips([trip(1, 'confirmed', 5)]);
      cy.intercept('PUT', '/api/users/me/consents/location', {
        current: { terms: null, privacy: null, location: { action: 'granted' } },
        history: [],
      }).as('consent');
      cy.intercept('POST', '/api/trips/t1/start', trip(1, 'in_progress', 5)).as('start');
      cy.intercept('POST', '/api/trips/t1/positions', { statusCode: 201 }).as('position');
      cy.intercept('GET', '/api/users/me/trips*', [trip(1, 'in_progress', 5)]);

      cy.contains('app-driver-trip-card ion-button', 'Iniciar viaje').click();
      cy.contains('app-confirm-modal', '¿Compartes tu ubicación?').should('be.visible');
      cy.contains('app-confirm-modal ion-button', 'Compartir e iniciar').click();

      cy.wait('@consent').its('request.body').should('deep.equal', {
        action: 'granted',
        source: 'location_prompt',
      });
      cy.wait('@start');
      cy.wait('@position')
        .its('request.body.position.coordinates')
        .should('deep.equal', [-2.4637, 36.8381]);
      // Directo a la pantalla del viaje en curso
      cy.location('pathname').should('eq', '/tabs/trips/drive/t1');
      cy.contains('app-driver-live-trip', 'Compartiendo tu ubicación con tus pasajeros');
      cy.contains('app-driver-live-trip', 'En curso');

      cy.intercept('POST', '/api/trips/t1/finish', trip(1, 'finished', 5)).as('finish');
      cy.intercept('GET', '/api/users/me/trips*', [trip(1, 'finished', 5)]);
      cy.contains('app-driver-live-trip ion-button', 'Terminar viaje').click();
      cy.contains('app-confirm-modal ion-button', 'Terminar').click();

      cy.wait('@finish');
      cy.location('pathname').should('eq', '/tabs/trips');
      cy.contains('app-my-trips', 'Finalizado');
    });
  });
}
