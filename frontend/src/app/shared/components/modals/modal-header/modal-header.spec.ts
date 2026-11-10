import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { provideIonicAngular } from '@ionic/angular';
import { provideTranslocoTestingSupport } from '../../../../core/i18n/testing-transloco';
import { ModalHeader } from './modal-header';

describe('ModalHeader', () => {
  function render(closeLabel?: string) {
    TestBed.configureTestingModule({
      imports: [ModalHeader],
      providers: [provideIonicAngular(), provideTranslocoTestingSupport()],
    });
    const fixture = TestBed.createComponent(ModalHeader);
    fixture.componentRef.setInput('title', 'Editar vehículo');
    if (closeLabel) {
      fixture.componentRef.setInput('closeLabel', closeLabel);
    }
    fixture.detectChanges();
    return fixture;
  }

  it('shows the title and closes with the ✕', () => {
    const fixture = render();
    const root = fixture.nativeElement as HTMLElement;
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);

    expect(root.querySelector('ion-title')?.textContent).toContain('Editar vehículo');
    const button = root.querySelector('.modal-close-button');
    expect(button?.getAttribute('aria-label')).toBe('Cerrar');
    root.querySelector('form')?.dispatchEvent(new Event('submit'));

    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('takes the label of the ✕ from a translated screen', () => {
    const root = render('Close').nativeElement as HTMLElement;
    expect(root.querySelector('.modal-close-button')?.getAttribute('aria-label')).toBe('Close');
  });

  it('shows the back arrow only when asked, and goes back with it', () => {
    const fixture = render();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.modal-back-button')).toBeNull();

    const back = vi.fn();
    fixture.componentInstance.back.subscribe(back);
    fixture.componentRef.setInput('hasBack', true);
    fixture.componentRef.setInput('hasClose', false);
    fixture.detectChanges();

    expect(root.querySelector('.modal-close-button')).toBeNull();
    const button = root.querySelector('.modal-back-button') as HTMLElement;
    expect(button.getAttribute('aria-label')).toBe('Volver');
    button.closest('form')?.dispatchEvent(new Event('submit'));
    expect(back).toHaveBeenCalledTimes(1);
  });
});
