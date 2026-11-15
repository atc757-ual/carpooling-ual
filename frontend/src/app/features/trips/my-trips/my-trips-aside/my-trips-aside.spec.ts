import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { RoleRating } from '../../../../core/models/user.model';
import { MyTripsAside } from './my-trips-aside';

describe('MyTripsAside', () => {
  let fixture: ComponentFixture<MyTripsAside>;

  function render(rating: RoleRating | null): HTMLElement {
    TestBed.configureTestingModule({
      imports: [MyTripsAside],
      providers: [provideIonicAngular(), provideRouter([])],
    });
    fixture = TestBed.createComponent(MyTripsAside);
    fixture.componentRef.setInput('co2Kg', 25.4);
    fixture.componentRef.setInput('rating', rating);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const titles = (root: HTMLElement): string[] =>
    [...root.querySelectorAll('.my-trips-aside__item-text > :first-child')].map(
      (title) => title.textContent ?? '',
    );

  it('shows the impact and what may interest, each card with its title', () => {
    const root = render({ averageRating: 4.75, ratingCount: 12 });

    expect([...root.querySelectorAll('ion-card-title')].map((t) => t.textContent)).toEqual([
      'Tu impacto',
      'Te puede interesar',
    ]);
    expect(root.textContent).toContain('25,4 kg');
    expect(root.textContent).toContain('4,8 (12)');
    expect(titles(root)).toEqual(['Publicar viaje', 'Buscar viaje']);
  });

  it('only suggests what the profiles of the user allow', () => {
    const root = render(null);

    fixture.componentRef.setInput('canDrive', false);
    fixture.detectChanges();
    expect(titles(root)).toEqual(['Buscar viaje']);

    fixture.componentRef.setInput('canRide', false);
    fixture.detectChanges();
    expect(root.querySelector('.my-trips-aside__list')).toBeNull();
  });

  it('shows a dash when there are no ratings yet', () => {
    render(null);
    expect(fixture.componentInstance.ratingText()).toBe('—');

    fixture.componentRef.setInput('rating', { averageRating: null, ratingCount: 0 });
    expect(fixture.componentInstance.ratingText()).toBe('—');

    fixture.componentRef.setInput('rating', { averageRating: 5, ratingCount: 1 });
    expect(fixture.componentInstance.ratingText()).toBe('5,0 (1)');
  });
});
