import { VIEWPORTS } from '../support/e2e';

const EMAIL = 'lucia.cortes@ual.es';

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
      firstName: 'Lucía',
      lastName: 'Cortés',
      email: EMAIL,
      phone: '+34612345678',
      profiles,
      activeMode: null,
    },
  };
}

const VEHICLE = {
  '@type': 'Vehicle',
  id: 'v1',
  plate: '1234BCD',
  plateCountry: 'ES',
  brand: 'SEAT',
  model: 'León',
  color: 'white',
  engine: 'hybrid',
  capacity: 3,
  status: 'available',
};

// Se entra por el login con esos perfiles y se abre el Perfil
function openProfile(profiles: string[]): void {
  cy.intercept('POST', '/api/auth/login', accessToken(profiles));
  cy.visit('/auth/login');
  cy.get('app-login ion-input[formControlName="email"] input').type(EMAIL);
  cy.get('app-login ion-input[formControlName="password"] input').type('secreta123');
  cy.contains('ion-button', 'Entrar').click();
  cy.location('pathname').should('be.oneOf', ['/tabs/search', '/tabs/publish']);
  // Mi perfil, en la cabecera (la del móvil o la de escritorio)
  cy.get('app-tabs .profile-button:visible').click();
  cy.location('pathname').should('eq', '/tabs/profile');
}

for (const viewport of VIEWPORTS) {
  describe(`Profile (${viewport.name})`, () => {
    beforeEach(() => {
      cy.viewport(viewport.width, viewport.height);
      cy.intercept('GET', '/api/vehicles*', [VEHICLE]);
    });

    it('shows the account and the vehicles of a driver', () => {
      openProfile(['driver']);

      cy.contains('app-profile', 'Lucía Cortés').should('be.visible');
      cy.contains('app-profile ion-item', 'Configuración de mis viajes').click();
      cy.location('pathname').should('eq', '/tabs/profile/preferences');
      cy.contains('app-profile-vehicles', '1234 BCD');
      cy.contains('app-profile-vehicles', 'SEAT León');
      cy.contains('app-profile-vehicles', 'Blanco · 3 plazas · Híbrido');
    });

    it('tells about a minor version newer than the accepted one and shows what changed', () => {
      const consent = (type: string) => ({
        id: `c-${type}`,
        type,
        documentVersion: '1.0',
        action: 'granted',
        source: 'registration',
        recordedAt: '2026-10-21T09:00:00.000Z',
        fingerprint: 'a'.repeat(64),
      });
      cy.intercept('GET', '/api/users/me/legal-documents/pending', []);
      cy.intercept('GET', '/api/users/me/consents', {
        current: { terms: consent('terms'), privacy: consent('privacy'), location: null },
        outdated: [],
        history: [],
      });
      cy.intercept('GET', '/api/legal-documents/terms?*', {
        type: 'terms',
        version: '1.0',
        content: '<p>Condiciones</p>',
        changeType: 'major',
        summary: null,
        publishedAt: '2026-10-20T09:00:00.000Z',
      });
      cy.intercept('GET', '/api/legal-documents/privacy?*', {
        type: 'privacy',
        version: '1.1',
        content: '<h2>Responsable</h2><p>Universidad de Almería.</p>',
        changeType: 'minor',
        summary: 'Aclaramos cuánto tiempo guardamos tus consentimientos.',
        publishedAt: '2026-11-03T09:00:00.000Z',
      });
      openProfile(['passenger']);

      cy.contains('app-profile ion-item', 'Configuración y privacidad').click();
      cy.location('pathname').should('eq', '/tabs/profile/settings');
      cy.contains('app-profile-settings-page', '+34 612 345 678');
      cy.contains('app-profile-settings-page', 'Aceptada la v1.0 el 21 oct 2026');
      cy.contains('.profile__legal-update', 'Vigente: v1.1 · actualizada el 3 nov 2026')
        .should('contain', 'Ver novedades')
        .click();

      cy.contains('app-legal-modal .legal-changes', 'Qué ha cambiado en la versión 1.1')
        .should('be.visible')
        .and('contain', 'Aclaramos cuánto tiempo guardamos tus consentimientos.');
      cy.contains('app-legal-modal', 'Universidad de Almería.');
    });

    it('removes a vehicle after confirming it', () => {
      // Sin viajes programados: basta confirmarlo
      cy.intercept('GET', '/api/vehicles/v1/upcoming-trips*', { body: [] });
      cy.intercept('DELETE', '/api/vehicles/v1', { statusCode: 204 }).as('remove');
      openProfile(['driver']);

      cy.contains('app-profile ion-item', 'Configuración de mis viajes').click();
      cy.location('pathname').should('eq', '/tabs/profile/preferences');
      cy.get('app-profile-vehicles [aria-label*="Eliminar"]').click();
      cy.contains('app-confirm-modal ion-button', 'Eliminar').click();

      cy.wait('@remove');
    });

    it('finds a question in Help & support and opens its answer', () => {
      const faq = (id: string, topic: string, audience: string, question: string) => ({
        '@type': 'Faq',
        id,
        topic,
        audience,
        quickContexts: [],
        question,
        answer: 'Cuánto antes o después de tu hora te viene bien.',
        points: [],
      });
      const margin = faq('f1', 'search', 'passenger', '¿Qué es el margen horario?');
      cy.intercept('GET', '/api/faq-topics?*', [
        { id: 't1', key: 'search', name: 'Buscar y pedir plaza', icon: 'ticket-outline' },
        { id: 't2', key: 'publish', name: 'Publicar y conducir', icon: 'car-outline' },
      ]);
      cy.intercept('GET', '/api/faqs?*', (req) => {
        req.reply(
          req.query['q']
            ? [margin]
            : [margin, faq('f2', 'publish', 'driver', '¿Cuántas plazas ofrezco?')],
        );
      });
      cy.intercept('GET', '/api/faqs/f1?*', margin);
      openProfile(['passenger']);

      cy.contains('app-profile ion-item', 'Ayuda y soporte').click();
      cy.location('pathname').should('eq', '/tabs/profile/help');
      // Las de pasajero; las de conductor, en su pestaña
      cy.contains('.help-topic-card', 'Buscar y pedir plaza').should('be.visible');
      cy.contains('.help-topic-card', 'Publicar y conducir').should('not.exist');
      cy.contains('.audience-picker__option', 'Conductor').click();
      cy.contains('.help-topic-card', 'Publicar y conducir').should('be.visible');

      cy.get('.help-heading__search input:visible').type('margen');
      cy.contains('.help-search__item', '¿Qué es el margen horario?').click();

      cy.location('pathname').should('eq', '/tabs/profile/help/f1');
      cy.contains('.help-answer__question', '¿Qué es el margen horario?');
      cy.contains('.help-answer', 'Cuánto antes o después de tu hora te viene bien.');
    });
  });
}
