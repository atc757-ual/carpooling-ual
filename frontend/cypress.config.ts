import { defineConfig } from 'cypress';

// Tests e2e en un navegador real contra la app (npm start). La API se simula
// con cy.intercept: no hace falta el backend ni la base de datos
export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:4200',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    video: false,
  },
});
