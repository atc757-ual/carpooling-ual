import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { SearchFaq } from './search-faq';

describe('SearchFaq', () => {
  it('lists the frequent questions in an accordion', () => {
    TestBed.configureTestingModule({ imports: [SearchFaq], providers: [provideIonicAngular()] });
    const fixture = TestBed.createComponent(SearchFaq);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelectorAll('ion-accordion').length).toBe(6);
    expect(root.textContent).toContain('¿Qué es el margen horario?');
  });
});
