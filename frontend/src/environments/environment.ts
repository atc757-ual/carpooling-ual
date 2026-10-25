// Configuración del entorno de producción. En desarrollo (ng serve) se
// sustituye por environment.development.ts (fileReplacements de angular.json)
export const environment = {
  production: true,
  // La API del core-api (API Gateway), en el mismo dominio: el frontend solo
  // habla con él
  apiUrl: '/api',
  // Dominios de correo admitidos: los mismos que ALLOWED_EMAIL_DOMAINS del
  // backend, que es quien decide. Aquí solo evitan llamadas que fallarían
  allowedEmailDomains: ['ual.es', 'inlumine.ual.es'],
};
