import { choosePlace, VIEWPORTS } from '../support/e2e';

const EMAIL = 'lucia.cortes@ual.es';
const VEHICLE = {
  '@type': 'Vehicle',
  id: 'v1',
  href: '/api/vehicles/v1',
  plate: '1234BCD',
  model: 'Seat Ibiza',
  capacity: 3,
  status: 'available',
};

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

// Conductora nueva: sin vehículos ni declaración
function stubNewDriver(): void {
  cy.intercept('GET', '/api/users/me/driver-status', {
    hasLicenseDeclared: false,
    licenseDeclaredAt: null,
    activeVehicles: 0,
    isReady: false,
  });
  cy.intercept('GET', '/api/vehicles', []);
  cy.intercept('POST', '/api/vehicles', { statusCode: 201, body: VEHICLE }).as('registerVehicle');
  cy.intercept('PUT', '/api/users/me/driver-declaration', { hasLicenseDeclared: true }).as(
    'declare',
  );
  cy.intercept('POST', '/api/trips', (req) => {
    req.reply({ statusCode: 201, body: { id: 't1', ...req.body } });
  }).as('publish');
}

for (const viewport of VIEWPORTS) {
  const isDesktop = viewport.width >= 768;

  describe(`Publish trip (${viewport.name})`, () => {
    beforeEach(() => {
      cy.viewport(viewport.width, viewport.height);
      stubNewDriver();
      cy.intercept('POST', '/api/auth/login', accessToken());
      cy.visit('/auth/login');
      cy.get('app-login ion-input[formControlName="email"] input').type(EMAIL);
      cy.get('app-login ion-input[formControlName="password"] input').type('secreta123');
      cy.contains('ion-button', 'Iniciar sesión').click();
      cy.location('pathname').should('be.oneOf', ['/tabs/search', '/tabs/publish']);
      cy.contains(isDesktop ? 'app-tabs .top-nav__link' : 'ion-tab-button', 'Publicar').click();
      cy.location('pathname').should('eq', '/tabs/publish');
    });

    it('registers the first vehicle, accepts the declaration and publishes', () => {
      cy.contains('app-publish-trip', 'Antes de tu primer viaje');
      cy.get('app-publish-trip ion-input[formControlName="model"] input').type('Seat Ibiza');
      cy.get('app-publish-trip ion-input[formControlName="plate"] input').type('1234 bcd');
      // 5 asientos por defecto; uno menos: 4 = 1 conductor + 3 pasajeros
      cy.get('app-publish-trip app-seat-stepper button[aria-label="Una plaza menos"]').click();
      cy.contains('app-publish-trip', '4 asientos = 1 conductor + hasta 3 pasajeros');
      cy.contains('app-publish-trip ion-button', 'Guardar vehículo y continuar').click();
      cy.wait('@registerVehicle').its('request.body').should('deep.equal', {
        model: 'Seat Ibiza',
        plate: '1234BCD',
        capacity: 3,
      });
      cy.contains('app-publish-trip .publish__vehicle-box', 'Seat Ibiza · 1234BCD');

      choosePlace('app-publish-trip', 'Roquetas de Mar');
      // Sin la declaración, el botón espera y se dice qué falta
      cy.contains('app-publish-trip ion-button', 'Publicar viaje').should('have.attr', 'disabled');
      cy.contains('app-publish-trip', 'Acepta la declaración para publicar tu primer viaje.');
      cy.get('app-publish-trip ion-checkbox').click();
      cy.contains('app-publish-trip ion-button', 'Publicar viaje').click();

      cy.wait('@declare');
      cy.wait('@publish')
        .its('request.body')
        .should('include', { vehicleId: 'v1', offeredSeats: 1 });
      cy.contains('app-publish-trip h2', 'Viaje publicado');
      cy.get('app-publish-trip .route-timeline__stop').first().should('contain', 'Roquetas de Mar');
    });
  });
}
