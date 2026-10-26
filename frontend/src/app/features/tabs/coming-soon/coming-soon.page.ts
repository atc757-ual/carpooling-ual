import { Component, input } from '@angular/core';
import { IonContent } from '@ionic/angular';

// Pestaña aún sin pantalla (Mis viajes, Buscar, Publicar, Avisos): su título y
// qué se podrá hacer en ella. Los dos textos vienen en el data de la ruta
// (withComponentInputBinding). Cada una se sustituye por su pantalla en su PR
@Component({
  selector: 'app-coming-soon',
  imports: [IonContent],
  template: `
    <ion-content>
      <section class="tab-page">
        <h1 class="text-title">{{ title() }}</h1>
        <p class="text-body text-color-muted">{{ description() }}</p>
      </section>
    </ion-content>
  `,
  styleUrl: '../tab-page.scss',
})
export class ComingSoonPage {
  readonly title = input.required<string>();
  readonly description = input.required<string>();
}
