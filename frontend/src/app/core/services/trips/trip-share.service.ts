import { inject, Injectable } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { ToastService } from '../ui/toast.service';

// Lo que se comparte: el texto y, si lo hay, el enlace (va aparte para que el
// menú del sistema lo trate como enlace)
export interface ShareContent {
  title: string;
  text: string;
  url?: string;
}

// shared: con el menú del sistema; whatsapp: sin él, por WhatsApp Web o la
// app; cancelled: el usuario cerró el menú sin elegir; copied: enlace copiado al portapapeles
export type ShareOutcome = 'shared' | 'whatsapp' | 'cancelled' | 'copied';

// Enlace de WhatsApp con el mensaje ya escrito (el usuario elige a quién)
export function buildWhatsAppUrl({ text, url }: ShareContent): string {
  const message = url ? `${text}\n${url}` : text;
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

// Compartir un viaje (las plazas libres en los grupos de clase, o el viaje en
// curso con un familiar): el menú de compartir del sistema si el navegador lo
// tiene (móvil y Safari); si no hay menú pero hay enlace, se copia al portapapeles;
// y, si no hay enlace o falla el portapapeles, WhatsApp. Sin dependencias nuevas
@Injectable({ providedIn: 'root' })
export class TripShareService {
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  async share(content: ShareContent): Promise<ShareOutcome> {
    const navigator = globalThis.navigator;
    if (typeof navigator?.share === 'function') {
      try {
        await navigator.share(content);
        return 'shared';
      } catch (error) {
        // Cerrar el menú no es un error. Si el navegador lo rechaza
        // (NotAllowedError, p. ej. en un iframe), se ofrece la alternativa
        if (isShareError(error, 'AbortError')) {
          return 'cancelled';
        }
        if (!isShareError(error, 'NotAllowedError')) {
          throw error;
        }
      }
    }
    if (content.url && typeof navigator?.clipboard?.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(content.url);
        await this.toast.showSuccess(this.transloco.translate('share.linkCopied'));
        return 'copied';
      } catch {
        // Si el portapapeles no está disponible o falla, abre WhatsApp
      }
    }
    globalThis.open(buildWhatsAppUrl(content), '_blank', 'noopener');
    return 'whatsapp';
  }
}

function isShareError(error: unknown, name: string): boolean {
  return error instanceof DOMException && error.name === name;
}
