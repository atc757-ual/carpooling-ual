import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { ApiError } from '../../../../core/models/api-error.model';
import { CatalogItemModal, openCatalogItemModal } from './catalog-item-modal';

describe('CatalogItemModal', () => {
  let fixture: ComponentFixture<CatalogItemModal>;
  const dismiss = vi.fn().mockResolvedValue(true);
  const action = vi.fn();

  function render(inputs: Partial<CatalogItemModal> = {}): CatalogItemModal {
    TestBed.configureTestingModule({
      imports: [CatalogItemModal],
      providers: [provideIonicAngular(), { provide: ModalController, useValue: { dismiss } }],
    });
    fixture = TestBed.createComponent(CatalogItemModal);
    Object.assign(fixture.componentInstance, {
      header: 'Añadir color',
      confirmText: 'Añadir',
      fields: ['name', 'hexLight', 'hexDark'],
      action,
      ...inputs,
    });
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    action.mockResolvedValue(undefined);
  });

  it('needs every field and valid colors before saving', async () => {
    const modal = render();
    expect(modal.isValid()).toBe(false);

    modal.handleInput('name', ' Oro ');
    modal.handleInput('hexLight', '#c9a227');
    modal.handleInput('hexDark', 'dorado');
    expect(modal.isValid()).toBe(false);

    modal.handleInput('hexDark', '#e0c060');
    expect(modal.isValid()).toBe(true);
    await modal.handleConfirm();

    expect(action).toHaveBeenCalledWith(
      { name: 'Oro', hexLight: '#c9a227', hexDark: '#e0c060' },
      null,
    );
    expect(dismiss).toHaveBeenCalledWith(null, 'confirm');
  });

  it('starts from the values of the item when editing', () => {
    const modal = render({
      fields: ['name', 'nameEn'],
      initial: { name: 'Charlar', nameEn: 'Chatting' },
    });
    modal.ngOnInit();
    expect(modal.values()).toEqual({ name: 'Charlar', nameEn: 'Chatting' });
    expect(modal.isValid()).toBe(true);
  });

  it('asks for the image when uploading', async () => {
    const modal = render({ fields: ['name'], withImage: true });
    modal.handleInput('name', 'Búho');
    expect(modal.isValid()).toBe(false);

    const image = new File([new Uint8Array([1])], 'buho.png', { type: 'image/png' });
    modal.handleImage({ target: { files: [image] } } as unknown as Event);
    expect(modal.isValid()).toBe(true);
    await modal.handleConfirm();
    expect(action).toHaveBeenCalledWith({ name: 'Búho' }, image);
  });

  it('keeps the window open with the error when saving fails', async () => {
    action.mockRejectedValue(new ApiError('CATALOG_ITEM_EXISTS', 409));
    const modal = render({ fields: ['name'] });
    modal.handleInput('name', 'SEAT');

    await modal.handleConfirm();

    expect(modal.errorMessage()).not.toBeNull();
    expect(dismiss).not.toHaveBeenCalled();
    await modal.handleCancel();
    expect(dismiss).toHaveBeenCalledWith(null, 'cancel');
  });

  it('tells whether it was saved', async () => {
    const present = vi.fn().mockResolvedValue(undefined);
    const onDidDismiss = vi.fn().mockResolvedValue({ role: 'confirm' });
    const create = vi.fn().mockResolvedValue({ present, onDidDismiss });

    await expect(
      openCatalogItemModal({ create } as unknown as ModalController, {
        header: 'Editar',
        confirmText: 'Guardar',
        fields: ['name'],
        action,
      }),
    ).resolves.toBe(true);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ cssClass: 'info-dialog' }));
  });
});
