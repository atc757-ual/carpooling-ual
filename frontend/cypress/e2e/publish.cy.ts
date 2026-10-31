import { chooseParking, choosePlace, VIEWPORTS } from '../support/e2e';

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

    it('goes through the steps: route, first vehicle, review with the declaration and published', () => {
      // 1 · Trayecto: «Siguiente» espera a la dirección y al parking (vacío
      // y sin «Ver en el mapa» hasta elegirlo)
      cy.get('app-publish-trip [aria-current="step"]').should('contain', 'Trayecto');
      cy.contains('app-publish-trip ion-button', 'Siguiente').should('have.attr', 'disabled');
      choosePlace('app-publish-trip', 'Roquetas de Mar');
      cy.get('app-publish-trip .route-fields__map-link').should('not.exist');
      cy.contains('app-publish-trip ion-button', 'Siguiente').should('have.attr', 'disabled');
      chooseParking('app-publish-trip', 'Parking P1');
      cy.contains('app-publish-trip ion-button', 'Siguiente').should('not.have.attr', 'disabled');
      cy.contains('app-publish-trip ion-button', 'Siguiente').click();

      // 2 · Vehículo: sin ninguno, se registra en una ventana y queda elegido
      cy.location('search').should('eq', '?step=2');
      cy.contains('app-publish-trip .vehicle-card--add', 'Registrar vehículo').click();
      cy.get('app-vehicle-modal ion-input[formControlName="brand"] input').type('Seat');
      cy.get('app-vehicle-modal ion-input[formControlName="model"] input').type('Ibiza');
      cy.get('app-vehicle-modal ion-input[formControlName="plate"] input').type('1234 bcd');
      // 5 asientos por defecto; uno menos: 4 = 1 conductor + 3 pasajeros
      cy.get('app-vehicle-modal button[aria-label="Una plaza menos"]').click();
      cy.contains('app-vehicle-modal', '4 asientos = 1 conductor + hasta 3 pasajeros');
      cy.contains('app-vehicle-modal ion-button', 'Registrar vehículo').click();
      cy.wait('@registerVehicle').its('request.body').should('deep.equal', {
        model: 'Seat Ibiza',
        plate: '1234BCD',
        capacity: 3,
      });
      cy.get('app-publish-trip .vehicle-card--selected').should('contain', 'Seat Ibiza');
      cy.contains('app-publish-trip .vehicle-picker__notice', 'un máximo de 3 plazas');
      cy.contains('app-publish-trip ion-button', 'Revisar detalle').click();

      // 3 · Revisión: el resumen y, la primera vez, la declaración
      cy.get('app-publish-trip [aria-current="step"]').should('contain', 'Revisión');
      cy.get('app-publish-trip .route-timeline__stop').first().should('contain', 'Roquetas de Mar');
      cy.contains('app-publish-trip button', 'Volver a Vehículo');
      cy.contains('app-publish-trip ion-button', 'Publicar viaje').should('have.attr', 'disabled');
      cy.get('app-publish-trip app-declaration-field ion-checkbox').click();
      cy.contains('app-publish-trip ion-button', 'Publicar viaje').click();

      cy.wait('@declare');
      cy.wait('@publish')
        .its('request.body')
        .should('include', { vehicleId: 'v1', offeredSeats: 1 });

      // 4 · Publicado: la enhorabuena, sin volver atrás, y qué hacer ahora
      cy.contains('app-publish-trip', '¡Enhorabuena! Has publicado un viaje.');
      cy.contains('app-publish-trip', 'Gracias por compartir tu coche');
      cy.contains('app-publish-trip button', 'Volver a').should('not.exist');
      cy.contains('app-publish-trip ion-button', 'Ver tus viajes');
      cy.contains('app-publish-trip button', 'Publicar otro viaje').click();
      cy.get('app-publish-trip [aria-current="step"]').should('contain', 'Trayecto');
    });
  });
}
