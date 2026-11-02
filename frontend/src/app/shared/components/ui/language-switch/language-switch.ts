import { Component, inject, input } from '@angular/core';
import { AppLanguage, LanguageService } from '../../../../core/services/ui/language.service';

// Cada idioma con su nombre en ese idioma (así se reconoce aunque no se
// entienda el actual) y la bandera que lo acompaña, nunca sola
const LANGUAGES: readonly { id: AppLanguage; code: string; flag: string; name: string }[] = [
  { id: 'es', code: 'ES', flag: 'es', name: 'Español' },
  { id: 'en', code: 'EN', flag: 'gb', name: 'English' },
];

// Selector de idioma (guía, «Selección»): una pastilla con «ES | EN» y el
// activo en azul. Lo usan la bienvenida y el Perfil; cambia el idioma al
// momento con LanguageService
@Component({
  selector: 'app-language-switch',
  templateUrl: './language-switch.html',
  styleUrl: './language-switch.scss',
})
export class LanguageSwitch {
  private readonly languageService = inject(LanguageService);

  // Nombre accesible del grupo (p. ej. «Idioma de la app»)
  readonly label = input.required<string>();

  readonly current = this.languageService.currentLanguage;
  protected readonly languages = LANGUAGES;

  handleSelect(language: AppLanguage): void {
    this.languageService.setLanguage(language);
  }
}
