import { inject, Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { translate } from '@jsverse/transloco';

export const APP_TITLE = 'Carpooling UAL';

// El título de la pestaña: el `title` de una ruta es una clave de traducción
// («Documentos actualizados · Carpooling UAL»). Sin `title`, el nombre de la
// app, para que no se quede el de la pantalla anterior
@Injectable({ providedIn: 'root' })
export class TranslatedTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const key = this.buildTitle(snapshot);
    this.title.setTitle(key ? `${translate(key)} · ${APP_TITLE}` : APP_TITLE);
  }
}
