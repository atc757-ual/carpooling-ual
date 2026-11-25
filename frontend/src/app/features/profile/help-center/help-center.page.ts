import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  computed,
  inject,
  resource,
  signal,
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
  IonItem,
  IonLabel,
  IonList,
  IonSearchbar,
  IonSkeletonText,
} from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiError } from '../../../core/models/api-error.model';
import { FaqsService, MIN_FAQ_SEARCH_LENGTH } from '../../../core/services/help/faqs.service';
import { HelpAudienceService } from '../../../core/services/help/help-audience.service';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { groupByTopic, HELP_CENTER_PATH } from './help-center.util';
import { injectFaqLang, showHeadingWhileVisible } from './help-page.util';
import { HelpAudiencePicker } from './help-audience-picker/help-audience-picker';
import { HelpSupportCard } from './help-support-card/help-support-card';
import { HelpIncidentsCard } from './help-incidents/help-incidents-card';
import {
  injectHelpIncidentLink,
  injectHelpIncidentsPriority,
} from './help-incidents/help-incidents-priority';

const SKELETON_ROWS = [1, 2, 3, 4];
// Las que caben en el desplegable del buscador
const MAX_SEARCH_ITEMS = 8;

// «Ayuda y soporte»: el buscador en la franja fija, que despliega las
// preguntas que coinciden (de pasajero y de conductor), y una tarjeta grande
// con las pestañas Pasajero / Conductor y una tarjeta por tema con sus
// preguntas (las de la pestaña elegida y las de los dos); cada una abre su
// pantalla con la respuesta
@Component({
  selector: 'app-help-center-page',
  imports: [
    HelpAudiencePicker,
    HelpSupportCard,
    HelpIncidentsCard,
    IonBreadcrumb,
    IonBreadcrumbs,
    IonButton,
    IonCard,
    IonContent,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonSearchbar,
    IonSkeletonText,
    NgTemplateOutlet,
    RouterLink,
    TranslocoPipe,
  ],
  templateUrl: './help-center.page.html',
  styleUrls: ['../../tabs/tab-page.scss', './help-shared.scss'],
})
export class HelpCenterPage {
  private readonly faqsService = inject(FaqsService);

  private readonly helpHeading = viewChild.required<TemplateRef<unknown>>('helpHeading');
  private readonly heading = showHeadingWhileVisible(this.helpHeading);
  readonly lang = injectFaqLang();
  readonly audience = inject(HelpAudienceService).audience;
  readonly search = signal('');
  private readonly isSearchFocused = signal(false);
  readonly isSearching = computed(() => this.search().trim().length >= MIN_FAQ_SEARCH_LENGTH);
  // El desplegable: con texto que buscar y sin haberlo cerrado
  readonly isSearchOpen = computed(() => this.isSearchFocused() && this.isSearching());

  readonly topics = resource({
    params: () => this.lang(),
    loader: ({ params }) => this.faqsService.listTopics(params),
  });
  // Todas (son pocas): cambiar de pestaña no vuelve a pedir nada
  readonly faqs = resource({
    params: () => ({ lang: this.lang() }),
    loader: ({ params }) => this.faqsService.list(params),
  });
  // Sin texto que buscar no se pide nada
  readonly results = resource({
    params: () => (this.isSearching() ? { lang: this.lang(), q: this.search() } : undefined),
    loader: ({ params }) => this.faqsService.list(params),
  });

  private readonly topicList = computed(() => (this.topics.hasValue() ? this.topics.value() : []));
  // Los temas con preguntas para la pestaña elegida, en su orden
  readonly sections = computed(() =>
    groupByTopic(
      this.topicList(),
      (this.faqs.hasValue() ? this.faqs.value() : []).filter(
        (faq) => faq.audience === 'both' || faq.audience === this.audience(),
      ),
    ),
  );
  // Las del desplegable: solo la pregunta, sin su tema
  readonly searchItems = computed(() => {
    return (this.results.hasValue() ? this.results.value() : [])
      .slice(0, MAX_SEARCH_ITEMS)
      .map((faq) => ({ id: faq.id, question: faq.question }));
  });
  readonly isSearchLoading = computed(() => this.results.isLoading() && !this.results.hasValue());
  readonly isLoading = computed(
    () =>
      (this.topics.isLoading() && !this.topics.hasValue()) ||
      (this.faqs.isLoading() && !this.faqs.hasValue()),
  );
  readonly errorMessage = computed(() => {
    const error = this.topics.error() ?? this.faqs.error() ?? this.results.error();
    return error ? getErrorMessage(ApiError.fromHttpError(error)) : null;
  });

  protected readonly helpCenterPath = HELP_CENTER_PATH;
  protected readonly skeletonRows = SKELETON_ROWS;

  // Con incidencias activas o atendidas hace poco, la columna de contacto
  // (con «Tus incidencias» arriba) va primero; desde un aviso, su ventana
  readonly incidents = injectHelpIncidentsPriority();
  private readonly openIncidentLink = injectHelpIncidentLink();

  ionViewDidEnter(): void {
    this.heading.enter();
    void this.openIncidentLink();
  }

  // Al ir a una pregunta, el desplegable se cierra pero lo buscado se queda:
  // a la vuelta, tocar el buscador vuelve a mostrar los resultados
  ionViewWillLeave(): void {
    this.heading.leave();
    this.handleCloseSearch();
  }

  handleSearch(value: string | null | undefined): void {
    this.search.set(value ?? '');
    this.isSearchFocused.set(true);
  }

  handleOpenSearch(): void {
    this.isSearchFocused.set(true);
  }

  handleCloseSearch(): void {
    this.isSearchFocused.set(false);
  }

  handleRetry(): void {
    this.topics.reload();
    this.faqs.reload();
    this.results.reload();
  }
}
