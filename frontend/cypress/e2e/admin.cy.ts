import { VIEWPORTS } from '../support/e2e';

// Sesión recuperada al abrir la app: el token de renovación guardado
// (Preferences en la web) y la renovación que devuelve el usuario
function accessToken(profiles: string[]) {
  return {
    '@type': 'AccessToken',
    accessToken: 'access-1',
    tokenType: 'Bearer',
    expiresIn: 900,
    refreshToken: 'refresh-1',
    refreshTokenExpiresAt: '2026-12-01T00:00:00.000Z',
    user: {
      '@type': 'User',
      id: 'admin-1',
      href: '/api/users/admin-1',
      firstName: 'Admin',
      lastName: 'UAL',
      email: 'admin@ual.es',
      profiles,
    },
  };
}

// Una fila de GET /api/admin/users
const USER_ROW = {
  '@type': 'AdminUserRow',
  id: '0b6f8a52-3c1e-4f7a-9d2b-5e8c1a4f7b90',
  href: '/api/users/0b6f8a52-3c1e-4f7a-9d2b-5e8c1a4f7b90',
  name: 'Lucía Cortés',
  email: 'lcc123@inlumine.ual.es',
  profiles: [
    { profile: 'driver', isActive: true },
    { profile: 'passenger', isActive: true },
  ],
  statuses: ['open_incidents'],
  tripCount: 42,
  openIncidents: 2,
  suspensions: null,
  createdAt: '2026-10-01T10:00:00.000Z',
};

// GET /api/admin/users/{id} de esa fila
const USER_DETAIL = {
  ...USER_ROW,
  '@type': 'AdminUserDetail',
  phone: '+34600123456',
  isPhoneVerified: true,
  avatarKey: null,
  ratings: { driver: { average: 4.5, count: 4 }, passenger: null },
  vehicles: [],
  trips: [],
  requests: [],
  incidents: [],
  lateCancellations: [],
  consents: null,
};

// Una incidencia abierta de GET /api/incidents
const INCIDENT = {
  '@type': 'Incident',
  id: '5c1e8a52-3c1e-4f7a-9d2b-5e8c1a4f7b91',
  href: '/api/incidents/5c1e8a52-3c1e-4f7a-9d2b-5e8c1a4f7b91',
  trip: {
    id: 't1',
    href: '/api/trips/t1',
    originName: 'Roquetas de Mar',
    destinationName: 'Campus UAL',
    departureAt: '2026-11-02T07:40:00.000Z',
    driver: { id: 'd1', name: 'Javier Pardo' },
  },
  reporter: { id: 'p1', name: 'Lucía Cortés', role: 'passenger' },
  category: 'driver',
  description: 'The driver did not stop at the pickup point',
  reportedAt: '2026-11-02T08:05:00.000Z',
  status: 'open',
  review: null,
};

// Configuración de S1 de GET /api/admin/simulations/scenarios
const SCENARIO_S1 = {
  code: 'S1',
  name: 'Carpooling básico',
  users: 200,
  adoptionRate: 0.3,
  modalSplit: { own_car: 0.3 },
  timeWindowMin: 15,
  parameters: {},
};

function visitWithSession(path: string, profiles: string[]): void {
  cy.intercept('POST', '/api/auth/refresh', accessToken(profiles));
  cy.visit(path, {
    onBeforeLoad(win) {
      win.localStorage.setItem('CapacitorStorage.auth.refresh-token', 'refresh-1');
    },
  });
}

for (const viewport of VIEWPORTS) {
  describe(`Admin panel (${viewport.name})`, () => {
    beforeEach(() => {
      cy.viewport(viewport.width, viewport.height);
      cy.intercept('GET', '/api/incidents?status=open*', {
        body: [],
        headers: { 'X-Total-Count': '2', 'Access-Control-Expose-Headers': 'X-Total-Count' },
      });
    });

    it('opens the simulation with the six sections and the open incidents', () => {
      visitWithSession('/admin', ['admin']);

      cy.location('pathname').should('eq', '/admin/simulation');
      cy.contains('.admin-header__brand', 'Carpooling UAL · Admin');
      cy.contains('.admin-header__email', 'admin@ual.es');
      cy.get('.admin-nav__link').should('have.length', 6);
      cy.contains('.admin-nav__link', 'Incidencias')
        .find('.admin-nav__badge')
        .should('contain', '2');
      cy.contains('h1', 'Simulación de escenarios');
    });

    it('moves between sections and manages a catalog', () => {
      cy.intercept('GET', '/api/admin/catalogs/vehicle-brands?*', [
        { key: 'seat', name: 'SEAT', isActive: true, sortOrder: 0 },
        { key: 'skoda', name: 'Škoda', isActive: true, sortOrder: 1 },
      ]).as('brands');
      cy.intercept('POST', '/api/admin/catalogs/vehicle-brands/skoda/move', {
        key: 'skoda',
      }).as('move');
      visitWithSession('/admin', ['admin']);

      cy.contains('.admin-nav__link', 'Catálogos').click();

      cy.location('pathname').should('eq', '/admin/catalogs');
      cy.contains('.admin-nav__link', 'Catálogos').should('have.attr', 'aria-current', 'page');
      cy.contains('h1', 'Catálogos');
      cy.wait('@brands');
      // Ionic pasa el aria-label al botón interno: el primero de la fila es «Subir»
      cy.contains('.catalogs__row', 'Škoda').find('ion-button').first().click();
      cy.wait('@move').its('request.body').should('deep.equal', { direction: 'up' });
    });

    it('saves a draft of a legal document with its change type and summary', () => {
      cy.intercept('GET', '/api/admin/legal-documents?*', [
        {
          id: 'p1',
          type: 'terms',
          version: '1.0',
          content: '<p>Texto vigente</p>',
          changeType: 'major',
          summary: null,
          status: 'published',
          publishedAt: '2026-10-30T10:00:00.000Z',
          updatedAt: '2026-10-30T10:00:00.000Z',
        },
      ]).as('versions');
      cy.intercept('PUT', '/api/admin/legal-documents/terms/draft', {
        statusCode: 200,
        body: { id: 'd1', type: 'terms', version: '2.0', status: 'draft' },
      }).as('save');
      visitWithSession('/admin/catalogs?catalog=legal-documents', ['admin']);

      cy.wait('@versions');
      cy.contains('Vigente: versión 1.0.');
      cy.get('.legal-editor__preview .legal').should('contain', 'Texto vigente');
      cy.contains('Saldrá como la versión 1.1');
      cy.contains('ion-button', 'Publicar').should('have.attr', 'disabled');

      cy.contains('.legal-editor__change ion-segment-button', 'Cambio importante').click();
      cy.contains('Saldrá como la versión 2.0');
      cy.get('.legal-editor__change ion-textarea textarea')
        .should('be.visible')
        .type('Nuevas normas.');
      cy.contains('ion-button', 'Publicar').should('not.have.attr', 'disabled');
      cy.contains('ion-button', 'Guardar borrador').click();
      cy.wait('@save').its('request.body').should('deep.equal', {
        content: '<p>Texto vigente</p>',
        changeType: 'major',
        summary: 'Nuevas normas.',
      });
    });

    it('lists the trips and filters them by status in the URL', () => {
      cy.intercept('GET', '/api/admin/trips?*', {
        body: [
          {
            id: 't1',
            href: '/api/admin/trips/t1',
            status: 'confirmed',
            departureAt: '2026-11-02T07:30:00.000Z',
            originName: 'Roquetas de Mar',
            destinationName: 'Campus UAL',
            driver: { id: 'u1', name: 'Javier Pardo' },
            offeredSeats: 3,
            availableSeats: 2,
            requests: { pending: 2, accepted: 1 },
          },
        ],
        headers: { 'X-Total-Count': '1', 'Access-Control-Expose-Headers': 'X-Total-Count' },
      }).as('trips');
      visitWithSession('/admin/trips?status=confirmed', ['admin']);

      cy.wait('@trips').its('request.url').should('include', 'status=confirmed');
      cy.contains('tr', 'Roquetas de Mar → Campus UAL')
        .should('contain', 'Javier Pardo')
        .and('contain', '1 aceptada · 2 pendientes')
        .and('contain', 'Confirmado');
    });

    it('opens a trip with its requests and timeline, and goes back to the list', () => {
      cy.intercept('GET', '/api/admin/trips?*', {
        body: [
          {
            id: 't1',
            href: '/api/admin/trips/t1',
            status: 'confirmed',
            departureAt: '2026-11-02T07:30:00.000Z',
            originName: 'Roquetas de Mar',
            destinationName: 'Campus UAL',
            driver: { id: 'u1', name: 'Javier Pardo' },
            offeredSeats: 3,
            availableSeats: 2,
            requests: { pending: 0, accepted: 1 },
          },
        ],
        headers: { 'X-Total-Count': '1', 'Access-Control-Expose-Headers': 'X-Total-Count' },
      });
      cy.intercept('GET', '/api/admin/trips/t1', {
        id: 't1',
        href: '/api/admin/trips/t1',
        status: 'confirmed',
        departureAt: '2026-11-02T07:30:00.000Z',
        originName: 'Roquetas de Mar',
        destinationName: 'Campus UAL',
        driver: { id: 'u1', name: 'Javier Pardo' },
        offeredSeats: 3,
        availableSeats: 2,
        requests: { pending: 0, accepted: 1 },
        seatRequests: [
          {
            id: 'r1',
            href: '/api/requests/r1',
            status: 'accepted',
            passenger: { id: 'u2', name: 'Lucía Cortés' },
            seats: 1,
            isPriority: false,
            pickupName: 'Avenida del Mediterráneo',
            pickupAt: '2026-11-02T07:42:00.000Z',
            requestedAt: '2026-11-01T09:00:00.000Z',
          },
        ],
        timeline: [
          {
            id: 'e1',
            href: '/api/admin/events/e1',
            sequence: 1,
            type: 'trip.published',
            version: 1,
            sourceEntityId: 't1',
            occurredAt: '2026-11-01T08:00:00.000Z',
          },
        ],
      }).as('trip');
      visitWithSession('/admin/trips?status=confirmed', ['admin']);

      cy.contains('a', 'Ver detalle').click();
      cy.wait('@trip');
      cy.contains('h1', 'Roquetas de Mar → Campus UAL');
      cy.contains('.trip-detail__request', 'Lucía Cortés').should(
        'contain',
        'Recogida: Avenida del Mediterráneo',
      );
      cy.contains('.trip-detail__event', 'Viaje publicado');

      cy.contains('ion-button', 'Viajes').click();
      cy.location('search').should('eq', '?status=confirmed');
    });

    it('opens a user and deactivates a profile with a reason', () => {
      cy.intercept('GET', '/api/admin/users?*', {
        body: [USER_ROW],
        headers: { 'X-Total-Count': '1', 'Access-Control-Expose-Headers': 'X-Total-Count' },
      });
      cy.intercept('GET', `/api/admin/users/${USER_ROW.id}`, USER_DETAIL).as('detail');
      cy.intercept('PUT', `/api/users/${USER_ROW.id}/profiles/driver`, {}).as('profile');
      visitWithSession('/admin/users', ['admin']);

      cy.contains('a', 'Ver perfil').click();
      cy.wait('@detail');
      cy.contains('h1', 'Lucía Cortés');
      cy.contains('li', 'Conductor').contains('ion-button', 'Desactivar').click();

      cy.get('app-reason-confirm-modal').within(() => {
        cy.contains('¿Desactivar el perfil de conductor?');
        cy.contains('ion-button', 'Desactivar perfil').should('have.attr', 'disabled');
        cy.get('ion-textarea textarea').type('Several reports on the same week');
        cy.contains('ion-button', 'Desactivar perfil').should('not.have.attr', 'disabled');
        cy.contains('ion-button', 'Desactivar perfil').click();
      });

      cy.wait('@profile')
        .its('request.body')
        .should('deep.equal', { isActive: false, reason: 'Several reports on the same week' });
      cy.get('ion-toast')
        .shadow()
        .find('.toast-message')
        .should('contain', 'Perfil de conductor desactivado.');
    });

    it('runs a scenario, follows its progress and shows its results', () => {
      const run = {
        id: 'r1',
        href: '/api/admin/simulations/r1',
        scenario: 'S1',
        baselineScenario: 'S0',
        scenarioConfig: { scenario: SCENARIO_S1, baseline: { ...SCENARIO_S1, code: 'S0' } },
        replicas: 3,
        seed: 20261101,
        status: 'running',
        progress: 1,
        requestedBy: 'admin-1',
        snapshotAt: '2026-10-25T08:12:00.000Z',
        requestedAt: '2026-10-25T08:12:00.000Z',
        startedAt: null,
        finishedAt: null,
        errorCode: null,
        criterionMet: null,
      };
      const stat = (mean: number) => ({ mean, sd: 1, ciLow: mean - 1, ciHigh: mean + 1 });
      let runs: object[] = [];
      cy.intercept('GET', '/api/admin/simulations/scenarios', [
        { ...SCENARIO_S1, '@type': 'SimulationScenario', id: 's1', replicas: 3 },
      ]);
      cy.intercept('GET', '/api/admin/simulations?*', (request) =>
        request.reply({
          body: runs,
          headers: {
            'X-Total-Count': String(runs.length),
            'Access-Control-Expose-Headers': 'X-Total-Count',
          },
        }),
      );
      cy.intercept('POST', '/api/admin/simulations', (request) => {
        runs = [run];
        request.reply(201, run);
      }).as('start');
      let polls = 0;
      cy.intercept('GET', '/api/admin/simulations/r1', (request) => {
        polls += 1;
        request.reply(
          polls < 2 ? run : { ...run, status: 'finished', progress: 3, criterionMet: true },
        );
      });
      cy.intercept('GET', '/api/admin/simulations/r1/results', {
        href: '/api/admin/simulations/r1/results',
        replicas: 3,
        criterionMet: true,
        summary: {
          vehiclesUsed: { scenario: stat(42), baseline: stat(50) },
          averageOccupancy: { scenario: stat(1.4), baseline: stat(1.2) },
          vehiclesAvoidedPct: stat(16.4),
          requestsCoveredPct: stat(74.5),
          matchingP95Ms: stat(171),
          recoveryPct: null,
        },
        series: [
          { slot: '07:00', vehicles: 8, baselineVehicles: 10 },
          { slot: '07:30', vehicles: 17, baselineVehicles: 20 },
        ],
      });
      visitWithSession('/admin/simulation', ['admin']);

      cy.contains('Aún no hay ejecuciones');
      cy.contains('ion-button', 'Ejecutar S1 frente a S0').click();
      cy.wait('@start').its('request.body').should('deep.equal', {
        scenario: 'S1',
        baselineScenario: 'S0',
        replicas: 3,
        seed: 20261101,
      });
      cy.contains('1/3 réplicas');

      cy.contains('3/3 réplicas · criterio cumplido', { timeout: 6000 });
      cy.contains('.results__kpi', 'Vehículos evitados').contains('16,4 %');
      cy.get('svg[role="img"]')
        .should('have.attr', 'aria-label')
        .and('contain', '07:30: S0 20, S1 17');
      cy.contains('.simulation__table', 'S1 frente a S0');
    });

    it('lists the open incidents, reviews one and opens another one', () => {
      cy.intercept('GET', '/api/incidents?offset=*', {
        body: [INCIDENT],
        headers: { 'X-Total-Count': '1', 'Access-Control-Expose-Headers': 'X-Total-Count' },
      }).as('incidents');
      cy.intercept('POST', `/api/incidents/${INCIDENT.id}/review`, {
        ...INCIDENT,
        status: 'reviewed',
      }).as('review');
      cy.intercept('GET', `/api/incidents/${INCIDENT.id}`, INCIDENT);
      visitWithSession('/admin/incidents', ['admin']);

      cy.wait('@incidents').its('request.query.status').should('eq', 'open');
      cy.contains('.incident-card--danger', 'Con el conductor').within(() => {
        cy.contains('Lucía Cortés (pasajero) · conductor: Javier Pardo');
        cy.contains('ion-button', 'Marcar revisada').click();
      });
      cy.get('app-reason-confirm-modal').within(() => {
        cy.get('ion-textarea textarea').type('Talked to both of them');
        cy.contains('ion-button', 'Marcar revisada').click();
      });
      cy.wait('@review')
        .its('request.body')
        .should('deep.equal', { resolution: 'Talked to both of them' });

      cy.contains('a', 'Ver detalle').click();
      cy.location('pathname').should('eq', `/admin/incidents/${INCIDENT.id}`);
      cy.contains('h1', 'Con el conductor');
      cy.contains('a', 'Javier Pardo').should('have.attr', 'href', '/admin/users/d1');
    });

    it('lists the users, filters them and keeps the filters in the URL', () => {
      cy.intercept('GET', '/api/admin/users?*', (request) => {
        const isSuspended = request.query['status'] === 'suspended';
        request.reply({
          body: isSuspended ? [] : [USER_ROW],
          headers: {
            'X-Total-Count': isSuspended ? '0' : '1284',
            'Access-Control-Expose-Headers': 'X-Total-Count',
          },
        });
      }).as('users');
      visitWithSession('/admin/users', ['admin']);

      cy.wait('@users');
      cy.contains('h1', 'Usuarios · 1');
      cy.contains('tbody tr', 'Lucía Cortés').within(() => {
        cy.contains('Conductor · Pasajero');
        cy.contains('.status', '2 incidencias');
        cy.contains('a', 'Ver perfil').should('have.attr', 'href', `/admin/users/${USER_ROW.id}`);
      });
      cy.contains('.pagination__range', '1–20 de 1');

      visitWithSession('/admin/users?status=suspended', ['admin']);
      cy.contains('Ningún usuario coincide');
      cy.contains('ion-button', 'Quitar filtros').click();
      cy.location('search').should('eq', '');
      cy.contains('tbody tr', 'Lucía Cortés');
    });

    it('sends users without the admin profile to their profile', () => {
      visitWithSession('/admin', ['passenger']);

      cy.location('pathname').should('eq', '/tabs/profile');
    });

    it('logs an admin without other profiles into the panel and keeps them there', () => {
      cy.intercept('POST', '/api/auth/login', accessToken(['admin']));
      cy.visit('/auth/login');
      cy.get('app-login ion-input[formControlName="email"] input').type('admin@ual.es');
      cy.get('app-login ion-input[formControlName="password"] input').type('secreta123');
      cy.contains('ion-button', 'Entrar').click();

      cy.location('pathname').should('eq', '/admin/simulation');
      visitWithSession('/tabs/publish', ['admin']);
      cy.location('pathname').should('eq', '/admin/simulation');
    });

    it('offers going to the app only to admins who also travel', () => {
      visitWithSession('/admin', ['admin']);
      cy.get('#admin-account-trigger').click();
      cy.get('ion-popover ion-item').should('have.length', 1).and('contain', 'Cerrar sesión');

      visitWithSession('/admin', ['passenger', 'admin']);
      cy.get('#admin-account-trigger').click();
      cy.contains('ion-popover ion-item', 'Ir a la app').click();
      cy.location('pathname').should('match', /^\/tabs/);
    });
  });
}
