import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { provideTestingTransloco } from '../../../../core/i18n/testing-transloco';
import { ApiError } from '../../../../core/models/api-error.model';
import { HelpFaq } from '../../../../core/models/faq.model';
import { FaqsService } from '../../../../core/services/help/faqs.service';
import { HeadingContentService } from '../../../../core/services/ui/heading-content.service';
import { HeadingHost } from '../heading-host.testing';
import { HelpFaqPage } from './help-faq.page';

const FAQ: HelpFaq = {
  id: 'cancel',
  topic: 'cancellations',
  audience: 'passenger',
  quickContexts: [],
  question: '¿Puedo cancelar mi plaza?',
  answer: 'Sí, desde Tus viajes, y depende del momento:',
  points: ['Hasta 10 minutos antes: sin penalización.', 'Después: cancelación tardía.'],
};

// Deja que se resuelvan las cargas y se pinte lo nuevo
async function settle(fixture: ComponentFixture<HelpFaqPage>): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
  await fixture.whenStable();
  fixture.detectChanges();
}

describe('HelpFaqPage', () => {
  let get: ReturnType<typeof vi.fn>;

  async function render(): Promise<ComponentFixture<HelpFaqPage>> {
    get = vi.fn().mockResolvedValue(FAQ);
    TestBed.configureTestingModule({
      imports: [HelpFaqPage],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        provideTestingTransloco(),
        {
          provide: FaqsService,
          useValue: {
            get,
            listTopics: vi.fn().mockResolvedValue([
              {
                id: 't1',
                key: 'cancellations',
                name: 'Cancelaciones y penalizaciones',
                icon: 'close-circle-outline',
              },
            ]),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(HelpFaqPage);
    fixture.componentRef.setInput('id', 'cancel');
    await settle(fixture);
    return fixture;
  }

  it('shows the category, the question and its answer with the cases', async () => {
    const root = (await render()).nativeElement as HTMLElement;

    expect(get).toHaveBeenCalledWith('cancel', 'es');
    expect(root.querySelector('.help-answer__topic')?.textContent).toContain(
      'Cancelaciones y penalizaciones',
    );
    expect(root.querySelector('.help-answer__question')?.textContent).toContain(
      '¿Puedo cancelar mi plaza?',
    );
    expect(root.querySelectorAll('.help-answer__points li')).toHaveLength(2);
  });

  it('puts its heading in the fixed strip while it is seen', async () => {
    const fixture = await render();
    const headingContent = TestBed.inject(HeadingContentService);

    const host = TestBed.createComponent(HeadingHost);
    host.detectChanges();
    const heading = host.nativeElement as HTMLElement;
    expect(heading.querySelector('.help-heading__title')?.textContent).toContain('Pregunta');
    // Ayuda y soporte / Pregunta: Ayuda ya no cuelga de Mi perfil
    const crumbs = [...heading.querySelectorAll('ion-breadcrumb')].map((crumb) =>
      crumb.textContent?.trim(),
    );
    expect(crumbs).toEqual(['Ayuda y soporte', 'Pregunta']);

    fixture.componentInstance.ionViewWillLeave();
    fixture.componentInstance.ionViewDidEnter();
    expect(headingContent.content()).not.toBeNull();
  });

  it('shows the error when the question is not there and tries again', async () => {
    const fixture = await render();
    get.mockRejectedValueOnce(new ApiError('FAQ_NOT_FOUND', 404));

    fixture.componentInstance.handleRetry();
    await settle(fixture);

    expect(fixture.componentInstance.errorMessage()).toBeTruthy();
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')).not.toBeNull();
  });
});
