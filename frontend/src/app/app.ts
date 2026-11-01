import { Component, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationStart, Router } from '@angular/router';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { filter } from 'rxjs';
import { ThemeService } from './core/services/ui/theme.service';

// Raíz de la aplicación: el contenedor de Ionic y el router, donde se cargan
// las pantallas de cada ruta (app.routes.ts)
@Component({
  selector: 'app-root',
  imports: [IonApp, IonRouterOutlet],
  templateUrl: './app.html',
})
export class App implements OnInit {
  private readonly theme = inject(ThemeService);

  constructor() {
    // Al cambiar de pantalla se quita el foco (p. ej. de la flecha «Volver»):
    // Ionic oculta la pantalla que se va con aria-hidden y el navegador avisa
    // si el foco se queda dentro de algo oculto para los lectores de pantalla
    inject(Router)
      .events.pipe(
        filter((event) => event instanceof NavigationStart),
        takeUntilDestroyed(),
      )
      .subscribe(() => (document.activeElement as HTMLElement | null)?.blur());
  }

  // El modo claro u oscuro que eligió el usuario en Perfil, si eligió alguno
  ngOnInit(): void {
    void this.theme.restore();
  }
}
