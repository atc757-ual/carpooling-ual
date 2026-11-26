import { Injectable, signal } from '@angular/core';

// Si en Publicar hay un viaje a medio rellenar (sin publicar). Lo mantiene la
// pantalla de Publicar; lo lee la confirmación de cerrar sesión para avisar
// de que se perderá (al cambiar de pestaña no se pierde: Ionic la guarda)
@Injectable({ providedIn: 'root' })
export class PublishDraftService {
  readonly hasUnsavedTrip = signal(false);
}
