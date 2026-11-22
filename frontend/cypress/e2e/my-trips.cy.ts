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
      firstName: 'Lucía',
      lastName: 'Cortés',
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
    pickupMode: 'on_route',
    maxDetourM: 500,
    stops: [],
    origin: { type: 'Point', coordinates: [-2.6, 36.76] },
    destination: { type: 'Point', coordinates: [-2.4045, 36.8322] },
    status,
    originName: 'Roquetas de Mar',
    destinationName: 'Campus UAL · Parking P1 (Sur)',
  };
}

// Las pestañas de Tus viajes y los estados del viaje que van en cada una
const TAB_STATUSES: Record<string, string[]> = {
  upcoming: ['published', 'confirmed', 'in_progress'],
  past: ['finished'],
  cancelled: ['cancelled', 'expired'],
};

// Los viajes de la conductora: cada uno por su id (detalle y «En curso», con
// ella de conductora) y Tus viajes, que pide cada pestaña ya filtrada y con el total
function stubTrips(trips: ReturnType<typeof trip>[]): void {
  cy.intercept('GET', /\/api\/trips\/[^/?]+$/, (req) => {
    const id = new URL(req.url).pathname.split('/').at(-1);
    const found = trips.find((candidate) => candidate.id === id);
    req.reply(
      found
        ? { body: { ...found, driver: { id: 'user-1', name: 'Lucía Cortés', avatarKey: null } } }
        : { statusCode: 404, body: { '@type': 'Error', code: 'TRIP_NOT_FOUND', status: '404' } },
    );
  });
  cy.intercept('GET', '/api/users/me/trip-entries*', (req) => {
    const statuses = TAB_STATUSES[String(req.query['tab'] ?? 'upcoming')];
    const entries = trips
      .filter(({ status }) => statuses.includes(status))
      .map((driven) => ({ '@type': 'TripEntry', role: 'driver', trip: driven }));
    req.reply({ headers: { 'X-Total-Count': String(entries.length) }, body: entries });
  });
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
    function openMyTrips(trips: ReturnType<typeof trip>[]): void {
      stubTrips(trips);
      cy.intercept('GET', '/api/users/me/impact', {
        '@type': 'UserImpact',
        tripsDone: 2,
        driverKm: 26.2,
        passengerKm: 0,
        co2Kg: 6.2,
      });
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

    // Abre el detalle del viaje desde su tarjeta resumida
    function openTripDetail(): void {
      cy.get('app-driver-trip-summary ion-item.driver-summary').click();
      cy.location('pathname').should('eq', '/tabs/trips/published/t1');
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
      cy.contains('app-driver-trip-summary', '1 solicitud por responder').should('be.visible');
      openTripDetail();
      cy.contains('app-driver-trip-detail .driver-trip__request', 'Mario Pérez').should(
        'contain',
        '2 plazas',
      );

      cy.intercept('POST', '/api/requests/r1/accept', seatRequest('accepted')).as('accept');
      stubTrips([trip(1, 'confirmed')]);
      cy.intercept('GET', '/api/trips/t1/requests', [seatRequest('accepted')]);
      cy.contains('app-driver-trip-detail ion-button', 'Aceptar').click();

      cy.wait('@accept');
      // El estado va en la franja fija del título, fuera de la página
      cy.contains('.greeting-bar', 'Confirmado');
      cy.contains('app-driver-trip-passengers', '2 de 3 plazas ocupadas');
      cy.contains('app-driver-trip-detail .driver-trip__request', 'Aceptada');
    });

    it('highlights the trip in progress at the top', () => {
      openMyTrips([trip(1, 'in_progress', -10)]);

      cy.contains('app-live-trip-banner', 'Viaje en curso')
        .should('be.visible')
        .and('contain', 'Roquetas de Mar → Campus UAL · Parking P1 (Sur)')
        .and('contain', '2 de 3 plazas ocupadas');
      // El aviso entero (un ion-item con enlace) lleva al viaje en curso
      cy.get('app-live-trip-banner ion-item.live-trip-banner').should(
        'have.attr',
        'href',
        '/tabs/trips/drive/t1',
      );
      // No se repite en Próximos
      cy.get('app-driver-trip-summary').should('not.exist');
      // La columna de 4: a la derecha en escritorio y debajo en el móvil
      cy.get('app-my-trips-aside')
        .should('contain', 'Tu impacto')
        .and('contain', '26,2 km')
        .and('contain', 'Publicar viaje');
    });

    it('confirms and cancels an upcoming trip', () => {
      openMyTrips([trip(3, 'published')]);
      cy.intercept('POST', '/api/trips/t1/cancel', {
        statusCode: 200,
        body: trip(3, 'cancelled'),
      }).as('cancelTrip');
      openTripDetail();

      cy.contains('app-driver-trip-actions ion-button', 'Cancelar viaje').click();
      cy.contains('app-confirm-modal', '¿Cancelar este viaje?').should('be.visible');
      cy.contains('app-confirm-modal ion-button', 'Confirmar cancelación').click();

      cy.wait('@cancelTrip').its('request.method').should('eq', 'POST');
      cy.get('ion-toast')
        .shadow()
        .find('.toast-message')
        .should('contain', 'Viaje cancelado. Hemos avisado a los pasajeros.');
    });

    it('waits until 10 minutes before the departure to start', () => {
      openMyTrips([trip(1, 'confirmed', 60)]);
      openTripDetail();

      cy.contains('app-driver-trip-actions ion-button', 'Iniciar viaje').should(
        'have.attr',
        'disabled',
      );
      cy.contains('app-driver-trip-actions', 'Podrás iniciarlo a las');
    });

    // Con el permiso del dispositivo dado, solo se confirma la declaración
    // (RF-21): compartir la ubicación con el viaje en curso es parte del
    // servicio (RGPD 6.1.b) y no se registra ningún consentimiento
    it('shares the location to start the trip, and finishes it', () => {
      openMyTrips([trip(1, 'confirmed', 5)]);
      cy.intercept('PUT', '/api/users/me/consents/location', cy.spy().as('consent'));
      cy.intercept('POST', '/api/trips/t1/start', trip(1, 'in_progress', 5)).as('start');
      cy.intercept('POST', '/api/trips/t1/positions', { statusCode: 201 }).as('position');
      openTripDetail();
      // El detalle ya cargado con el viaje confirmado; a partir de aquí, en curso
      cy.contains('app-driver-trip-actions ion-button', 'Iniciar viaje').should('be.visible');
      stubTrips([trip(1, 'in_progress', 5)]);

      cy.contains('app-driver-trip-actions ion-button', 'Iniciar viaje').click();
      cy.contains('app-confirm-modal', 'confirmas que sigues cumpliendo').should('be.visible');
      cy.contains('app-confirm-modal ion-button', 'Iniciar viaje').click();

      cy.wait('@start');
      cy.get('@consent').should('not.have.been.called');
      cy.wait('@position')
        .its('request.body.position.coordinates')
        .should('deep.equal', [-2.4637, 36.8381]);
      // Directo a la pantalla del viaje en curso
      cy.location('pathname').should('eq', '/tabs/trips/drive/t1');
      // Los detalles: en escritorio, la columna de 4; en el móvil, la hoja
      const live = isDesktop ? 'app-driver-live-trip' : 'ion-modal.live-sheet';
      cy.contains(live, 'Ubicación en directo');
      cy.contains(live, 'Recogidas');

      cy.intercept('POST', '/api/trips/t1/finish', trip(1, 'finished', 5)).as('finish');
      stubTrips([trip(1, 'finished', 5)]);
      cy.intercept('GET', '/api/users/me/reviews*', []);
      cy.intercept('GET', '/api/users/me/pending-reviews', []);
      // Sin pasajeros que llevar, el aviso «Ya no queda nadie por llevar»
      // ocupa el sitio del botón de terminar (en escritorio y en el móvil)
      cy.contains(live, 'Ya no queda nadie por llevar');
      cy.contains(`${live} ion-button`, 'Terminar viaje').click();
      // Aún en Almería centro, a unos 5 km del campus: avisa en la misma hoja
      cy.contains(live, 'del destino');
      cy.contains(`${live} ion-button`, 'Terminar igualmente').click();

      cy.wait('@finish')
        .its('request.body.position.coordinates')
        .should('deep.equal', [-2.4637, 36.8381]);
      cy.contains(live, '¡Viaje terminado!');
      cy.contains(`${live} ion-button`, 'Volver a Tus viajes').click();
      cy.location('pathname').should('eq', '/tabs/trips');
      // Terminado, pasa a Anteriores
      cy.contains('app-my-trips', 'No tienes viajes programados');
      cy.contains('app-filter-chips ion-chip', 'Anteriores').click();
      cy.contains('app-my-trips', 'Realizado');
    });
  });
}
