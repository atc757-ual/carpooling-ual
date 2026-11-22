import { inject, Injectable } from '@angular/core';
import { translate, TRANSLOCO_TRANSPILER, TranslocoService } from '@jsverse/transloco';
import { ChatContact } from '../../models/chat.model';
import { ChatService } from '../chat/chat.service';
import { ToastService } from '../ui/toast.service';
import { fallbackOnApiError } from '../../models/api-error.model';

// Solo en curso (la recogida y el trayecto): antes y después, el chat. La
// misma regla que la API (chat.service.ts) y la Política de privacidad
export const CALLABLE_TRIP_STATUSES = new Set(['in_progress']);

// Servicio compartido para gestionar llamadas desde el viaje o el chat:
// solo con el viaje en curso y teléfonos verificados por SMS.
@Injectable({ providedIn: 'root' })
export class TripCallService {
  private readonly chat = inject(ChatService);
  private readonly toast = inject(ToastService);
  private readonly transpiler = inject(TRANSLOCO_TRANSPILER, { optional: true });
  private readonly transloco = this.transpiler
    ? inject(TranslocoService, { optional: true })
    : null;

  // Carga los contactos con teléfono verificado para este viaje
  async loadContacts(tripId: string, passengerId?: string | null): Promise<ChatContact[]> {
    return this.chat.listContacts({ tripId, passengerId }).catch(fallbackOnApiError([]));
  }

  // Comprueba si se puede llamar al contacto
  canCall(tripStatus: string | undefined | null, contact: ChatContact | null | undefined): boolean {
    return Boolean(tripStatus && CALLABLE_TRIP_STATUSES.has(tripStatus) && contact?.phone);
  }

  // Abre la aplicación de teléfono sin mostrar el número
  openPhone(phone: string): void {
    globalThis.location.href = `tel:${phone}`;
  }

  // Mensaje explicativo cuando la llamada no está disponible
  getUnavailableReason(tripStatus: string | undefined | null): string {
    if (tripStatus && CALLABLE_TRIP_STATUSES.has(tripStatus)) {
      return (
        this.transloco?.translate('common.tripCall.noSharedPhone') ??
        translate('screens.tripCall.nadieMasEsteViaje')
      );
    }
    return (
      this.transloco?.translate('common.tripCall.onlyAllowed') ??
      translate('screens.tripCall.soloPuedeLlamarViaje')
    );
  }

  // Ejecuta la llamada si es posible o muestra el aviso informativo azul
  call(contact: ChatContact | null | undefined, tripStatus: string | undefined | null): void {
    if (this.canCall(tripStatus, contact) && contact?.phone) {
      this.openPhone(contact.phone);
    } else {
      void this.toast.showInfo(this.getUnavailableReason(tripStatus));
    }
  }

  // Texto accesible para el botón
  callLabel(contact: ChatContact | null | undefined, fallbackName?: string): string {
    const name = contact?.name ?? fallbackName;
    if (!name) {
      return this.transloco?.translate('common.tripCall.call') ?? 'Llamar';
    }
    return this.transloco?.translate('common.tripCall.callTo', { name }) ?? `Llamar a ${name}`;
  }
}
