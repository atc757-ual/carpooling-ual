const TOKEN = 'q4c1Vt0Jk2m3N4b5V6c7X8z9A0s1D2f3G4h5J6k7L8m';

// Lo que devuelve GET /api/shares/{token} con el viaje confirmado
const SHARED_TRIP = {
  '@type': 'TripShare',
  id: 'share-1',
  href: `/api/shares/${TOKEN}`,
  tripStatus: 'confirmed',
  passengerState: 'waiting',
  pickupName: 'Rambla Obispo Orberá',
  pickupAt: '2026-11-20T07:40:00.000Z',
  destinationName: 'Parking P1',
  estimatedArrivalAt: '2026-11-20T08:00:00.000Z',
  driver: { firstName: 'Lucía' },
  vehicle: { brand: 'Seat', model: 'Ibiza', color: 'red', colorName: 'Rojo', plate: '1234ABC' },
  position: null,
  route: null,
};

// El viaje compartido en directo se abre sin cuenta y sin pasar por el login
describe('Shared trip (public link)', () => {
  it('shows the trip to someone without an account', () => {
    cy.intercept('GET', `/api/shares/${TOKEN}`, SHARED_TRIP).as('shared');

    cy.visit(`/seguir/${TOKEN}`);

    cy.wait('@shared');
    cy.location('pathname').should('eq', `/seguir/${TOKEN}`);
    cy.contains('h1', 'Viaje en directo');
    cy.contains('Esperando la recogida');
    cy.contains('Rambla Obispo Orberá');
    cy.contains('Seat Ibiza · Rojo · 1234 ABC');
    cy.get('meta[name="robots"]').should('have.attr', 'content', 'noindex, nofollow');
  });

  it('explains a link that no longer works', () => {
    cy.intercept('GET', `/api/shares/${TOKEN}`, {
      statusCode: 404,
      body: {
        '@type': 'Error',
        code: 'SHARE_NOT_FOUND',
        reason: 'Not found',
        message: 'The shared trip link is not valid',
        status: '404',
      },
    });

    cy.visit(`/seguir/${TOKEN}`);

    cy.contains('Este enlace no está disponible');
  });
});
