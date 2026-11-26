import {
  Component,
  computed,
  inject,
  input,
  resource,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonBreadcrumb,
  IonBreadcrumbs,
  IonButton,
  IonCard,
  IonContent,
  IonIcon,
  IonSkeletonText,
} from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiError } from '../../../../core/models/api-error.model';
import { FaqsService } from '../../../../core/services/help/faqs.service';
import { getErrorMessage } from '../../../../shared/utils/error-message.util';
import { HELP_CENTER_PATH, topicIcon } from '../help-center.util';
import { injectFaqLang, showHeadingWhileVisible } from '../help-page.util';
import { HelpSupportCard } from '../help-support-card/help-support-card';
import { localizedComputed } from '../../../../core/i18n/localized-computed';

const SKELETON_ROWS = [1, 2, 3];

// Una pregunta de «Ayuda y soporte» (/tabs/profile/help/:id): su categoría
// en la franja fija y, debajo, la pregunta y su respuesta en una tarjeta; a
// un lado, el acceso a soporte
@Component({
  selector: 'app-help-faq-page',
  imports: [
    HelpSupportCard,
    IonBreadcrumb,
    IonBreadcrumbs,
    IonButton,
    IonCard,
    IonContent,
    IonIcon,
    IonSkeletonText,
    RouterLink,
    TranslocoPipe,
  ],
  templateUrl: './help-faq.page.html',
  styleUrls: ['../../../tabs/tab-page.scss', '../help-shared.scss', './help-faq.page.scss'],
})
export class HelpFaqPage {
  private readonly faqsService = inject(FaqsService);

  // El id de la ruta (withComponentInputBinding)
  readonly id = input.required<string>();

  private readonly helpHeading = viewChild.required<TemplateRef<unknown>>('helpHeading');
  private readonly heading = showHeadingWhileVisible(this.helpHeading);
  readonly lang = injectFaqLang();

  readonly faq = resource({
    params: () => ({ id: this.id(), lang: this.lang() }),
    loader: ({ params }) => this.faqsService.get(params.id, params.lang),
  });
  // Para el nombre y el icono del tema
  readonly topics = resource({
    params: () => this.lang(),
    loader: ({ params }) => this.faqsService.listTopics(params),
  });

  readonly current = computed(() => (this.faq.hasValue() ? this.faq.value() : null));
  readonly topic = computed(() => {
    const faq = this.current();
    const topics = this.topics.hasValue() ? this.topics.value() : [];
    const found = faq ? topics.find((item) => item.key === faq.topic) : undefined;
    return found ? { name: found.name, icon: topicIcon(found.icon) } : null;
  });
  readonly isLoading = computed(() => this.faq.isLoading() && !this.faq.hasValue());
  readonly errorMessage = localizedComputed(() => {
    const error = this.faq.error();
    return error ? getErrorMessage(ApiError.fromHttpError(error)) : null;
  });

  protected readonly helpCenterPath = HELP_CENTER_PATH;
  protected readonly skeletonRows = SKELETON_ROWS;

  ionViewDidEnter(): void {
    this.heading.enter();
  }

  ionViewWillLeave(): void {
    this.heading.leave();
  }

  handleRetry(): void {
    this.faq.reload();
    this.topics.reload();
  }
}
