// Configuración del entorno de desarrollo. La API también va en /api: ng serve
// la reenvía al backend en local (proxy.conf.json), igual que Nginx en
// producción. Así el navegador nunca hace peticiones a otro origen (sin CORS)
export const environment = {
  production: false,
  apiUrl: '/api',
  allowedEmailDomains: ['ual.es', 'inlumine.ual.es'],
};
