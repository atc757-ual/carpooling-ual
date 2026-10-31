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

// Un viaje publicado mañana a las 07:40
function trip() {
  const departure = new Date();
  departure.setDate(departure.getDate() + 1);
  departure.setHours(7, 40, 0, 0);
  return {
    '@type': 'Trip',
    id: 't1',
    href: '/api/trips/t1',
    departureAt: departure.toISOString(),
    offeredSeats: 3,
    availableSeats: 3,
    maxDetourMin: 10,
    status: 'published',
    originName: 'Roquetas de Mar',
    destinationName: 'Campus UAL · Parking P1 (Sur)',
    driver: { id: 'user-1', name: 'Lucía Cortés' },
  };
}

// Un pasajero ha pedido plaza hace 5 minutos y aún no se ha leído
const NOTIFICATION = {
  '@type': 'Notification',
  id: 'n1',
  type: 'request_received',
  trip: { id: 't1', href: '/api/trips/t1' },
  request: { id: 'r1', href: '/api/requests/r1' },
  incident: null,
  isRead: false,
  readAt: null,
  createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
};

for (const viewport of VIEWPORTS) {
  describe(`Notifications (${viewport.name})`, () => {
    beforeEach(() => {
      cy.viewport(viewport.width, viewport.height);
      cy.intercept('GET', '/api/users/me/notifications*', [NOTIFICATION]);
      // El recuento de sin leer (se pide con isRead=false)
      cy.intercept(
        { method: 'GET', pathname: '/api/users/me/notifications', query: { isRead: 'false' } },
        { headers: { 'X-Total-Count': '1' }, body: [NOTIFICATION] },
      );
      cy.intercept('GET', '/api/trips/t1', trip());
      cy.intercept('GET', '/api/users/me/trips*', []);
      cy.intercept('POST', '/api/auth/login', accessToken());
      cy.visit('/auth/login');
      cy.get('app-login ion-input[formControlName="email"] input').type(EMAIL);
      cy.get('app-login ion-input[formControlName="password"] input').type('secreta123');
      cy.contains('ion-button', 'Iniciar sesión').click();
      cy.location('pathname').should('be.oneOf', ['/tabs/search', '/tabs/publish']);
    });

    // El total va en el nombre accesible; a la vista, solo un punto
    it('counts the unread ones on the bell', () => {
      cy.get('app-tabs .bell-button')
        .filter(':visible')
        .should('have.attr', 'aria-label', 'Avisos, 1 sin leer')
        .find('.bell-button__unread-dot')
        .should('exist');
    });

    it('opens one: marks it as read and goes to my trips', () => {
      cy.intercept('POST', '/api/notifications/n1/read', { ...NOTIFICATION, isRead: true }).as(
        'read',
      );
      cy.get('app-tabs .bell-button').filter(':visible').click();

      cy.contains('app-notifications .notification--unread', 'Te han pedido plaza').should(
        'be.visible',
      );
      cy.contains('app-notifications', 'Mañana · 07:40 · Roquetas de Mar → Campus UAL');
      cy.contains('app-notifications', 'hace 5 min');

      cy.contains('app-notifications .notification', 'Te han pedido plaza').click();

      cy.wait('@read');
      cy.location('pathname').should('eq', '/tabs/trips');
    });

    it('marks all as read', () => {
      cy.intercept('POST', '/api/users/me/notifications/read', { statusCode: 204 }).as('readAll');
      cy.get('app-tabs .bell-button').filter(':visible').click();

      cy.contains('app-notifications ion-button', 'Marcar todo como leído').click();

      cy.wait('@readAll').its('response.statusCode').should('eq', 204);
    });
  });
}
