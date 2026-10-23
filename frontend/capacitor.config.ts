import type { CapacitorConfig } from '@capacitor/cli';

// Capacitor empaqueta la web (el build de Angular en www/) como app móvil
// nativa. Las plataformas (Android) y los plugins (p. ej. la geolocalización
// del seguimiento del viaje) se añaden cuando hagan falta
const config: CapacitorConfig = {
  appId: 'es.ual.carpooling',
  appName: 'Carpooling UAL',
  webDir: 'www',
};

export default config;
