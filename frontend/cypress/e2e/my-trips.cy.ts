import { VIEWPORTS } from '../support/e2e';

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

// Un viaje publicado mañana, con 3 plazas libres
function trip(availableSeats: number, status: string) {
  const departure = new Date();
  departure.setDate(departure.getDate() + 1);
  departure.setHours(7, 40, 0, 0);
  return {
    '@type': 'Trip',
    id: 't1',
    href: '/api/trips/t1',
    departureAt: departure.toISOString(),
    offeredSeats: 3,
    availableSeats,
    maxDetourMin: 10,
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
    beforeEach(() => {
      cy.viewport(viewport.width, viewport.height);
      cy.intercept('GET', '/api/users/me/trips*', [trip(3, 'published')]).as('trips');
      cy.intercept('GET', '/api/trips/t1/requests', [seatRequest('pending')]).as('requests');
      cy.intercept('POST', '/api/auth/login', accessToken());
      cy.visit('/auth/login');
      cy.get('app-login ion-input[formControlName="email"] input').type(EMAIL);
      cy.get('app-login ion-input[formControlName="password"] input').type('secreta123');
      cy.contains('ion-button', 'Iniciar sesión').click();
      cy.location('pathname').should('be.oneOf', ['/tabs/search', '/tabs/publish']);
      cy.contains(isDesktop ? 'app-tabs .top-nav__link' : 'ion-tab-button', 'Tus viajes').click();
    });

    it('accepts a pending request of an upcoming trip', () => {
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
  });
}
