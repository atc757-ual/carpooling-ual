import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { ApiError } from '../../../core/models/api-error.model';
import { TripReviewsService } from '../../../core/services/users/trip-reviews.service';
import { isThumbUp, THUMB_DOWN_RATING, THUMB_UP_RATING, TripReviewForm } from './trip-review-form';

describe('TripReviewForm', () => {
  let create: ReturnType<typeof vi.fn>;

  function render(canSkip = false) {
    create = vi.fn().mockResolvedValue({ id: 'rev1' });
    TestBed.configureTestingModule({
      providers: [provideIonicAngular(), { provide: TripReviewsService, useValue: { create } }],
    });
    const fixture = TestBed.createComponent(TripReviewForm);
    fixture.componentRef.setInput('tripId', 't1');
    fixture.componentRef.setInput('targetId', 'd1');
    fixture.componentRef.setInput('targetName', 'Lucía');
    fixture.componentRef.setInput('canSkip', canSkip);
    fixture.detectChanges();
    return fixture;
  }

  it('asks with a thumb up or down and sends it with the comment', async () => {
    const fixture = render();
    const form = fixture.componentInstance;
    const sent = vi.fn();
    form.sent.subscribe(sent);
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('¿Qué tal con Lucía?');
    expect(root.querySelectorAll('[role="radio"]')).toHaveLength(2);

    await form.handleSend();
    expect(create).not.toHaveBeenCalled();

    (root.querySelector('[role="radio"]') as HTMLButtonElement).click();
    form.comment.set('  Muy puntual  ');
    await form.handleSend();

    expect(create).toHaveBeenCalledWith('t1', {
      targetId: 'd1',
      rating: THUMB_UP_RATING,
      comment: 'Muy puntual',
    });
    expect(sent).toHaveBeenCalledWith({ id: 'rev1' });
  });

  it('takes an existing review as sent, and shows any other error', async () => {
    const fixture = render(true);
    const form = fixture.componentInstance;
    const sent = vi.fn();
    form.sent.subscribe(sent);
    form.rating.set(THUMB_DOWN_RATING);

    create.mockRejectedValueOnce(new ApiError('REVIEW_ALREADY_EXISTS', 409));
    await form.handleSend();
    expect(sent).toHaveBeenCalledWith(null);

    create.mockRejectedValueOnce(new Error('down'));
    await form.handleSend();
    expect(form.error()).toBeTruthy();
    expect(form.isSending()).toBe(false);
  });

  it('lets skip only when allowed', () => {
    const root = render(true).nativeElement as HTMLElement;
    expect(root.textContent).toContain('Ahora no');
    expect(isThumbUp(4)).toBe(true);
    expect(isThumbUp(2)).toBe(false);
  });
});
