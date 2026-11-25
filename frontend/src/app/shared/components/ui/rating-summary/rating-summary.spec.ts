import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { provideAppTransloco } from '../../../../core/i18n/testing-transloco';
import { DriverRating } from '../../../../core/models/driver-review.model';
import { barLabel, formatReviewCount, RatingSummary } from './rating-summary';

const RATING: DriverRating = {
  average: 4.4,
  count: 5,
  distribution: [
    { rating: 5, count: 3 },
    { rating: 4, count: 1 },
    { rating: 3, count: 1 },
    { rating: 2, count: 0 },
    { rating: 1, count: 0 },
  ],
};

describe('RatingSummary', () => {
  function render(rating: DriverRating): { root: HTMLElement; component: RatingSummary } {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [RatingSummary],
      providers: [provideAppTransloco(), provideIonicAngular()],
    });
    const fixture = TestBed.createComponent(RatingSummary);
    fixture.componentRef.setInput('rating', rating);
    fixture.detectChanges();
    return { root: fixture.nativeElement as HTMLElement, component: fixture.componentInstance };
  }

  it('shows the average, how many reviews and a bar per rating', () => {
    const { root, component } = render(RATING);

    expect(root.querySelector('.rating-summary__value')?.textContent).toBe('4,4');
    expect(root.querySelector('.rating-summary__thumb--up')).not.toBeNull();
    expect(root.textContent).toContain('5 valoraciones');
    const bars = root.querySelectorAll('.rating-summary__bar');
    expect(bars).toHaveLength(5);
    expect(bars[0].getAttribute('aria-label')).toBe('5 de 5: 3');
    expect(component.bars()[0]).toMatchObject({ label: '5 · Muy bien', percent: 60 });
    // Cada barra con el color de su nota (de verde a rojo)
    const fills = root.querySelectorAll('.rating-summary__fill');
    expect(fills[0].className).toBe('rating-summary__fill rating-summary__fill--5');
    expect(fills[4].classList).toContain('rating-summary__fill--1');
  });

  it('turns the thumb down below 3 and shows nothing without an average', () => {
    const low = render({ ...RATING, average: 2.5 }).root;
    expect(low.querySelector('.rating-summary__thumb--down')).not.toBeNull();
    const { root } = render({ average: null, count: 0, distribution: [] });
    expect(root.querySelector('.rating-summary')).toBeNull();
  });
});

describe('formatReviewCount', () => {
  it('speaks of one or many reviews', () => {
    expect(formatReviewCount(1)).toBe('1 valoración');
    expect(formatReviewCount(15)).toBe('15 valoraciones');
  });
});

describe('barLabel', () => {
  it('names only the ends of the scale', () => {
    expect(barLabel(5)).toBe('5 · Muy bien');
    expect(barLabel(3)).toBe('3');
    expect(barLabel(1)).toBe('1 · Muy mal');
  });
});
