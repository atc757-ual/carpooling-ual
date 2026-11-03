import type { CapacitorConfig } from '@capacitor/cli';

// Capacitor empaqueta la web (el build de Angular en www/) como app móvil
// nativa (android/). Para compartir la ubicación del conductor con la app en
// segundo plano (@capgo/background-geolocation):
// - android.useLegacyBridge: sin él, las posiciones se paran a los 5 min en
//   segundo plano
// - CapacitorHttp: las peticiones salen por la vía nativa; las de la WebView
//   Android las frena a los 5 min en segundo plano
const config: CapacitorConfig = {
  appId: 'es.ual.carpooling',
  appName: 'Carpooling UAL',
  webDir: 'www',
  android: {
    useLegacyBridge: true,
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
