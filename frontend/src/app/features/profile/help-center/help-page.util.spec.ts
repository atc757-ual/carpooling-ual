import { Component, TemplateRef, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { Subject } from 'rxjs';
import { HeadingContentService } from '../../../core/services/ui/heading-content.service';
import { injectFaqLang, showHeadingWhileVisible } from './help-page.util';

@Component({
  template: '<ng-template #tpl>Help Heading</ng-template>',
})
class TestHelpComponent {
  readonly tpl = viewChild.required<TemplateRef<unknown>>('tpl');
  readonly heading = showHeadingWhileVisible(this.tpl);
  readonly lang = injectFaqLang();
}

describe('help-page.util', () => {
  let routerEvents$: Subject<unknown>;
  let headingContent: { show: ReturnType<typeof vi.fn>; clear: ReturnType<typeof vi.fn> };
  let langChanges$: Subject<string>;
  let activeLang: string;

  beforeEach(() => {
    routerEvents$ = new Subject();
    langChanges$ = new Subject();
    activeLang = 'es';
    headingContent = {
      show: vi.fn(),
      clear: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [TestHelpComponent],
      providers: [
        {
          provide: Router,
          useValue: {
            events: routerEvents$.asObservable(),
          },
        },
        {
          provide: HeadingContentService,
          useValue: headingContent,
        },
        {
          provide: TranslocoService,
          useValue: {
            langChanges$: langChanges$.asObservable(),
            getActiveLang: () => activeLang,
          },
        },
      ],
    });
  });

  it('manages heading visibility on lifecycle and navigation', () => {
    const fixture = TestBed.createComponent(TestHelpComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const template = component.tpl();

    expect(headingContent.show).toHaveBeenCalledWith(template);

    // leave() hides
    component.heading.leave();
    expect(headingContent.clear).toHaveBeenCalledWith(template);

    // enter() shows
    component.heading.enter();
    expect(headingContent.show).toHaveBeenCalledWith(template);

    // Navigation outside help clears heading
    routerEvents$.next(new NavigationEnd(1, '/tabs/search', '/tabs/search'));
    expect(headingContent.clear).toHaveBeenCalledWith(template);

    // Navigation within help shows heading
    component.heading.enter();
    routerEvents$.next(
      new NavigationEnd(2, '/tabs/profile/help/faq/1', '/tabs/profile/help/faq/1'),
    );
    expect(headingContent.show).toHaveBeenCalledWith(template);

    // Destroy clears
    fixture.destroy();
    expect(headingContent.clear).toHaveBeenCalledWith(template);
  });

  it('injects the FAQ language according to transloco active language', () => {
    const fixture = TestBed.createComponent(TestHelpComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.lang()).toBe('es');

    activeLang = 'en';
    langChanges$.next('en');
    expect(component.lang()).toBe('en');

    activeLang = 'fr';
    langChanges$.next('fr');
    expect(component.lang()).toBe('es');
  });
});
