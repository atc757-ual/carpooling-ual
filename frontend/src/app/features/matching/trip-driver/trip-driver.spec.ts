import { TestBed } from '@angular/core/testing';
import { TripDriver as Driver } from '../../../core/models/trip-result.model';
import { getFirstName, getInitials, TripDriver } from './trip-driver';

const DRIVER: Driver = { name: 'Lucía Cortés', tripCount: 42, rating: 4.8, isEmailVerified: true };

describe('TripDriver', () => {
  function render(driver: Driver): HTMLElement {
    const fixture = TestBed.createComponent(TripDriver);
    fixture.componentRef.setInput('driver', driver);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const text = (root: HTMLElement, selector: string): string | undefined =>
    root.querySelector(selector)?.textContent?.trim();

  it('shows the initials, the name, the trips and the rating', () => {
    const root = render(DRIVER);

    expect(text(root, '.trip-driver__avatar')).toBe('LC');
    expect(text(root, '.trip-driver__name')).toBe('Lucía Cortés');
    expect(root.textContent).toContain('42 viajes · Correo UAL verificado');
    expect(root.querySelector('.trip-driver__rating')?.getAttribute('aria-label')).toBe(
      'Valoración 4,8 de 5',
    );
  });

  it('speaks of one trip and leaves out an unverified email', () => {
    const root = render({ ...DRIVER, tripCount: 1, isEmailVerified: false });

    expect(root.textContent).toContain('1 viaje');
    expect(root.textContent).not.toContain('Correo UAL verificado');
  });
});

describe('getInitials', () => {
  it.each([
    ['Lucía Cortés', 'LC'],
    ['javier pardo gil', 'JP'],
    ['  Sara  ', 'S'],
  ])('turns %s into %s', (name, initials) => {
    expect(getInitials(name)).toBe(initials);
  });
});

describe('getFirstName', () => {
  it('takes the first word of the name', () => {
    expect(getFirstName('  Lucía Cortés ')).toBe('Lucía');
  });
});
