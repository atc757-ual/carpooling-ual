import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { AdminSectionPage } from './admin-section.page';
import { ADMIN_SECTIONS } from './admin-sections';

describe('AdminSectionPage', () => {
  it('shows the title of its section and that it is coming soon', () => {
    TestBed.configureTestingModule({
      imports: [AdminSectionPage],
      providers: [provideIonicAngular()],
    });
    const fixture = TestBed.createComponent(AdminSectionPage);
    fixture.componentRef.setInput('section', ADMIN_SECTIONS[2]);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h1')?.textContent).toBe('Usuarios');
    expect(element.querySelector('[role="status"]')?.textContent).toContain('Disponible pronto');
  });
});
