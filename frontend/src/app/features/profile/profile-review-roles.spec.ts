import { TestBed } from '@angular/core/testing';
import { carOutline, personOutline } from 'ionicons/icons';
import { provideAppTransloco } from '../../core/i18n/testing-transloco';
import { reviewRoleIcon, reviewRoleLabel } from './profile-review-roles';

describe('review roles', () => {
  it('names each role and gives it its icon', () => {
    TestBed.configureTestingModule({ providers: [provideAppTransloco()] });
    TestBed.runInInjectionContext(() => {
      expect(reviewRoleLabel('driver')).toBe('Conductor');
      expect(reviewRoleLabel('passenger')).toBe('Pasajero');
    });
    expect(reviewRoleIcon('driver')).toBe(carOutline);
    expect(reviewRoleIcon('passenger')).toBe(personOutline);
  });
});
