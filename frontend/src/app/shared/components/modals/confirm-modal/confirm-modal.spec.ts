import { TestBed } from '@angular/core/testing';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { ConfirmModal } from './confirm-modal';

describe('ConfirmModal', () => {
  const dismiss = vi.fn().mockResolvedValue(true);

  function render(
    isDestructive: boolean,
    isWarning = false,
  ): { root: HTMLElement; modal: ConfirmModal } {
    TestBed.configureTestingModule({
      imports: [ConfirmModal],
      providers: [provideIonicAngular(), { provide: ModalController, useValue: { dismiss } }],
    });
    const fixture = TestBed.createComponent(ConfirmModal);
    Object.assign(fixture.componentInstance, {
      header: '¿Cerrar sesión?',
      message: 'Para volver a entrar necesitarás tu correo y tu contraseña.',
      confirmText: 'Cerrar sesión',
      icon: 'log-out-outline',
      isDestructive,
      isWarning,
    });
    fixture.detectChanges();
    return { root: fixture.nativeElement as HTMLElement, modal: fixture.componentInstance };
  }

  it('makes cancelling the main button when it is destructive', () => {
    const { root } = render(true);

    expect(root.textContent).toContain('¿Cerrar sesión?');
    const [action, cancel] = [...root.querySelectorAll('ion-button')];
    expect(action.textContent?.trim()).toBe('Cerrar sesión');
    expect(action.classList).toContain('confirm__secondary');
    expect(cancel.textContent?.trim()).toBe('Cancelar');
  });

  it('shows the icon in amber only for a warning', () => {
    const { root } = render(true, true);

    expect(root.querySelector('.confirm__icon')?.classList).toContain('confirm__icon--warning');
  });

  it('keeps the icon blue when it is not a warning', () => {
    const { root } = render(false);

    expect(root.querySelector('.confirm__icon')?.classList).not.toContain('confirm__icon--warning');
  });

  it('closes confirming or cancelling', async () => {
    const { modal } = render(false);

    await modal.handleConfirm();
    expect(dismiss).toHaveBeenLastCalledWith(null, 'confirm');
    await modal.handleCancel();
    expect(dismiss).toHaveBeenLastCalledWith(null, 'cancel');
  });
});
