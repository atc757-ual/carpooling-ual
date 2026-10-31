import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { TripDriver as Driver } from '../../../core/models/trip-result.model';
import { AvatarsService } from '../../../core/services/users/avatars.service';
import { getFirstName, getInitials, TripDriver } from './trip-driver';

const DRIVER: Driver = {
  name: 'Lucía Cortés',
  avatarKey: null,
  tripCount: 42,
  rating: 4.8,
  isEmailVerified: true,
};

describe('TripDriver', () => {
  function render(driver: Driver, getGraphic = vi.fn().mockResolvedValue(null)): HTMLElement {
    TestBed.configureTestingModule({
      providers: [{ provide: AvatarsService, useValue: { getGraphic } }],
    });
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

  it('shows new driver when no rating is available', () => {
    const root = render({ name: 'Lucía Cortés', avatarKey: null, isEmailVerified: true });

    expect(root.textContent).toContain('Nuevo conductor');
    expect(root.textContent).toContain('Correo UAL verificado');
    expect(root.querySelector('.trip-driver__rating')).toBeNull();
  });

  it('shows the selected catalogue avatar when it loads', async () => {
    const getGraphic = vi.fn().mockResolvedValue({
      viewBox: '0 0 64 64',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: '3',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      shapes: [{ kind: 'circle', cx: '32', cy: '32', r: '20' }],
    });
    TestBed.configureTestingModule({
      providers: [{ provide: AvatarsService, useValue: { getGraphic } }],
    });
    const fixture = TestBed.createComponent(TripDriver);
    fixture.componentRef.setInput('driver', { ...DRIVER, avatarKey: 'sun' });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(getGraphic).toHaveBeenCalledWith('sun');
    expect(fixture.nativeElement.querySelector('.trip-driver__avatar-art circle')).not.toBeNull();
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
