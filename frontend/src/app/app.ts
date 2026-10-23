import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';

// Raíz de la aplicación: el contenedor de Ionic y el router, donde se cargan
// las pantallas de cada ruta (app.routes.ts)
@Component({
  selector: 'app-root',
  imports: [IonApp, IonRouterOutlet],
  templateUrl: './app.html',
})
export class App {}
