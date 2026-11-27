import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { provideTestingTransloco } from '../../../core/i18n/testing-transloco';
import { ApiError } from '../../../core/models/api-error.model';
import { HelpAudience, HelpFaq, HelpTopic } from '../../../core/models/faq.model';
import type { MyIncident } from '../../../core/models/my-incident.model';
import { FaqsService } from '../../../core/services/help/faqs.service';
import { HelpAudienceService } from '../../../core/services/help/help-audience.service';
import { IncidentsService } from '../../../core/services/incidents/incidents.service';
import { HeadingContentService } from '../../../core/services/ui/heading-content.service';
import { HeadingHost } from './heading-host.testing';
import { HelpCenterPage } from './help-center.page';

const TOPICS: HelpTopic[] = [
  { id: 't1', key: 'search', name: 'Buscar y pedir plaza', icon: 'ticket-outline' },
  { id: 't2', key: 'publish', name: 'Publicar y conducir', icon: 'car-outline' },
  { id: 't3', key: 'privacy', name: 'Privacidad y datos', icon: 'lock-closed-outline' },
];

function faq(id: string, topic: string, audience: HelpFaq['audience']): HelpFaq {
  return { id, topic, audience, quickContexts: [], question: `¿${id}?`, answer: id, points: [] };
}

const FAQS: HelpFaq[] = [
  faq('margen', 'search', 'passenger'),
  faq('plazas', 'publish', 'driver'),
  faq('datos', 'privacy', 'both'),
];

// Deja que se resuelvan las cargas y se pinte lo nuevo
async function settle(fixture: ComponentFixture<HelpCenterPage>): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
  await fixture.whenStable();
  fixture.detectChanges();
}

describe('HelpCenterPage', () => {
  let list: ReturnType<typeof vi.fn>;
  let listTopics: ReturnType<typeof vi.fn>;
  let audience: ReturnType<typeof signal<HelpAudience>>;
  let headingContent: HeadingContentService;

  async function render(
    myIncidents: Partial<MyIncident>[] = [],
  ): Promise<ComponentFixture<HelpCenterPage>> {
    list = vi.fn((query: { q?: string }) => Promise.resolve(query.q ? [FAQS[0], FAQS[2]] : FAQS));
    listTopics = vi.fn().mockResolvedValue(TOPICS);
    audience = signal<HelpAudience>('passenger');
    TestBed.configureTestingModule({
      imports: [HelpCenterPage],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        provideTestingTransloco(),
        { provide: FaqsService, useValue: { list, listTopics } },
        {
          provide: IncidentsService,
          useValue: {
            listMine: vi.fn().mockResolvedValue({ items: myIncidents, total: myIncidents.length }),
          },
        },
        {
          provide: HelpAudienceService,
          useValue: { audience, select: (value: HelpAudience) => audience.set(value) },
        },
      ],
    });
    headingContent = TestBed.inject(HeadingContentService);
    const fixture = TestBed.createComponent(HelpCenterPage);
    await settle(fixture);
    return fixture;
  }

  function topicNames(root: HTMLElement): string[] {
    return [...root.querySelectorAll('.help-topic-card__title')].map(
      (title) => title.textContent?.trim() ?? '',
    );
  }

  // El orden de los bloques en el HTML (el que lee el lector de pantalla)
  function blockOrder(root: HTMLElement): string[] {
    return [...root.querySelectorAll('.help-page__layout > *, .help-page__aside > *')]
      .map((element) => element.localName + '.' + (element.classList[0] ?? ''))
      .filter((name) => !name.startsWith('div.'));
  }

  // Una incidencia mía con lo que pinta «Tus incidencias»
  function myIncident(status: MyIncident['status']): Partial<MyIncident> {
    return {
      id: `i-${status}`,
      code: 'INC-0001',
      category: 'driver',
      reportedAt: '2026-11-01T08:00:00.000Z',
      status,
      review: null,
    };
  }

  it('keeps my old reviewed incidents at the end, with support, after the questions', async () => {
    const root = (await render([myIncident('reviewed')])).nativeElement as HTMLElement;

    expect(root.querySelector('.help-page__layout--incidents-first')).toBeNull();
    expect(blockOrder(root)).toEqual([
      'section.help-page__main',
      'aside.help-page__aside',
      'app-help-incidents-card.',
      'app-help-support-card.',
    ]);
  });

  it('puts only my incidents first, before the questions, with an active one', async () => {
    const root = (await render([myIncident('in_review')])).nativeElement as HTMLElement;

    expect(root.querySelector('.help-page__layout--incidents-first')).not.toBeNull();
    expect(blockOrder(root)).toEqual([
      'app-help-incidents-card.help-page__incidents',
      'section.help-page__main',
      'aside.help-page__aside',
      'app-help-support-card.',
    ]);
  });

  it('shows a card per topic with the questions of the chosen tab', async () => {
    const root = (await render()).nativeElement as HTMLElement;

    expect(topicNames(root)).toEqual(['Buscar y pedir plaza', 'Privacidad y datos']);
    const link = root.querySelector('.help-topic-card__item');
    expect(link?.getAttribute('href')).toBe('/tabs/profile/help/margen');
  });

  it('shows the driver topics when the tab changes, without asking again', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;

    audience.set('driver');
    await settle(fixture);

    expect(topicNames(root)).toEqual(['Publicar y conducir', 'Privacidad y datos']);
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('puts the search in the fixed heading', async () => {
    const fixture = await render();

    expect(headingContent.content()).not.toBeNull();
    fixture.componentInstance.ionViewWillLeave();
    fixture.componentInstance.ionViewDidEnter();
    expect(headingContent.content()).not.toBeNull();
  });

  it('opens the matching questions from two letters on and closes them', async () => {
    const fixture = await render();
    const page = fixture.componentInstance;

    page.handleSearch('p');
    await settle(fixture);
    expect(page.isSearchOpen()).toBe(false);

    page.handleSearch('plaza');
    await settle(fixture);
    expect(list).toHaveBeenLastCalledWith({ lang: 'es', q: 'plaza' });
    expect(page.isSearchOpen()).toBe(true);
    expect(page.searchItems()).toEqual([
      { id: 'margen', question: '¿margen?' },
      { id: 'datos', question: '¿datos?' },
    ]);

    page.handleCloseSearch();
    expect(page.isSearchOpen()).toBe(false);
    page.handleOpenSearch();
    expect(page.isSearchOpen()).toBe(true);
  });

  it('lists the matching questions under the search and closes them outside', async () => {
    const fixture = await render();
    const page = fixture.componentInstance;
    const host = TestBed.createComponent(HeadingHost);
    const heading = host.nativeElement as HTMLElement;

    page.handleSearch('plaza');
    await settle(fixture);
    host.detectChanges();

    const items = heading.querySelectorAll('.help-search__item');
    expect(items).toHaveLength(2);
    expect(items[0].getAttribute('href')).toBe('/tabs/profile/help/margen');
    // Solo la pregunta, sin el nombre de su tema
    expect(items[0].textContent?.trim()).toBe('¿margen?');

    heading.querySelector<HTMLElement>('.help-search__backdrop')?.click();
    host.detectChanges();
    expect(heading.querySelector('.help-search__panel')).toBeNull();
  });

  it('says so when no question matches', async () => {
    const fixture = await render();
    list.mockResolvedValue([]);
    const host = TestBed.createComponent(HeadingHost);

    fixture.componentInstance.handleSearch('nada');
    await settle(fixture);
    host.detectChanges();

    expect(
      (host.nativeElement as HTMLElement).querySelector('.help-search__status'),
    ).not.toBeNull();
  });

  it('keeps the search but closes its results when it leaves for a question', async () => {
    const fixture = await render();
    const page = fixture.componentInstance;
    page.handleSearch('plaza');

    page.ionViewWillLeave();

    expect(page.search()).toBe('plaza');
    expect(page.isSearchOpen()).toBe(false);
  });

  it('shows the error and tries again', async () => {
    const fixture = await render();
    const page = fixture.componentInstance;
    listTopics.mockRejectedValueOnce(new ApiError('SERVICE_UNAVAILABLE', 503));

    page.handleRetry();
    await settle(fixture);

    expect(page.errorMessage()).toBeTruthy();
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')).not.toBeNull();
  });
});
