import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { provideAppTransloco } from '../../../core/i18n/testing-transloco';
import { AdminPlatformSettings } from '../../../core/models/admin-settings.model';
import { AdminSettingsService } from '../../../core/services/admin/admin-settings.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { AdminSettingsPage, lastChangeText } from './admin-settings.page';

const NEVER_CHANGED: AdminPlatformSettings = {
  multiDayPublishing: false,
  updatedAt: null,
  updatedBy: null,
};

describe('AdminSettingsPage', () => {
  let fixture: ComponentFixture<AdminSettingsPage>;
  const get = vi.fn();
  const update = vi.fn();
  const showSuccess = vi.fn().mockResolvedValue(undefined);
  const showError = vi.fn().mockResolvedValue(undefined);

  async function render(): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [AdminSettingsPage],
      providers: [
        provideAppTransloco(),
        provideIonicAngular(),
        { provide: AdminSettingsService, useValue: { get, update } },
        { provide: ToastService, useValue: { showSuccess, showError } },
      ],
    });
    fixture = TestBed.createComponent(AdminSettingsPage);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    get.mockResolvedValue(NEVER_CHANGED);
  });

  it('says who changed the settings last and when', () => {
    expect(lastChangeText(NEVER_CHANGED)).toBe('Sin cambios desde la instalación.');
    const changed = { ...NEVER_CHANGED, updatedAt: '2026-11-24T09:30:00.000Z' };
    expect(lastChangeText({ ...changed, updatedBy: { id: 'a1', name: 'Ana García' } })).toMatch(
      /^Último cambio: .*2026.* · Ana García\.$/,
    );
    expect(lastChangeText({ ...changed, updatedBy: null })).toMatch(/· una cuenta eliminada\.$/);
  });

  it('shows the switch off, named and described', async () => {
    const root = await render();
    const toggle = root.querySelector('ion-toggle') as HTMLIonToggleElement;

    expect(toggle.checked).toBe(false);
    // Ionic pasa los aria-* del interruptor a su control interno: aquí se
    // comprueba que existen los textos a los que apuntan
    expect(root.querySelector('#multi-day-title')?.textContent).toBe(
      'Publicar varios días a la vez',
    );
    expect(root.querySelector('#multi-day-hint')?.textContent).toContain('hasta un mes');
    expect(root.textContent).toContain('Sin cambios desde la instalación.');
  });

  it('saves the switch at once and shows the new last change', async () => {
    await render();
    update.mockResolvedValue({
      multiDayPublishing: true,
      updatedAt: '2026-11-24T09:30:00.000Z',
      updatedBy: { id: 'a1', name: 'Ana García' },
    });

    await fixture.componentInstance.handleMultiDay(true);
    fixture.detectChanges();

    expect(update).toHaveBeenCalledWith({ multiDayPublishing: true });
    expect(showSuccess).toHaveBeenCalled();
    expect(fixture.componentInstance.isMultiDayChecked()).toBe(true);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Ana García');

    await fixture.componentInstance.handleMultiDay(true);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('puts the switch back and shows the error when saving fails', async () => {
    await render();
    update.mockRejectedValue(new Error('down'));

    await fixture.componentInstance.handleMultiDay(true);

    expect(showError).toHaveBeenCalled();
    expect(fixture.componentInstance.isMultiDayChecked()).toBe(false);
    expect(fixture.componentInstance.isSaving()).toBe(false);
  });

  it('offers to retry when the settings cannot be loaded', async () => {
    get.mockRejectedValueOnce(new Error('down'));
    const root = await render();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'No hemos podido cargar los ajustes.',
    );

    fixture.componentInstance.handleRetry();
    await fixture.whenStable();

    expect(get).toHaveBeenCalledTimes(2);
    expect(root.querySelector('ion-toggle')).not.toBeNull();
  });
});
