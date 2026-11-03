// Configuración de la app Android para probarla (npm run build:android). En
// la app, /api (relativa) no llega al backend: la WebView no tiene el proxy de
// ng serve. Con «adb reverse tcp:3000 tcp:3000», el localhost del móvil o del
// emulador es el del ordenador, donde corre el backend. Las peticiones salen
// por CapacitorHttp (capacitor.config.ts): sin CORS. Para publicar la app hará
// falta otra con la dirección HTTPS del servidor
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  allowedEmailDomains: ['ual.es', 'inlumine.ual.es'],
};
