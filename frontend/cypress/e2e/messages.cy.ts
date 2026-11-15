import { VIEWPORTS } from '../support/e2e';

const EMAIL = 'lucia.cortes@ual.es';

const ACCESS_TOKEN = {
  '@type': 'AccessToken',
  accessToken: 'access-1',
  tokenType: 'Bearer',
  expiresIn: 900,
  refreshToken: 'refresh-1',
  refreshTokenExpiresAt: '2026-11-01T00:00:00.000Z',
  user: {
    '@type': 'User',
    id: 'driver-1',
    href: '/api/users/driver-1',
    firstName: 'Lucía',
    lastName: 'Cortés',
    email: EMAIL,
    phone: '+34612345678',
    profiles: ['passenger', 'driver'],
    activeMode: 'driver',
  },
};

const TRIP = {
  id: 't1',
  href: '/api/trips/t1',
  originName: 'Roquetas de Mar',
  destinationName: 'Campus UAL',
  departureAt: '2099-01-15T07:30:00.000Z',
  status: 'confirmed',
  driverName: 'Lucía',
  driverAvatarKey: null,
};

// La conductora tiene una conversación con cada pasajero aceptado
function conversation(passengerId: string, name: string) {
  return {
    '@type': 'Conversation',
    id: `t1:${passengerId}`,
    href: `/api/trips/t1/messages?passengerId=${passengerId}`,
    trip: TRIP,
    passenger: { id: passengerId, name, avatarKey: null },
    myRole: 'driver',
    lastMessage: null,
    unreadCount: 0,
    isOpen: true,
  };
}

function message(id: string, text: string, isShared: boolean) {
  return {
    '@type': 'ChatMessage',
    id,
    author: { id: 'p1', name: 'Pía', avatarKey: null },
    authorRole: 'passenger',
    kind: 'text',
    text,
    quickReply: null,
    createdAt: '2099-01-14T10:00:00.000Z',
    readByAll: false,
    isShared,
  };
}

for (const viewport of VIEWPORTS) {
  describe(`Direct chats (${viewport.name})`, () => {
    beforeEach(() => {
      cy.viewport(viewport.width, viewport.height);
      cy.intercept('GET', '/api/users/me/notifications*', []);
      cy.intercept({ method: 'GET', pathname: '/api/users/me/conversations' }, (req) => {
        // El viaje en curso y el punto de no leídos: nada
        if (req.query['tripStatus'] || req.query['hasUnread']) {
          req.reply([]);
          return;
        }
        req.reply({
          body: [conversation('p1', 'Pía'), conversation('p2', 'Leo')],
          headers: { 'X-Total-Count': '2' },
        });
      });
      cy.intercept({ method: 'GET', pathname: '/api/trips/t1/conversation' }, (req) =>
        req.reply(conversation(String(req.query['passengerId']), 'Pía')),
      );
      cy.intercept({ method: 'GET', pathname: '/api/trips/t1/messages' }, [
        message('m0', 'Salgo a las 8', true),
        message('m1', 'Estoy en el portal', false),
      ]).as('messages');
      cy.intercept({ method: 'PUT', pathname: '/api/trips/t1/messages/read' }, { statusCode: 204 });
      cy.intercept({ method: 'GET', pathname: '/api/trips/t1/contacts' }, []);
    });

    it('lists one conversation per passenger and opens the one with Pía', () => {
      cy.intercept('POST', '/api/auth/login', ACCESS_TOKEN);
      cy.visit('/auth/login');
      cy.get('app-login ion-input[formControlName="email"] input').type(EMAIL);
      cy.get('app-login ion-input[formControlName="password"] input').type('secreta123');
      cy.contains('ion-button', 'Entrar').click();
      cy.location('pathname').should('eq', '/tabs/search');
      cy.contains(
        viewport.name === 'desktop' ? 'app-tabs .top-nav__link' : 'app-tabs ion-tab-button',
        'Mensajes',
      ).click();

      cy.get('app-messages .conversation__trip').should('have.length', 2);
      cy.contains('app-messages .conversation', 'Leo ·').should('be.visible');
      cy.contains('app-messages .conversation', 'Pía ·').click();

      if (viewport.name !== 'desktop') {
        cy.location('pathname').should('eq', '/tabs/messages/t1/p1');
      }
      cy.wait('@messages').its('request.query.passengerId').should('eq', 'p1');
      cy.contains('app-conversation .conversation__shared', 'Chat común anterior (solo lectura)')
        .should('be.visible')
        .and('contain', 'Salgo a las 8');
      cy.contains('app-conversation .bubble', 'Estoy en el portal').should('be.visible');
    });
  });
}
