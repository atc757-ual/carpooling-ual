import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { provideTestingTransloco } from '../../../core/i18n/testing-transloco';
import { ApiError } from '../../../core/models/api-error.model';
import { HelpAudience, HelpFaq, HelpTopic } from '../../../core/models/faq.model';
import { FaqsService } from '../../../core/services/help/faqs.service';
import { HelpAudienceService } from '../../../core/services/help/help-audience.service';
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

  async function render(): Promise<ComponentFixture<HelpCenterPage>> {
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
