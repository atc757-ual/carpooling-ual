import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { provideAppTransloco } from '../../../../core/i18n/testing-transloco';
import { ApiError } from '../../../../core/models/api-error.model';
import { TripParticipantsService } from '../../../../core/services/trips/trip-participants.service';
import { CoPassengers } from './co-passengers';

describe('CoPassengers', () => {
  // jsdom no tiene ResizeObserver
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn();
        disconnect = vi.fn();
      },
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  let listCoPassengers: ReturnType<typeof vi.fn>;

  async function render(tripId: string | null): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [CoPassengers],
      providers: [
        provideAppTransloco(),
        provideIonicAngular(),
        { provide: TripParticipantsService, useValue: { listCoPassengers } },
      ],
    });
    const fixture = TestBed.createComponent(CoPassengers);
    fixture.componentRef.setInput('tripId', tripId);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    listCoPassengers = vi.fn().mockResolvedValue([
      { id: 'u2', name: 'Mario', avatarKey: null },
      { id: 'u3', name: 'Ana', avatarKey: 'sun' },
    ]);
  });

  it('lists whom the passenger travels with, by first name', async () => {
    const root = await render('t1');

    expect(listCoPassengers).toHaveBeenCalledWith('t1');
    expect(root.querySelector('h3')?.textContent?.trim()).toBe('Viajan contigo');
    const names = [...root.querySelectorAll('li')].map((item) => item.textContent?.trim());
    expect(names).toEqual(['Mario', 'Ana']);
  });

  it('does not ask for them without a seat', async () => {
    const root = await render(null);

    expect(listCoPassengers).not.toHaveBeenCalled();
    expect(root.querySelector('section')).toBeNull();
  });

  it('shows nothing when the passenger travels alone', async () => {
    listCoPassengers.mockResolvedValue([]);
    const root = await render('t1');

    expect(root.querySelector('section')).toBeNull();
  });

  it('shows nothing when they cannot be loaded', async () => {
    listCoPassengers.mockRejectedValue(new ApiError('PARTICIPANT_PROFILE_FORBIDDEN', 403));
    const root = await render('t1');

    expect(root.querySelector('section')).toBeNull();
  });
});
