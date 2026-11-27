import { provideAppTransloco } from '../../../core/i18n/testing-transloco';
import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { GivenReview, TripReviewsService } from '../../../core/services/users/trip-reviews.service';
import { TripReviewCard } from './trip-review-card';

const TARGETS = [
  { id: 'p1', name: 'Mario' },
  { id: 'p2', name: 'Lucía' },
];

const review = (targetId: string, rating: number): GivenReview =>
  ({
    id: `rev-${targetId}`,
    trip: { id: 't1' },
    target: { id: targetId, name: targetId },
    targetRole: 'passenger',
    rating,
    comment: null,
    isPublished: false,
    createdAt: '2026-11-17T10:00:00Z',
  }) as GivenReview;

// El conductor valora a sus pasajeros de uno en uno (al terminar el viaje)
describe('TripReviewCard', () => {
  async function render(
    options: {
      given?: GivenReview[];
      isCarded?: boolean;
      isStepped?: boolean;
      pendingIds?: string[];
    } = {},
  ) {
    const reviews = {
      listGiven: vi.fn().mockResolvedValue(options.given ?? []),
      listPending: vi.fn().mockResolvedValue([
        {
          trip: { id: 't1' },
          targets: (options.pendingIds ?? TARGETS.map(({ id }) => id)).map((id) => ({ id })),
        },
      ]),
      create: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        provideAppTransloco(),
        provideIonicAngular(),
        { provide: TripReviewsService, useValue: reviews },
      ],
    });
    const fixture = TestBed.createComponent(TripReviewCard);
    fixture.componentRef.setInput('tripId', 't1');
    fixture.componentRef.setInput('targets', TARGETS);
    fixture.componentRef.setInput('targetRole', 'passenger');
    fixture.componentRef.setInput('isStepped', options.isStepped ?? true);
    fixture.componentRef.setInput('isCarded', options.isCarded ?? false);
    fixture.componentRef.setInput('title', 'Valora a tus pasajeros');
    const steps: unknown[] = [];
    const done = vi.fn();
    fixture.componentInstance.stepChange.subscribe((step) => steps.push(step));
    fixture.componentInstance.stepsDone.subscribe(done);
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, card: fixture.componentInstance, steps, done };
  }

  it('asks for one passenger at a time and tells where it is («1 de 2»)', async () => {
    const { fixture, card, steps } = await render({ isCarded: true });
    const root = fixture.nativeElement as HTMLElement;

    expect(card.currentStep()).toMatchObject({ number: 1, total: 2, target: { id: 'p1' } });
    expect(steps.at(-1)).toEqual({ number: 1, total: 2 });
    expect(root.textContent).toContain('Valora a tus pasajeros');
    expect(root.textContent).toContain('1 de 2');
    expect(root.textContent).toContain('¿Qué tal con Mario?');
    expect(root.textContent).not.toContain('¿Qué tal con Lucía?');
  });

  it('moves on after sending or skipping and sums up at the end', async () => {
    const { fixture, card, steps, done } = await render();

    card.handleSent('p1', review('p1', 4));
    fixture.detectChanges();
    expect(card.currentStep()).toMatchObject({ number: 2, target: { id: 'p2' } });

    card.handleSkip('p2');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(card.currentStep()).toBeNull();
    expect(steps.at(-1)).toBeNull();
    expect(done).toHaveBeenCalled();
    expect(card.hasSentHere()).toBe(true);

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Tus valoraciones');
    // La nota, en palabras junto a sus medallas (ya no «4 · Genial»)
    expect(root.querySelector('.trip-review-card__summary-verdict')?.textContent).toContain(
      'Genial',
    );
    expect(root.textContent).toContain('Más tarde, en el viaje');
    expect(root.textContent).toContain('¡Gracias por valorar!');
  });

  it('shows the summary straight away when everyone was already reviewed', async () => {
    const { card, done } = await render({ given: [review('p1', 5), review('p2', 3)] });

    expect(card.currentStep()).toBeNull();
    expect(done).toHaveBeenCalled();
    expect(card.hasSentHere()).toBe(false);
  });

  it('shows existing reviews and pending forms together outside stepped mode', async () => {
    const published = { ...review('p1', 5), isPublished: true, comment: 'Buen viaje' };
    const { fixture } = await render({
      given: [published],
      isStepped: false,
      pendingIds: ['p2'],
    });
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('Tu valoración de Mario ya está publicada.');
    expect(root.textContent).toContain('Buen viaje');
    expect(root.querySelectorAll('app-trip-review-form')).toHaveLength(1);
  });

  it('explains unpublished and expired reviews in non-stepped mode', async () => {
    const { fixture } = await render({
      given: [review('p1', 4)],
      isStepped: false,
      pendingIds: [],
    });
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('Se publicará cuando Mario también valore o en 7 días.');
    expect(root.textContent).toContain('Sin comentario');
    expect(root.textContent).toContain(
      'El plazo para valorar a Lucía terminó (7 días tras llegar).',
    );
  });
});
