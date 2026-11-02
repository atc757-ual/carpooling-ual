import { computed, inject, Injectable, resource } from '@angular/core';
import {
  TRAVEL_PREFERENCE_GROUPS,
  TravelPreferenceGroup,
  TravelPreferences,
} from '../../models/travel-preferences.model';
import { LanguageService } from '../ui/language.service';
import { CatalogsService, TravelPreferenceOptionItem } from './catalogs.service';

// Opciones de las preferencias de viaje del catálogo (las gestiona el panel):
// sus textos en el idioma de la app y cuáles se ofrecen. Se piden al crearse;
// hasta que llegan (o si fallan), las preferencias salen sin texto
@Injectable({ providedIn: 'root' })
export class TravelPreferencesStore {
  private readonly catalogs = inject(CatalogsService);
  private readonly language = inject(LanguageService);
  private readonly catalog = resource({
    loader: () => this.catalogs.travelPreferenceOptions(),
  });
  private readonly options = computed<readonly TravelPreferenceOptionItem[]>(() =>
    this.catalog.hasValue() ? this.catalog.value() : [],
  );

  // El texto de una opción en el idioma de la app; si aún no ha llegado, nada
  label(preference: keyof TravelPreferences, value: string | null): string | null {
    const option = this.options().find(
      (candidate) => candidate.preference === preference && candidate.value === value,
    );
    if (!option) {
      return null;
    }
    return this.language.currentLanguage() === 'en' ? option.nameEn : option.name;
  }

  // Los textos de las preferencias elegidas, en el orden de los grupos
  format(preferences: TravelPreferences | null | undefined): string[] {
    return TRAVEL_PREFERENCE_GROUPS.flatMap(({ key }) => {
      const label = this.label(key, preferences?.[key] ?? null);
      return label === null ? [] : [label];
    });
  }

  // Los grupos con sus opciones para elegir: las que se ofrecen y, si quien
  // edita tiene una que ya no, también esa (la conserva)
  groupsFor(current: TravelPreferences | null | undefined): TravelPreferenceGroup[] {
    return TRAVEL_PREFERENCE_GROUPS.map(({ key, title }) => ({
      key,
      title,
      options: this.options()
        .filter(
          (option) =>
            option.preference === key && (option.isActive || option.value === current?.[key]),
        )
        .map((option) => ({ value: option.value, label: this.label(key, option.value) ?? '' })),
    }));
  }
}
