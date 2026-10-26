import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { ComingSoonPage } from './coming-soon.page';

describe('ComingSoonPage', () => {
  it('shows the title and what will be possible there', () => {
    TestBed.configureTestingModule({
      imports: [ComingSoonPage],
      providers: [provideIonicAngular()],
    });
    const fixture = TestBed.createComponent(ComingSoonPage);
    fixture.componentRef.setInput('title', 'Avisos');
    fixture.componentRef.setInput('description', 'Muy pronto verás aquí los avisos de tus viajes.');
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('h1')?.textContent).toBe('Avisos');
    expect(root.querySelector('p')?.textContent).toBe(
      'Muy pronto verás aquí los avisos de tus viajes.',
    );
  });
});
