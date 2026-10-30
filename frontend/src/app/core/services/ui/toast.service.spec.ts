import { TestBed } from '@angular/core/testing';
import { ToastController } from '@ionic/angular';
import { vi } from 'vitest';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let create: ReturnType<typeof vi.fn>;
  let toasts: {
    present: ReturnType<typeof vi.fn>;
    dismiss: ReturnType<typeof vi.fn>;
    addEventListener: ReturnType<typeof vi.fn>;
    style: { setProperty: ReturnType<typeof vi.fn> };
  }[];

  beforeEach(() => {
    toasts = [];
    create = vi.fn().mockImplementation(async () => {
      const toast = {
        present: vi.fn(),
        dismiss: vi.fn(),
        addEventListener: vi.fn(),
        style: { setProperty: vi.fn() },
      };
      toasts.push(toast);
      return toast;
    });
    TestBed.configureTestingModule({
      providers: [{ provide: ToastController, useValue: { create } }],
    });
  });

  it('shows an error at the top, announced as an alert', async () => {
    await TestBed.inject(ToastService).showError('Correo o contraseña incorrectos.');

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Correo o contraseña incorrectos.',
        position: 'top',
        cssClass: expect.arrayContaining(['toast--danger']),
        htmlAttributes: { role: 'alert' },
      }),
    );
    expect(toasts[0].present).toHaveBeenCalled();
  });

  it('covers the header on mobile and floats on desktop', async () => {
    const toast = TestBed.inject(ToastService);
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    await toast.showError('Sin conexión.');
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    await toast.showError('Sin conexión.');
    vi.unstubAllGlobals();

    expect(create.mock.calls[0][0].cssClass).toContain('toast--bar');
    expect(create.mock.calls[0][0].enterAnimation).toBeTypeOf('function');
    expect(create.mock.calls[1][0].cssClass).toContain('toast--floating');
    expect(create.mock.calls[1][0].enterAnimation).toBeUndefined();
  });

  it('closes when tapped', async () => {
    await TestBed.inject(ToastService).showError('Sin conexión.');

    const [event, onTap] = toasts[0].addEventListener.mock.calls[0];
    onTap();

    expect(event).toBe('click');
    expect(toasts[0].dismiss).toHaveBeenCalled();
  });

  // Al cambiar de pantalla quedan páginas en el DOM cuyo panel mide 0: si se
  // coge esa, el aviso sale con ancho 0 (invisible)
  it('takes the form column that has size, not one left from another screen', async () => {
    const stalePanel = document.createElement('main');
    stalePanel.className = 'auth-layout__panel';
    const stalePage = document.createElement('section');
    stalePage.className = 'ion-page';
    stalePage.append(stalePanel);

    const visiblePanel = document.createElement('main');
    visiblePanel.className = 'auth-layout__panel';
    const visiblePage = document.createElement('section');
    visiblePage.className = 'ion-page';
    visiblePage.append(visiblePanel);

    document.body.append(stalePage, visiblePage);
    vi.spyOn(stalePanel, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 0 } as DOMRect);
    vi.spyOn(visiblePanel, 'getBoundingClientRect').mockReturnValue({
      left: 120,
      width: 480,
    } as DOMRect);

    await TestBed.inject(ToastService).showError('Sin conexión.');
    document.body.replaceChildren();

    expect(toasts[0].style.setProperty).toHaveBeenCalledWith('--start', '120px');
    expect(toasts[0].style.setProperty).toHaveBeenCalledWith('--width', '480px');
  });

  it('shows a success message in green and closes the previous one', async () => {
    const toast = TestBed.inject(ToastService);
    await toast.showError('Algo ha salido mal.');

    await toast.showSuccess('Correo UAL verificado.');

    expect(create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        cssClass: expect.arrayContaining(['toast--success']),
        htmlAttributes: { role: 'status' },
      }),
    );
    expect(toasts[0].dismiss).toHaveBeenCalled();
  });
});
