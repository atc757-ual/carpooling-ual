import { translate } from '@jsverse/transloco';
import { computed, inject, Injectable, resource } from '@angular/core';
import { LanguageService } from '../ui/language.service';
import { ThemeService } from '../ui/theme.service';
import { CatalogsService, VehicleColorItem } from './catalogs.service';

// Colores del vehículo del catálogo (los gestiona el panel), siempre a mano
// para nombrar y pintar el de cada vehículo. Se piden al crearse; hasta que
// llegan (o si fallan), los vehículos salen sin color
@Injectable({ providedIn: 'root' })
export class VehicleColorsStore {
  private readonly theme = inject(ThemeService);
  private readonly catalogs = inject(CatalogsService);
  private readonly language = inject(LanguageService);
  // Si fallan, el recurso guarda el error y no hay colores
  private readonly catalog = resource({ loader: () => this.catalogs.vehicleColors() });
  private readonly colors = computed<readonly VehicleColorItem[]>(() =>
    this.catalog.hasValue() ? this.catalog.value() : [],
  );
  private readonly byKey = computed(
    () => new Map(this.colors().map((color) => [color.key, color])),
  );

  // Los que se pueden elegir, en su orden
  readonly offered = computed(() => this.colors().filter(({ isActive }) => isActive));

  // «Azul» (o «Blue», en el idioma de la app); sin color, «Color sin
  // indicar»; uno que aún no ha llegado, nada
  label(key: string | null): string {
    if (key === null) {
      return translate('screens.vehicleColors.colorSinIndicar');
    }
    const color = this.byKey().get(key);
    if (!color) {
      return '';
    }
    return this.language.currentLanguage() === 'en' ? color.nameEn : color.name;
  }

  // El tono del tema activo
  swatch(key: string | null): string {
    const color = key === null ? undefined : this.byKey().get(key);
    if (!color) {
      return 'transparent';
    }
    return this.theme.isDark() ? color.hexDark : color.hexLight;
  }
}
