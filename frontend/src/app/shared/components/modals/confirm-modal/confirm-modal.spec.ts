import { TestBed } from '@angular/core/testing';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { ConfirmModal } from './confirm-modal';

describe('ConfirmModal', () => {
  const dismiss = vi.fn().mockResolvedValue(true);

  function render(isDestructive: boolean): { root: HTMLElement; modal: ConfirmModal } {
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
    });
    fixture.detectChanges();
    return { root: fixture.nativeElement as HTMLElement, modal: fixture.componentInstance };
  }

  it('makes cancelling the main button when it is destructive', () => {
    const { root } = render(true);

    expect(root.textContent).toContain('¿Cerrar sesión?');
    const [cancel, action] = [...root.querySelectorAll('ion-button')];
    expect(cancel.textContent?.trim()).toBe('Cancelar');
    expect(action.textContent?.trim()).toBe('Cerrar sesión');
    expect(action.classList).toContain('confirm__secondary');
  });

  it('closes confirming or cancelling', async () => {
    const { modal } = render(false);

    await modal.handleConfirm();
    expect(dismiss).toHaveBeenLastCalledWith(null, 'confirm');
    await modal.handleCancel();
    expect(dismiss).toHaveBeenLastCalledWith(null, 'cancel');
  });
});
