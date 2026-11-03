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
    fixture.componentRef.setInput('summary', '3 próximos · 1 en curso');
    fixture.componentRef.setInput('pastCount', 12);
    fixture.componentRef.setInput('co2Kg', 25.4);
    fixture.componentRef.setInput('rating', rating);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the shortcuts, the summary and the figures', () => {
    const root = render({ averageRating: 4.75, ratingCount: 12 });

    expect(root.textContent).toContain('Publicar viaje');
    expect(root.textContent).toContain('Buscar viaje');
    expect(root.textContent).toContain('3 próximos · 1 en curso');
    expect(root.textContent).toContain('12');
    expect(root.textContent).toContain('25,4 kg');
    expect(root.textContent).toContain('4,8 · 12 valoraciones');
  });

  it('says when there are no ratings yet', () => {
    render(null);
    expect(fixture.componentInstance.ratingText()).toBe('Aún sin valoraciones');

    fixture.componentRef.setInput('rating', { averageRating: null, ratingCount: 0 });
    expect(fixture.componentInstance.ratingText()).toBe('Aún sin valoraciones');

    fixture.componentRef.setInput('rating', { averageRating: 5, ratingCount: 1 });
    expect(fixture.componentInstance.ratingText()).toBe('5,0 · 1 valoración');
  });
});
