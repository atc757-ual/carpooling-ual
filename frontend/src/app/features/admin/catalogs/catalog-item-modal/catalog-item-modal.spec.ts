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

  it('picks the point of a parking on the map and sends it', async () => {
    const present = vi.fn().mockResolvedValue(undefined);
    const onDidDismiss = vi.fn().mockResolvedValue({ data: [-2.405, 36.83], role: 'picked' });
    const create = vi.fn().mockResolvedValue({ present, onDidDismiss });
    TestBed.overrideProvider(ModalController, { useValue: { dismiss, create } });
    const modal = render({ fields: ['name', 'location'] });
    modal.handleInput('name', 'Parking norte');
    expect(modal.isValid()).toBe(false);
    expect(modal.pointLabel()).toBe('Sin elegir');

    await modal.handlePickPoint();

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        componentProps: { adjustPoint: [-2.4045, 36.8322], pickPoint: true },
      }),
    );
    expect(modal.pointLabel()).toBe('36.83000, -2.40500');
    await modal.handleConfirm();
    expect(action).toHaveBeenCalledWith(
      { name: 'Parking norte', location: { type: 'Point', coordinates: [-2.405, 36.83] } },
      null,
    );
  });

  it('keeps the point when the map is closed without picking', async () => {
    const onDidDismiss = vi.fn().mockResolvedValue({ role: 'cancel' });
    const create = vi.fn().mockResolvedValue({ present: vi.fn(), onDidDismiss });
    TestBed.overrideProvider(ModalController, { useValue: { dismiss, create } });
    const modal = render({
      fields: ['name', 'location'],
      initial: { name: 'Sur', location: { type: 'Point', coordinates: [-2.4, 36.8] } },
    });
    modal.ngOnInit();

    await modal.handlePickPoint();

    expect(modal.point()).toEqual([-2.4, 36.8]);
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

  describe('choosing the image', () => {
    function choose(modal: CatalogItemModal, image: File | null): void {
      modal.handleImage({ target: { files: image ? [image] : [] } } as unknown as Event);
    }

    // Una imagen del navegador de estas medidas, que carga al recibir src
    function stubImage(width: number, height: number): void {
      vi.stubGlobal(
        'Image',
        class {
          naturalWidth = width;
          naturalHeight = height;
          onload: (() => void) | null = null;
          private source = '';

          get src(): string {
            return this.source;
          }

          set src(value: string) {
            this.source = value;
            this.onload?.();
          }
        },
      );
    }

    const png = (bytes = 1): File =>
      new File([new Uint8Array(bytes)], 'buho.png', { type: 'image/png' });

    afterEach(() => vi.unstubAllGlobals());

    it('rejects an SVG before uploading it', () => {
      const modal = render({ fields: ['name'], withImage: true });
      choose(modal, new File(['<svg/>'], 'buho.svg', { type: 'image/svg+xml' }));
      expect(modal.image()).toBeNull();
      expect(modal.errorMessage()).toContain('PNG o WebP');
    });

    it('rejects an image over 100 KB', () => {
      const modal = render({ fields: ['name'], withImage: true });
      choose(modal, png(100 * 1024 + 1));
      expect(modal.image()).toBeNull();
      expect(modal.errorMessage()).toContain('100 KB');
    });

    it('previews a valid image', async () => {
      stubImage(256, 256);
      const modal = render({ fields: ['name'], withImage: true });
      choose(modal, png());
      await vi.waitFor(() => expect(modal.imagePreview()).toContain('data:image/png'));
      expect(modal.errorMessage()).toBeNull();
    });

    it.each([
      [256, 128],
      [64, 64],
      [1024, 1024],
    ])('rejects an image of %i × %i', async (width, height) => {
      stubImage(width, height);
      const modal = render({ fields: ['name'], withImage: true });
      choose(modal, png());
      await vi.waitFor(() => expect(modal.errorMessage()).toContain(`${width} × ${height}`));
      expect(modal.image()).toBeNull();
      expect(modal.imagePreview()).toBeNull();
    });

    it('clears the choice when the picker comes back empty', () => {
      const modal = render({ fields: ['name'], withImage: true });
      choose(modal, null);
      expect(modal.image()).toBeNull();
      expect(modal.errorMessage()).toBeNull();
    });
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
