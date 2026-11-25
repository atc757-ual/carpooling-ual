import { TestBed } from '@angular/core/testing';
import { provideAppTransloco } from '../../../../core/i18n/testing-transloco';
import { Co2Source } from './co2-source';

describe('Co2Source', () => {
  function render(isOnBorder: boolean): HTMLElement {
    TestBed.configureTestingModule({
      imports: [Co2Source],
      providers: [provideAppTransloco()],
    });
    const fixture = TestBed.createComponent(Co2Source);
    fixture.componentRef.setInput('onBorder', isOnBorder);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('cites MITECO with its full name for screen readers', () => {
    const root = render(false);

    expect(root.textContent).toContain('Fuente: MITECO');
    expect(root.querySelector('abbr')?.title).toBe('Ministerio para la Transición Ecológica');
    expect(root.classList).not.toContain('co2-source--border');
  });

  it('sits on the border of the notice when asked', () => {
    expect(render(true).classList).toContain('co2-source--border');
  });
});
