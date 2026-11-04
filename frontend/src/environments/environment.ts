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
