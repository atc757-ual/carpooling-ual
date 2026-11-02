import { TestBed } from '@angular/core/testing';
import { provideTestingTransloco } from '../../../../core/i18n/testing-transloco';
import { LanguageService } from '../../../../core/services/ui/language.service';
import { LanguageSwitch } from './language-switch';

describe('LanguageSwitch', () => {
  function render(): HTMLElement {
    TestBed.configureTestingModule({
      imports: [LanguageSwitch],
      providers: [provideTestingTransloco()],
    });
    TestBed.inject(LanguageService).setLanguage('es');
    const fixture = TestBed.createComponent(LanguageSwitch);
    fixture.componentRef.setInput('label', 'Idioma de la app');
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function options(root: HTMLElement): HTMLButtonElement[] {
    return Array.from(root.querySelectorAll('button'));
  }

  it('shows each language with its code and its own name', () => {
    const root = render();

    expect(root.querySelector('fieldset')?.getAttribute('aria-label')).toBe('Idioma de la app');
    expect(options(root).map((button) => button.textContent?.trim())).toEqual(['ES', 'EN']);
    expect(options(root).map((button) => button.getAttribute('aria-label'))).toEqual([
      'Español',
      'English',
    ]);
    expect(options(root)[0].getAttribute('aria-pressed')).toBe('true');
  });

  it('changes the language when another one is chosen', () => {
    const root = render();

    options(root)[1].click();
    TestBed.tick();

    expect(TestBed.inject(LanguageService).currentLanguage()).toBe('en');
    expect(options(root)[1].classList).toContain('language-switch__option--active');
    expect(options(root)[0].getAttribute('aria-pressed')).toBe('false');
  });
});
