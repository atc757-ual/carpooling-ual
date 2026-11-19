import { Location } from '@angular/common';
import { DestroyRef, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { NavController } from '@ionic/angular';
import { filter } from 'rxjs';

// Cuántas pantallas de la app hay detrás de la actual en el historial, para
// que «volver» lleve a la anterior (p. ej. de un viaje abierto desde Buscar,
// otra vez a Buscar) y no siempre a la sección de la ruta. Sin ninguna detrás
// (se entró por un enlace o una push), a la que diga la ruta
@Injectable({ providedIn: 'root' })
export class NavigationHistoryService {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly navController = inject(NavController);
  private depth = 0;
  private isStarted = false;

  constructor() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(() => this.track());
  }

  get canGoBack(): boolean {
    return this.depth > 0;
  }

  // A la pantalla anterior si la hay; si no, a fallbackUrl
  back(fallbackUrl: string): void {
    if (this.canGoBack) {
      this.location.back();
      return;
    }
    void this.navController.navigateBack(fallbackUrl);
  }

  private track(): void {
    const navigation = this.router.lastSuccessfulNavigation();
    // La primera pantalla no tiene ninguna de la app detrás
    if (!this.isStarted) {
      this.isStarted = true;
      return;
    }
    if (navigation?.trigger === 'popstate') {
      this.depth = Math.max(0, this.depth - 1);
    } else if (!navigation?.extras.replaceUrl) {
      this.depth += 1;
    }
  }
}
