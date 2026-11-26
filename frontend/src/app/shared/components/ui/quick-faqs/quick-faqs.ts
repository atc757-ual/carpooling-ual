import { Component, computed, inject, input, output, resource } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { IonButton, IonCard, IonSkeletonText } from '@ionic/angular';
import { TRANSLOCO_TRANSPILER, TranslocoService } from '@jsverse/transloco';
import { EMPTY } from 'rxjs';
import { FaqContext } from '../../../../core/models/admin-faq.model';
import { FaqLang, HelpAudience } from '../../../../core/models/faq.model';
import { FaqsService } from '../../../../core/services/help/faqs.service';
import { ActiveModeService } from '../../../../core/services/users/active-mode.service';
import { FaqCard } from '../faq-card/faq-card';

export const HELP_CENTER_PATH = '/tabs/profile/help';
const SKELETON_ROWS = [1, 2, 3];
// Las preguntas de cada pantalla son de su papel, tenga el usuario ese
// perfil o no (quien solo es pasajero también mira Publicar): las de
// Publicar, de conductor, y las de Buscar, de pasajero. Ayuda y soporte
// sigue el modo con el que viaja
const CONTEXT_AUDIENCES: Partial<Record<FaqContext, HelpAudience>> = {
  search: 'passenger',
  publish: 'driver',
};

// Las preguntas rápidas de una pantalla (Buscar, Publicar o Ayuda y soporte):
// las que el panel marcó para ella, del modo activo del usuario (y las de los
// dos modos) y en su idioma, con «Ver más» hacia el centro de ayuda. Si no
// cargan, queda la tarjeta con el enlace
@Component({
  selector: 'app-quick-faqs',
  imports: [FaqCard, IonButton, IonCard, IonSkeletonText, RouterLink],
  templateUrl: './quick-faqs.html',
  styleUrl: './quick-faqs.scss',
})
export class QuickFaqs {
  private readonly faqsService = inject(FaqsService);
  private readonly activeMode = inject(ActiveModeService);
  private readonly transpiler = inject(TRANSLOCO_TRANSPILER, { optional: true });
  private readonly transloco = this.transpiler
    ? inject(TranslocoService, { optional: true })
    : null;
  private readonly activeLang = toSignal(this.transloco?.langChanges$ ?? EMPTY, {
    initialValue: this.transloco?.getActiveLang() ?? 'es',
  });
  private readonly translation = toSignal(this.transloco?.selectTranslation() ?? EMPTY);

  readonly context = input.required<FaqContext>();
  // Al pulsar «Ver más» (p. ej. para cerrar la ventana que lo contiene)
  readonly more = output<void>();

  readonly lang = computed<FaqLang>(() => (this.activeLang() === 'en' ? 'en' : 'es'));
  readonly faqs = resource({
    params: () => ({
      lang: this.lang(),
      audience: CONTEXT_AUDIENCES[this.context()] ?? this.activeMode.mode() ?? undefined,
      context: this.context(),
    }),
    loader: ({ params }) => this.faqsService.list(params),
  });
  readonly items = computed(() => (this.faqs.hasValue() ? this.faqs.value() : []));
  readonly isLoading = computed(() => this.faqs.isLoading() && !this.faqs.hasValue());
  // Ayuda y soporte abre en las preguntas del modo activo, como estas
  protected readonly moreLink = HELP_CENTER_PATH;
  readonly moreText = computed(() => this.text('common.faq.more', 'Ver todas las preguntas'));

  protected readonly skeletonRows = SKELETON_ROWS;

  // El texto traducido o, sin Transloco (tests de otras pantallas), el de
  // reserva en español
  private text(key: string, fallback: string): string {
    return (this.translation() ? this.transloco?.translate(key) : null) ?? fallback;
  }
}
