import { computed, DestroyRef, effect, inject, Signal, signal, TemplateRef } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { filter } from 'rxjs';
import { FaqLang } from '../../../core/models/faq.model';
import { HeadingContentService } from '../../../core/services/ui/heading-content.service';

export interface HeadingVisibility {
  // En ionViewDidEnter: la navegación limpia la franja y hay que volver a
  // ponerla (el effect no se repite si nada cambia)
  enter: () => void;
  // En ionViewWillLeave: deja de ponerla mientras la pantalla no se ve
  leave: () => void;
}

// Pone la plantilla de la pantalla en la franja fija del título mientras la
// pantalla se ve (como la cabecera de los detalles). Se llama al crear la
// pantalla, con su viewChild
export function showHeadingWhileVisible(template: Signal<TemplateRef<unknown>>): HeadingVisibility {
  const headingContent = inject(HeadingContentService);
  const router = inject(Router);
  const isVisible = signal(true);
  effect(() => {
    const current = template();
    if (isVisible()) {
      headingContent.show(current);
    } else {
      headingContent.clear(current);
    }
  });
  const destroyRef = inject(DestroyRef);
  destroyRef.onDestroy(() => headingContent.clear(template()));
  // Las pestañas limpian la franja en cada navegación (también al abrir la
  // app directamente en esta pantalla, después de crearla): se vuelve a poner
  // solo mientras la ruta siga perteneciendo a la ayuda.
  router.events
    .pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      takeUntilDestroyed(destroyRef),
    )
    .subscribe((event) => {
      const url = event.urlAfterRedirects || event.url;
      const isHelpRoute = url.startsWith('/tabs/profile/help');
      if (!isHelpRoute) {
        isVisible.set(false);
        headingContent.clear(template());
      } else if (isVisible()) {
        headingContent.show(template());
      }
    });
  return {
    enter: () => {
      isVisible.set(true);
      headingContent.show(template());
    },
    leave: () => {
      isVisible.set(false);
      headingContent.clear(template());
    },
  };
}

// El idioma de la app para pedir las preguntas (español si no es inglés)
export function injectFaqLang(): Signal<FaqLang> {
  const transloco = inject(TranslocoService);
  const activeLang = toSignal(transloco.langChanges$, {
    initialValue: transloco.getActiveLang(),
  });
  return computed(() => (activeLang() === 'en' ? 'en' : 'es'));
}
