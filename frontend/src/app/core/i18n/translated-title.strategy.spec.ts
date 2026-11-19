import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter, Router, TitleStrategy } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { provideAppTransloco } from './testing-transloco';
import { TranslatedTitleStrategy } from './translated-title.strategy';

@Component({ template: '' })
class EmptyPage {}

describe('TranslatedTitleStrategy', () => {
  function setUp(): { router: Router; title: Title } {
    TestBed.configureTestingModule({
      providers: [
        provideAppTransloco(),
        provideRouter([
          { path: 'legal-update', title: 'routes.pageTitles.legalUpdate', component: EmptyPage },
          { path: 'tabs', component: EmptyPage },
        ]),
        { provide: TitleStrategy, useClass: TranslatedTitleStrategy },
      ],
    });
    return { router: TestBed.inject(Router), title: TestBed.inject(Title) };
  }

  it('translates the route title and adds the app name', async () => {
    const { router, title } = setUp();

    await router.navigateByUrl('/legal-update');

    expect(title.getTitle()).toBe('Documentos actualizados · Carpooling UAL');
  });

  it('uses the active language', async () => {
    const { router, title } = setUp();
    TestBed.inject(TranslocoService).setActiveLang('en');

    await router.navigateByUrl('/legal-update');

    expect(title.getTitle()).toBe('Updated documents · Carpooling UAL');
  });

  it('goes back to the app name on a route without title', async () => {
    const { router, title } = setUp();

    await router.navigateByUrl('/legal-update');
    await router.navigateByUrl('/tabs');

    expect(title.getTitle()).toBe('Carpooling UAL');
  });
});
