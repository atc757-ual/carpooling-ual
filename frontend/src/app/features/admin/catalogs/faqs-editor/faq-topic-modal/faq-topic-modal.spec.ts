import { provideAppTransloco } from '../../../../../core/i18n/testing-transloco';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { AdminFaqTopic } from '../../../../../core/models/admin-faq.model';
import { ApiError } from '../../../../../core/models/api-error.model';
import { FaqTopicModal, openFaqTopicModal } from './faq-topic-modal';

const TOPIC: AdminFaqTopic = {
  id: '2',
  key: 'ratings',
  nameEs: 'Valoraciones',
  nameEn: 'Ratings',
  icon: 'thumbs-up-outline',
  sortOrder: 2,
};

describe('FaqTopicModal', () => {
  let fixture: ComponentFixture<FaqTopicModal>;
  const dismiss = vi.fn().mockResolvedValue(true);
  const action = vi.fn();

  function render(): FaqTopicModal {
    TestBed.configureTestingModule({
      imports: [FaqTopicModal],
      providers: [
        provideAppTransloco(),
        provideIonicAngular(),
        { provide: ModalController, useValue: { dismiss } },
      ],
    });
    fixture = TestBed.createComponent(FaqTopicModal);
    Object.assign(fixture.componentInstance, { topic: TOPIC, action });
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    action.mockResolvedValue(undefined);
  });

  it('starts from the topic, with the app header and one card per icon', () => {
    const modal = render();
    const root = fixture.nativeElement as HTMLElement;

    expect(modal.nameEs()).toBe('Valoraciones');
    expect(modal.nameEn()).toBe('Ratings');
    expect(modal.icon()).toBe('thumbs-up-outline');
    expect(modal.isValid()).toBe(true);
    expect(root.querySelector('ion-title')?.textContent).toContain('Editar tema');
    expect(root.querySelectorAll('ion-radio').length).toBeGreaterThan(1);
    expect(root.querySelector('ion-radio[aria-label="thumbs-up-outline"]')).not.toBeNull();
  });

  it('saves the trimmed names and the chosen icon', async () => {
    const modal = render();
    modal.nameEs.set('  Reseñas ');
    modal.nameEn.set(' Reviews ');
    modal.handleIcon('chatbubbles-outline');

    await modal.handleConfirm();

    expect(action).toHaveBeenCalledWith({
      nameEs: 'Reseñas',
      nameEn: 'Reviews',
      icon: 'chatbubbles-outline',
    });
    expect(dismiss).toHaveBeenCalledWith(null, 'confirm');
  });

  it('ignores an icon that Help cannot show', () => {
    const modal = render();
    modal.handleIcon('unknown');
    modal.handleIcon(3);

    expect(modal.icon()).toBe('thumbs-up-outline');
  });

  it('does not save without both names', async () => {
    const modal = render();
    modal.nameEn.set('   ');

    expect(modal.isValid()).toBe(false);
    await modal.handleConfirm();
    expect(action).not.toHaveBeenCalled();
  });

  it('keeps the window open with the error when saving fails', async () => {
    const modal = render();
    action.mockRejectedValue(new ApiError('VALIDATION_FAILED', 400));

    await modal.handleConfirm();
    fixture.detectChanges();

    expect(dismiss).not.toHaveBeenCalled();
    expect(modal.errorMessage()).not.toBeNull();
    expect(modal.isSaving()).toBe(false);
    const alert = (fixture.nativeElement as HTMLElement).querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
  });

  it('closes without saving, also with the ✕', async () => {
    render();
    const header = (fixture.nativeElement as HTMLElement).querySelector('app-modal-header form');
    header?.dispatchEvent(new Event('submit'));

    expect(dismiss).toHaveBeenCalledWith(null, 'cancel');
  });

  it('opens as a dialog and tells whether it was saved', async () => {
    const present = vi.fn().mockResolvedValue(undefined);
    const create = vi.fn().mockResolvedValue({
      present,
      onDidDismiss: vi.fn().mockResolvedValue({ role: 'cancel' }),
    });
    const options = { topic: TOPIC, action };

    const saved = await openFaqTopicModal({ create } as unknown as ModalController, options);

    expect(saved).toBe(false);
    expect(create).toHaveBeenCalledWith({
      component: FaqTopicModal,
      cssClass: 'info-dialog',
      componentProps: options,
    });
    expect(present).toHaveBeenCalled();
  });
});
