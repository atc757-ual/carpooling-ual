import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { ApiError } from '../../../core/models/api-error.model';
import { TripLiveShareService } from '../../../core/services/trips/trip-live-share.service';
import { TripShareService } from '../../../core/services/trips/trip-share.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { TripLiveShare } from './trip-live-share';

const LINK = 'https://app/seguir/abc';

describe('TripLiveShare', () => {
  let fixture: ComponentFixture<TripLiveShare>;
  const liveShare = {
    getActiveLink: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
  const share = vi.fn();
  const toast = { showError: vi.fn(), showSuccess: vi.fn() };

  async function render(activeLink: string | null): Promise<void> {
    liveShare.getActiveLink.mockResolvedValue(activeLink);
    fixture = TestBed.createComponent(TripLiveShare);
    fixture.componentRef.setInput('tripId', 't1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function buttonWithText(text: string): HTMLElement {
    const buttons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('ion-button'),
    );
    const button = buttons.find((candidate) => candidate.textContent?.includes(text));
    if (!button) {
      throw new Error(`No button with «${text}»`);
    }
    return button;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    share.mockResolvedValue('shared');
    TestBed.configureTestingModule({
      imports: [TripLiveShare],
      providers: [
        provideIonicAngular(),
        { provide: TripLiveShareService, useValue: liveShare },
        { provide: TripShareService, useValue: { share } },
        { provide: ToastService, useValue: toast },
      ],
    });
  });

  it('creates a link and sends it', async () => {
    await render(null);
    liveShare.start.mockResolvedValue(LINK);

    await fixture.componentInstance.handleStart();
    fixture.detectChanges();

    expect(liveShare.start).toHaveBeenCalledWith('t1');
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: LINK }));
    expect(buttonWithText('Dejar de compartir')).toBeTruthy();
  });

  it('shows the sharing state of a remembered link and sends it again', async () => {
    await render(LINK);

    expect(fixture.nativeElement.textContent).toContain('Compartiendo en directo');
    await fixture.componentInstance.handleResend();
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: LINK }));
  });

  it('stops sharing', async () => {
    await render(LINK);
    liveShare.stop.mockResolvedValue(undefined);

    await fixture.componentInstance.handleStop();
    fixture.detectChanges();

    expect(liveShare.stop).toHaveBeenCalledWith('t1');
    expect(toast.showSuccess).toHaveBeenCalled();
    expect(buttonWithText('Compartir mi viaje en directo')).toBeTruthy();
  });

  it('shows the API error', async () => {
    await render(null);
    liveShare.start.mockRejectedValue(new ApiError('SHARE_NOT_ALLOWED', 409));

    await fixture.componentInstance.handleStart();

    expect(toast.showError).toHaveBeenCalledWith(
      'Solo puedes compartir el viaje desde que tienes la plaza aceptada hasta que termina.',
    );
    expect(share).not.toHaveBeenCalled();
  });

  it('does nothing to resend without a link', async () => {
    await render(null);

    await fixture.componentInstance.handleResend();

    expect(share).not.toHaveBeenCalled();
  });
});
