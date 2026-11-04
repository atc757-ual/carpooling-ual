// Configuración del entorno de desarrollo. La API también va en /api: ng serve
// la reenvía al backend en local (proxy.conf.json), igual que Nginx en
// producción. Así el navegador nunca hace peticiones a otro origen (sin CORS)
export const environment = {
  production: false,
  apiUrl: '/api',
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
