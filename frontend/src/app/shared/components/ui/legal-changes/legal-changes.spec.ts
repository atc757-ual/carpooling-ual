import { TestBed } from '@angular/core/testing';
import { LegalChanges } from './legal-changes';

describe('LegalChanges', () => {
  function render(summary: string | null): HTMLElement {
    const fixture = TestBed.createComponent(LegalChanges);
    fixture.componentRef.setInput('heading', 'Qué ha cambiado en la versión 2.0');
    fixture.componentRef.setInput('summary', summary);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows what changed above the document', () => {
    const notice = render('Nuevas normas de convivencia.').querySelector('.notice--info');

    expect(notice?.querySelector('b')?.textContent).toBe('Qué ha cambiado en la versión 2.0');
    expect(notice?.textContent).toContain('Nuevas normas de convivencia.');
  });

  it('shows nothing without a summary', () => {
    expect(render(null).querySelector('.legal-changes')).toBeNull();
  });
});
