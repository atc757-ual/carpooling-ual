import { TestBed } from '@angular/core/testing';
import { RatingBar } from './rating-bar';

describe('RatingBar', () => {
  function render(rating: number, size: 'default' | 'small' = 'default'): HTMLElement {
    const fixture = TestBed.createComponent(RatingBar);
    fixture.componentRef.setInput('rating', rating);
    fixture.componentRef.setInput('size', size);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('fills the points up to the rating, the last one in part', () => {
    const root = render(3.5);
    const fills = [...root.querySelectorAll<HTMLElement>('.rating-bar__fill')].map(
      (fill) => fill.style.width,
    );

    expect(fills).toEqual(['100%', '100%', '100%', '50%', '0%']);
    expect(root.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('3,5 de 5');
  });

  it('keeps the rating between 0 and 5 and has a small size', () => {
    const root = render(7, 'small');
    const fills = [...root.querySelectorAll<HTMLElement>('.rating-bar__fill')];

    expect(fills.every((fill) => fill.style.width === '100%')).toBe(true);
    expect(root.querySelector('.rating-bar--small')).not.toBeNull();
    expect(render(-1).querySelector('.rating-bar__fill')?.getAttribute('style')).toContain('0%');
  });
});
