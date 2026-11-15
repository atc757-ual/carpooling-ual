import { TestBed } from '@angular/core/testing';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { provideTranslocoTestingSupport } from '../../../../core/i18n/testing-transloco';
import { ConfirmModal } from './confirm-modal';

describe('ConfirmModal', () => {
  const dismiss = vi.fn().mockResolvedValue(true);

  function render(
    isWarning = false,
    points: string[] = [],
  ): { root: HTMLElement; modal: ConfirmModal } {
    TestBed.configureTestingModule({
      imports: [ConfirmModal],
      providers: [
        provideIonicAngular(),
        provideTranslocoTestingSupport(),
        { provide: ModalController, useValue: { dismiss } },
      ],
    });
    const fixture = TestBed.createComponent(ConfirmModal);
    Object.assign(fixture.componentInstance, {
      header: '¿Cerrar sesión?',
      message: 'Para volver a entrar necesitarás tu correo y tu contraseña.',
      confirmText: 'Cerrar sesión',
      icon: 'log-out-outline',
      isWarning,
      points,
    });
    fixture.detectChanges();
    return { root: fixture.nativeElement as HTMLElement, modal: fixture.componentInstance };
  }

  it('puts the action first in blue and going back below, outlined', () => {
    const { root } = render();

    expect(root.textContent).toContain('¿Cerrar sesión?');
    const [action, cancel] = [...root.querySelectorAll('ion-button')];
    expect(action.textContent?.trim()).toBe('Cerrar sesión');
    expect(action.getAttribute('fill')).toBeNull();
    expect(cancel.textContent?.trim()).toBe('Cancelar');
    expect(cancel.classList).toContain('confirm__cancel');
  });

  it('lists the effects one per line, only when there are any', () => {
    expect(render().root.querySelector('.bullet-list')).toBeNull();

    TestBed.resetTestingModule();
    const { root } = render(false, ['Uno', 'Dos']);
    const items = [...root.querySelectorAll('.bullet-list li')].map((li) => li.textContent);
    expect(items).toEqual(['Uno', 'Dos']);
  });

  it('shows the icon in amber only for a warning', () => {
    const { root } = render(true);

    expect(root.querySelector('.confirm__icon')?.classList).toContain('confirm__icon--warning');
  });

  it('keeps the icon blue when it is not a warning', () => {
    const { root } = render();

    expect(root.querySelector('.confirm__icon')?.classList).not.toContain('confirm__icon--warning');
  });

  it('closes confirming or cancelling', async () => {
    const { modal } = render();

    await modal.handleConfirm();
    expect(dismiss).toHaveBeenLastCalledWith(null, 'confirm');
    await modal.handleCancel();
    expect(dismiss).toHaveBeenLastCalledWith(null, 'cancel');
  });
});
