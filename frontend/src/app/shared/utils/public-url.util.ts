import { Capacitor } from '@capacitor/core';
import { environment } from '../../../environments/environment';

// La dirección pública de la web, para los enlaces que se envían a otra
// persona (el viaje en directo, las plazas libres): la configurada
// (publicWebUrl, sin la barra final) o, en la web, la de la página. En la app
// nativa sin dirección configurada, null: el origen es el de la WebView
// (localhost), que no abre nada en otro móvil
export function publicWebOrigin(
  configured: string = environment.publicWebUrl,
  isNative: boolean = Capacitor.isNativePlatform(),
): string | null {
  if (configured) {
    return configured.replace(/\/+$/, '');
  }
  return isNative ? null : globalThis.location.origin;
}
