import { Directive, inject } from '@angular/core';
import { IonContent } from '@ionic/angular';
import { CollapsingHeadingService } from '../../core/services/ui/collapsing-heading.service';

// En el ion-content de una lista larga (Buscar, Tus viajes, Mensajes,
// Notificaciones): avisa de cada desplazamiento para que la franja del título
// se esconda al bajar y vuelva al subir
@Directive({
  selector: 'ion-content[appCollapsingHeading]',
  host: { '(ionScroll)': 'handleScroll($event)' },
})
export class CollapsingHeading {
  private readonly heading = inject(CollapsingHeadingService);

  constructor() {
    // Ionic solo emite ionScroll si se le pide
    inject(IonContent, { self: true }).scrollEvents = true;
  }

  handleScroll(event: Event): void {
    this.heading.track((event as CustomEvent<{ scrollTop: number }>).detail.scrollTop);
  }
}
