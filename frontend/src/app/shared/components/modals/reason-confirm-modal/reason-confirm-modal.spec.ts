import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { ApiError } from '../../../../core/models/api-error.model';
import { confirmWithReason, ReasonConfirmModal } from './reason-confirm-modal';

describe('ReasonConfirmModal', () => {
  let fixture: ComponentFixture<ReasonConfirmModal>;
  const dismiss = vi.fn().mockResolvedValue(true);
  const action = vi.fn();

  function typeReason(value: string): void {
    fixture.componentInstance.handleReasonInput(new CustomEvent('ionInput', { detail: { value } }));
  }

  beforeEach(() => {
    dismiss.mockClear();
    action.mockReset();
    TestBed.configureTestingModule({
      imports: [ReasonConfirmModal],
      providers: [provideIonicAngular(), { provide: ModalController, useValue: { dismiss } }],
    });
    fixture = TestBed.createComponent(ReasonConfirmModal);
    Object.assign(fixture.componentInstance, {
      header: '¿Desactivar el perfil?',
      message: 'No podrá usarlo.',
      confirmText: 'Desactivar perfil',
      action,
    });
    fixture.detectChanges();
  });

  it('needs a reason of at least 10 characters', async () => {
    typeReason('  short   ');
    expect(fixture.componentInstance.isReasonValid()).toBe(false);

    await fixture.componentInstance.handleConfirm();
    expect(action).not.toHaveBeenCalled();
  });

  it('runs the action with the trimmed reason and closes', async () => {
    action.mockResolvedValue(undefined);
    typeReason('  Reported twice this week  ');

    await fixture.componentInstance.handleConfirm();

    expect(action).toHaveBeenCalledWith('Reported twice this week');
    expect(dismiss).toHaveBeenCalledWith(null, 'confirm');
  });

  it('shows the error inside and stays open when the action fails', async () => {
    action.mockRejectedValue(new ApiError('LAST_ADMIN', 409));
    typeReason('Removing the admin role');

    await fixture.componentInstance.handleConfirm();
    fixture.detectChanges();

    expect(dismiss).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.reason__error')?.textContent).toContain(
      'último administrador',
    );
    typeReason('Removing the admin role again');
    expect(fixture.componentInstance.errorMessage()).toBeNull();
  });

  it('cancels without running the action', async () => {
    await fixture.componentInstance.handleCancel();
    expect(dismiss).toHaveBeenCalledWith(null, 'cancel');
  });

  it('tells whether the action was done', async () => {
    const modal = {
      present: vi.fn().mockResolvedValue(undefined),
      onDidDismiss: vi.fn().mockResolvedValue({ role: 'confirm' }),
    };
    const create = vi.fn().mockResolvedValue(modal);

    const isDone = await confirmWithReason({ create } as unknown as ModalController, {
      header: 'h',
      message: 'm',
      confirmText: 'c',
      action,
    });

    expect(isDone).toBe(true);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ cssClass: 'info-dialog' }));
  });
});
