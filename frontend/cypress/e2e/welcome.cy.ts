import { VIEWPORTS } from '../support/e2e';

for (const viewport of VIEWPORTS) {
  describe(`Welcome (${viewport.name})`, () => {
    beforeEach(() => {
      cy.viewport(viewport.width, viewport.height);
      cy.visit('/');
    });

    it('is where a guest lands', () => {
      cy.location('pathname').should('eq', '/auth/welcome');
      cy.contains('h1', 'Te damos la bienvenida').should('be.visible');
      cy.contains('Comunidad UAL · Perfiles verificados').should('be.visible');
    });

    it('shows the illustration on the side only on desktop', () => {
      cy.get('.auth-layout__visual').should(
        viewport.name === 'desktop' ? 'be.visible' : 'not.be.visible',
      );
      cy.get('.auth-layout__illustration').should(
        viewport.name === 'mobile' ? 'be.visible' : 'not.be.visible',
      );
    });

    it('fits the screen without scrolling', () => {
      // ion-content hace el scroll en un elemento de su shadow DOM
      cy.get('app-welcome ion-content')
        .shadow()
        .find('.inner-scroll')
        .should(($scroll) => {
          expect($scroll[0].scrollHeight).to.be.at.most($scroll[0].clientHeight);
        });
    });

    it('takes the user to the login', () => {
      cy.contains('ion-button', 'Ya tengo cuenta').click();
      cy.location('pathname').should('eq', '/auth/login');
    });
  });
}
