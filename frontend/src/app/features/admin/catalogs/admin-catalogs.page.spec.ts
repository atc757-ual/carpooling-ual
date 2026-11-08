import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { AdminCatalogItem } from '../../../core/models/admin-catalog.model';
import { ApiError } from '../../../core/models/api-error.model';
import { AdminCatalogsService } from '../../../core/services/admin/admin-catalogs.service';
import { AdminLegalDocumentsService } from '../../../core/services/admin/admin-legal-documents.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { AdminCatalogsPage, LEGAL_TAB } from './admin-catalogs.page';

const SEAT: AdminCatalogItem = { key: 'seat', name: 'SEAT', isActive: true, sortOrder: 0 };
const SKODA: AdminCatalogItem = { key: 'skoda', name: 'Škoda', isActive: false, sortOrder: 1 };

describe('AdminCatalogsPage', () => {
  let fixture: ComponentFixture<AdminCatalogsPage>;
  const list = vi.fn();
  const update = vi.fn();
  const move = vi.fn();
  const create = vi.fn();
  const uploadAvatar = vi.fn();
  const showSuccess = vi.fn().mockResolvedValue(undefined);
  const showError = vi.fn().mockResolvedValue(undefined);
  const onDidDismiss = vi.fn();
  const modalCreate = vi.fn();
  const legalVersions = vi.fn().mockResolvedValue([]);

  async function render(catalog?: string): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [AdminCatalogsPage],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        {
          provide: AdminCatalogsService,
          useValue: { list, update, move, create, uploadAvatar },
        },
        { provide: AdminLegalDocumentsService, useValue: { versions: legalVersions } },
        { provide: ToastService, useValue: { showSuccess, showError } },
        { provide: ModalController, useValue: { create: modalCreate } },
      ],
    });
    fixture = TestBed.createComponent(AdminCatalogsPage);
    if (catalog) {
      fixture.componentRef.setInput('catalog', catalog);
    }
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  // La acción del último formulario abierto (lo que haría al guardar)
  function lastAction(): (changes: object, image?: File | null) => Promise<void> {
    const [options] = modalCreate.mock.calls.at(-1) as [
      { componentProps: { action: (changes: object, image?: File | null) => Promise<void> } },
    ];
    return options.componentProps.action;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    list.mockResolvedValue([SEAT, SKODA]);
    update.mockResolvedValue(SEAT);
    move.mockResolvedValue(undefined);
    onDidDismiss.mockResolvedValue({ role: 'confirm' });
    modalCreate.mockResolvedValue({ present: vi.fn(), onDidDismiss });
  });

  it('lists the brands by default, inactive ones included', async () => {
    const root = await render();

    expect(list).toHaveBeenCalledWith('vehicle-brands');
    const rows = root.querySelectorAll('.catalogs__row');
    expect(rows).toHaveLength(2);
    expect(rows[1].classList).toContain('catalogs__row--inactive');
    expect(rows[1].textContent).toContain('Desactivado');
    expect(root.querySelector('.catalogs__create')?.textContent).toContain('Añadir marca');
  });

  it('opens the catalog of the URL and only lets preferences be edited', async () => {
    list.mockResolvedValue([
      { ...SEAT, key: 'music-soft', preference: 'music', value: 'soft', nameEn: 'Soft music' },
    ]);
    const root = await render('travel-preferences');

    expect(list).toHaveBeenCalledWith('travel-preferences');
    expect(root.querySelector('.catalogs__create')).toBeNull();
    const cells = [...root.querySelectorAll('.catalogs__row .catalogs__cell')];
    expect(cells.map((cell) => cell.textContent?.trim())).toEqual(['Música', 'SEAT', 'Soft music']);
  });

  it('opens the legal documents editor in its own tab', async () => {
    const root = await render(LEGAL_TAB);

    expect(list).not.toHaveBeenCalled();
    expect(legalVersions).toHaveBeenCalledWith('terms');
    expect(root.querySelector('app-legal-documents-editor')).not.toBeNull();
    expect(root.querySelector('.catalogs__create')).toBeNull();
    expect(root.textContent).toContain('Términos, privacidad y la declaración del conductor');
  });

  it('moves, deactivates and edits an item, then reloads the list', async () => {
    await render();
    const page = fixture.componentInstance;

    await page.handleMove(SKODA, 'up');
    expect(move).toHaveBeenCalledWith('vehicle-brands', 'skoda', 'up');
    await page.handleToggle(SEAT);
    expect(update).toHaveBeenCalledWith('vehicle-brands', 'seat', { isActive: false });

    await page.handleEdit(SEAT);
    await lastAction()({ name: 'Seat' });
    expect(update).toHaveBeenCalledWith('vehicle-brands', 'seat', { name: 'Seat' });
    expect(showSuccess).toHaveBeenCalledWith('Cambios guardados.');
    await fixture.whenStable();
    expect(list.mock.calls.length).toBeGreaterThan(1);
  });

  it('adds a brand and uploads an avatar', async () => {
    await render();
    await fixture.componentInstance.handleCreate();
    await lastAction()({ name: 'Rivian' }, null);
    expect(create).toHaveBeenCalledWith('vehicle-brands', { name: 'Rivian' });

    TestBed.resetTestingModule();
    await render('avatars');
    await fixture.componentInstance.handleCreate();
    const image = new File([new Uint8Array([1])], 'buho.png');
    await lastAction()({ name: 'Búho' }, image);
    expect(uploadAvatar).toHaveBeenCalledWith('Búho', image);
  });

  it('shows a toast when a change fails and a retry when the list fails', async () => {
    await render();
    move.mockRejectedValue(new ApiError('INTERNAL_ERROR', 500));
    await fixture.componentInstance.handleMove(SKODA, 'up');
    expect(showError).toHaveBeenCalled();
    expect(fixture.componentInstance.busyKey()).toBeNull();

    TestBed.resetTestingModule();
    list.mockRejectedValue(new ApiError('INTERNAL_ERROR', 500));
    const root = await render();
    expect(root.querySelector('.notice--danger')).not.toBeNull();
  });

  it('puts the chosen catalog in the URL', async () => {
    await render();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await fixture.componentInstance.handleCatalog('vehicle-colors');
    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { catalog: 'vehicle-colors' } }),
    );
  });
});
