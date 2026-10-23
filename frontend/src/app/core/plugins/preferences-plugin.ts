import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

// Almacenamiento clave-valor persistente con Capacitor Preferences: en el móvil,
// el almacenamiento nativo de la app (que el sistema no borra por falta de
// espacio, a diferencia del localStorage del WebView); en la web, localStorage.
// No cifra los datos. Como servicio, se sustituye fácilmente en los tests.
@Injectable({ providedIn: 'root' })
export class PreferencesPlugin {
  async get(key: string): Promise<string | null> {
    const { value } = await Preferences.get({ key });
    return value;
  }

  async set(key: string, value: string): Promise<void> {
    await Preferences.set({ key, value });
  }

  async remove(key: string): Promise<void> {
    await Preferences.remove({ key });
  }
}
