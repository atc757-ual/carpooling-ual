import { inject, Injectable } from '@angular/core';
import { PreferencesPlugin } from '../../plugins/preferences-plugin';
import { AuthService } from '../auth/auth.service';

const PUBLISH_DRAFT_KEY = 'trips.publish-draft';
// Un borrador más antiguo ya no sirve (la fecha y la hora habrán pasado)
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// El viaje a medio publicar: los campos del formulario y el paso al que se
// llegó
export interface PublishDraft {
  savedAt: string;
  step: number;
  value: Record<string, unknown>;
}

// El viaje a medio rellenar en Publicar, guardado solo en este dispositivo
// (Capacitor Preferences): sigue ahí al recargar, cerrar la pestaña o la app.
// Se borra al publicarlo, al descartarlo y al cerrar sesión (en un
// dispositivo compartido no se queda la dirección de nadie), como «Mi
// trayecto habitual»
@Injectable({ providedIn: 'root' })
export class PublishDraftService {
  private readonly preferences = inject(PreferencesPlugin);

  constructor() {
    inject(AuthService).onBeforeLogout(() => this.remove());
  }

  async load(now = new Date()): Promise<PublishDraft | null> {
    const stored = await this.preferences.get(PUBLISH_DRAFT_KEY);
    const draft = stored ? parseDraft(stored) : null;
    if (draft === null || now.getTime() - Date.parse(draft.savedAt) > MAX_AGE_MS) {
      if (stored) {
        await this.remove();
      }
      return null;
    }
    return draft;
  }

  async save(draft: PublishDraft): Promise<void> {
    await this.preferences.set(PUBLISH_DRAFT_KEY, JSON.stringify(draft));
  }

  async remove(): Promise<void> {
    await this.preferences.remove(PUBLISH_DRAFT_KEY);
  }
}

function parseDraft(text: string): PublishDraft | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return null;
    }
    throw error;
  }
  const draft = parsed as Partial<PublishDraft> | null;
  const isValid =
    typeof draft?.savedAt === 'string' &&
    typeof draft.step === 'number' &&
    typeof draft.value === 'object' &&
    draft.value !== null;
  return isValid ? (draft as PublishDraft) : null;
}
