import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { provideAppTransloco } from '../../../../core/i18n/testing-transloco';
import { RatingMedals } from './rating-medals';

describe('RatingMedals', () => {
  it('fills as many medals as the rating out of five', () => {
    TestBed.configureTestingModule({
      imports: [RatingMedals],
      providers: [provideAppTransloco(), provideIonicAngular()],
    });
    const fixture = TestBed.createComponent(RatingMedals);
    fixture.componentRef.setInput('rating', 3);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelectorAll('.rating-medals__medal')).toHaveLength(5);
    expect(root.querySelectorAll('.rating-medals__medal--filled')).toHaveLength(3);
    expect(root.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe(
      'Valoración 3 de 5',
    );
  });
});
