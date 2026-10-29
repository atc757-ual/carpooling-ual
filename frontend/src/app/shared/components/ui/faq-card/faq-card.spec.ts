import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { Faq, FaqCard } from './faq-card';

const FAQS: readonly Faq[] = [
  { question: '¿Qué es el margen horario?', answer: 'Cuánto antes o después te viene bien.' },
  {
    question: '¿Qué pasa si cancelo?',
    answer: 'Depende del momento:',
    points: ['Sin pasajeros: sin más.', 'A menos de 30 minutos: penalización.'],
  },
];

describe('FaqCard', () => {
  function render(): HTMLElement {
    TestBed.configureTestingModule({ imports: [FaqCard], providers: [provideIonicAngular()] });
    const fixture = TestBed.createComponent(FaqCard);
    fixture.componentRef.setInput('faqs', FAQS);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('lists the questions it receives in an accordion', () => {
    const root = render();

    expect(root.querySelectorAll('ion-accordion').length).toBe(2);
    expect(root.textContent).toContain('¿Qué es el margen horario?');
  });

  it('adds the list of cases after the answer when there is one', () => {
    const root = render();

    const points = root.querySelectorAll('.faq-card__points li');
    expect(points.length).toBe(2);
    expect(points[1].textContent).toContain('penalización');
  });
});
