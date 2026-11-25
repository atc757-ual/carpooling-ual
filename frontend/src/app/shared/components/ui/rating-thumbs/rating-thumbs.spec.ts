import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { provideAppTransloco } from '../../../../core/i18n/testing-transloco';
import { RatingThumbs } from './rating-thumbs';

describe('RatingThumbs', () => {
  it('fills as many thumbs as the rating out of five', () => {
    TestBed.configureTestingModule({
      imports: [RatingThumbs],
      providers: [provideAppTransloco(), provideIonicAngular()],
    });
    const fixture = TestBed.createComponent(RatingThumbs);
    fixture.componentRef.setInput('rating', 3);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelectorAll('.rating-thumbs__thumb')).toHaveLength(5);
    expect(root.querySelectorAll('.rating-thumbs__thumb--filled')).toHaveLength(3);
    expect(root.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe(
      'Valoración 3 de 5',
    );
  });
});
