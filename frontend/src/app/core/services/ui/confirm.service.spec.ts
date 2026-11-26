import { TestBed } from '@angular/core/testing';
import { ModalController } from '@ionic/angular';
import { TranslocoService } from '@jsverse/transloco';
import { vi } from 'vitest';
import { provideAppTransloco } from '../../i18n/testing-transloco';
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
      providers: [{ provide: ModalController, useValue: { create } }, provideAppTransloco()],
    });
    // En español, sea cual sea el idioma que dejó el spec anterior
    TestBed.inject(TranslocoService).setActiveLang('es');
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
        componentProps: expect.objectContaining({
          header: '¿Cerrar sesión?',
          points: [],
        }),
      }),
    );
  });

  // Con un viaje a medio rellenar en Publicar, una línea avisa de que se pierde
  it('warns that the trip being published will be lost', async () => {
    const confirm = setUp('confirm');

    await confirmLogout(confirm, true);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        componentProps: expect.objectContaining({
          points: ['Se perderá el viaje que estabas publicando.'],
        }),
      }),
    );
  });
});
