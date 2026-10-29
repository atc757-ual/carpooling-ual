import { TestBed } from '@angular/core/testing';
import { ModalController } from '@ionic/angular';
import { vi } from 'vitest';
import { confirmLogout } from '../auth/confirm-logout';
import { ConfirmService } from './confirm.service';

describe('ConfirmService', () => {
  let create: ReturnType<typeof vi.fn>;

  function setUp(role: string): ConfirmService {
    create = vi.fn().mockResolvedValue({
      present: vi.fn().mockResolvedValue(undefined),
      onDidDismiss: () => Promise.resolve({ role }),
    });
    TestBed.configureTestingModule({
      providers: [{ provide: ModalController, useValue: { create } }],
    });
    return TestBed.inject(ConfirmService);
  }

  it('is true only when the action is confirmed', async () => {
    expect(await setUp('confirm').ask({ header: 'h', message: 'm', confirmText: 'Sí' })).toBe(true);
    TestBed.resetTestingModule();
    expect(await setUp('backdrop').ask({ header: 'h', message: 'm', confirmText: 'Sí' })).toBe(
      false,
    );
  });

  it('asks to log out with the destructive window', async () => {
    const confirm = setUp('confirm');

    expect(await confirmLogout(confirm)).toBe(true);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        componentProps: expect.objectContaining({ header: '¿Cerrar sesión?', isDestructive: true }),
      }),
    );
  });
});
