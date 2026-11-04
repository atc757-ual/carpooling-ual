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
  // Firebase (solo Messaging, para las notificaciones push). Es pública: va en
  // la web que descarga cualquiera; lo secreto es la cuenta de servicio del
  // backend. pushVapidKey: la clave pública de Web Push (Cloud Messaging)
  firebase: {
    apiKey: 'AIzaSyA4GyYFuukD4Xr4vvQcCfS-NA31h-iyGYo',
    authDomain: 'es-ual-carpooling.firebaseapp.com',
    projectId: 'es-ual-carpooling',
    storageBucket: 'es-ual-carpooling.firebasestorage.app',
    messagingSenderId: '481807649503',
    appId: '1:481807649503:web:2c5de9581ed1da6d69b76a',
  },
  pushVapidKey:
    'BLoPIQxzwK0i3BXSF4zJDq9jXW5u86a_GVLn7nQLmnctaCNwbINZjWX2A7YvMcAnvR3r-o2YkAiJ8b9U2OTD9P4',
};
