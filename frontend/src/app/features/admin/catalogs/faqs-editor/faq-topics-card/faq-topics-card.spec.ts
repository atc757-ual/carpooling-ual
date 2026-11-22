import { provideAppTransloco } from '../../../../../core/i18n/testing-transloco';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { AdminFaqTopic } from '../../../../../core/models/admin-faq.model';
import { ApiError } from '../../../../../core/models/api-error.model';
import { AdminFaqsService } from '../../../../../core/services/admin/admin-faqs.service';
import { ToastService } from '../../../../../core/services/ui/toast.service';
import { FaqTopicsCard } from './faq-topics-card';

const TOPICS: AdminFaqTopic[] = [
  {
    id: '2',
    key: 'ratings',
    nameEs: 'Valoraciones',
    nameEn: 'Ratings',
    icon: 'star',
    sortOrder: 2,
  },
  { id: '1', key: 'search', nameEs: 'Buscar', nameEn: 'Search', icon: 'search', sortOrder: 1 },
];

describe('FaqTopicsCard', () => {
  let fixture: ComponentFixture<FaqTopicsCard>;
  const updateTopic = vi.fn();
  const moveTopic = vi.fn();
  const showSuccess = vi.fn();
  const showError = vi.fn();
  const onDidDismiss = vi.fn();
  const create = vi.fn();
  const changed = vi.fn();

  function render(): FaqTopicsCard {
    TestBed.configureTestingModule({
      imports: [FaqTopicsCard],
      providers: [
        provideAppTransloco(),
        provideIonicAngular(),
        { provide: AdminFaqsService, useValue: { updateTopic, moveTopic } },
        { provide: ToastService, useValue: { showSuccess, showError } },
        { provide: ModalController, useValue: { create } },
      ],
    });
    fixture = TestBed.createComponent(FaqTopicsCard);
    fixture.componentRef.setInput('topics', TOPICS);
    fixture.componentInstance.changed.subscribe(changed);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    create.mockResolvedValue({ present: vi.fn().mockResolvedValue(undefined), onDidDismiss });
    moveTopic.mockResolvedValue({});
    updateTopic.mockResolvedValue({});
  });

  it('lists the topics in the order of Help, with their two names', () => {
    const card = render();
    const root = fixture.nativeElement as HTMLElement;
    const names = [...root.querySelectorAll('.faq-topics__name')].map((el) =>
      el.textContent?.trim(),
    );

    expect(names).toEqual(['Buscar', 'Valoraciones']);
    expect(root.querySelector('[lang="en"]')?.textContent).toContain('Search');
    expect(card.rows().map((row) => [row.canMoveUp, row.canMoveDown])).toEqual([
      [false, true],
      [true, false],
    ]);
  });

  it('moves a topic and asks to reload', async () => {
    const card = render();

    const moving = card.handleMove(TOPICS[0], 'up');
    expect(card.busyKey()).toBe('ratings');
    await moving;

    expect(moveTopic).toHaveBeenCalledWith('ratings', 'up');
    expect(changed).toHaveBeenCalledTimes(1);
    expect(card.busyKey()).toBeNull();
  });

  it('shows the error when moving fails', async () => {
    const card = render();
    moveTopic.mockRejectedValue(new ApiError('INTERNAL_ERROR', 500));

    await card.handleMove(TOPICS[1], 'down');

    expect(showError).toHaveBeenCalled();
    expect(changed).not.toHaveBeenCalled();
    expect(card.busyKey()).toBeNull();
  });

  it('edits a topic in its window and saves through the API', async () => {
    const card = render();
    onDidDismiss.mockResolvedValue({ role: 'confirm' });

    await card.handleEdit(TOPICS[0]);

    const { componentProps } = create.mock.calls[0][0];
    expect(componentProps.topic).toBe(TOPICS[0]);
    await componentProps.action({ nameEs: 'Reseñas', nameEn: 'Reviews', icon: 'star' });
    expect(updateTopic).toHaveBeenCalledWith('ratings', {
      nameEs: 'Reseñas',
      nameEn: 'Reviews',
      icon: 'star',
    });
    expect(showSuccess).toHaveBeenCalledWith('Cambios guardados.');
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the window is closed without saving', async () => {
    const card = render();
    onDidDismiss.mockResolvedValue({ role: 'cancel' });

    await card.handleEdit(TOPICS[1]);

    expect(showSuccess).not.toHaveBeenCalled();
    expect(changed).not.toHaveBeenCalled();
  });
});
