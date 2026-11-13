import { Injectable } from '@angular/core';

// Lo que se comparte: el texto y, si lo hay, el enlace (va aparte para que el
// menú del sistema lo trate como enlace)
export interface ShareContent {
  title: string;
  text: string;
  url?: string;
}

// shared: con el menú del sistema; whatsapp: sin él, por WhatsApp Web o la
// app; cancelled: el usuario cerró el menú sin elegir
export type ShareOutcome = 'shared' | 'whatsapp' | 'cancelled';

// Enlace de WhatsApp con el mensaje ya escrito (el usuario elige a quién)
export function buildWhatsAppUrl({ text, url }: ShareContent): string {
  const message = url ? `${text}\n${url}` : text;
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

// Compartir un viaje (las plazas libres en los grupos de clase, o el viaje en
// curso con un familiar): el menú de compartir del sistema si el navegador lo
// tiene (móvil y Safari) y, si no, WhatsApp. Sin dependencias nuevas
@Injectable({ providedIn: 'root' })
export class TripShareService {
  async share(content: ShareContent): Promise<ShareOutcome> {
    const navigator = globalThis.navigator;
    if (typeof navigator?.share === 'function') {
      try {
        await navigator.share(content);
        return 'shared';
      } catch (error) {
        // Cerrar el menú no es un error. Si el navegador lo rechaza
        // (NotAllowedError, p. ej. en un iframe), se ofrece WhatsApp
        if (isShareError(error, 'AbortError')) {
          return 'cancelled';
        }
        if (!isShareError(error, 'NotAllowedError')) {
          throw error;
        }
      }
    }
    globalThis.open(buildWhatsAppUrl(content), '_blank', 'noopener');
    return 'whatsapp';
  }
}

function isShareError(error: unknown, name: string): boolean {
  return error instanceof DOMException && error.name === name;
}
