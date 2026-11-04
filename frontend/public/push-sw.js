// Service worker de las notificaciones push (Firebase Cloud Messaging en la
// web). El navegador lo mantiene vivo aunque la pestaña esté cerrada:
// - push: muestra el aviso con el título y el texto que manda el backend
// - notificationclick: si la app está abierta, la trae delante y le pasa los
//   datos para abrir la pantalla; si no, la abre en /tabs/push-open con ellos
// Es un fichero propio y pequeño (sin cargar el SDK de Firebase aquí): FCM
// entrega el aviso como un Web Push estándar

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  const notification = payload.notification || {};
  const data = payload.data || {};
  event.waitUntil(
    self.registration.showNotification(notification.title || 'Carpooling UAL', {
      body: notification.body || '',
      icon: '/favicon.ico',
      // Un aviso por viaje y tipo: el nuevo sustituye al anterior
      tag: [data.type, data.tripId].filter(Boolean).join(':') || undefined,
      data,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => client.url.startsWith(self.location.origin));
      if (open) {
        open.postMessage({ type: 'push-open', data });
        return open.focus();
      }
      const query = new URLSearchParams(data).toString();
      return self.clients.openWindow(`/tabs/push-open?${query}`);
    }),
  );
});
