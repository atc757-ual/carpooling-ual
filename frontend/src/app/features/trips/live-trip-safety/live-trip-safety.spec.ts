import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { TripShareService } from '../../../core/services/trips/trip-share.service';
import { LiveTripSafety } from './live-trip-safety';

const SHARE_TEXT = 'Voy en un viaje compartido de la UAL: Roquetas → Campus';

describe('LiveTripSafety', () => {
  let fixture: ComponentFixture<LiveTripSafety>;
  let share: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    share = vi.fn().mockResolvedValue('shared');
    TestBed.configureTestingModule({
      imports: [LiveTripSafety],
      providers: [provideIonicAngular(), { provide: TripShareService, useValue: { share } }],
    });
    fixture = TestBed.createComponent(LiveTripSafety);
    fixture.componentRef.setInput('shareText', SHARE_TEXT);
    fixture.detectChanges();
  });

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

  it('shares the trip text with someone the user trusts', () => {
    buttonWithText('Compartir viaje').click();

    expect(share).toHaveBeenCalledWith({
      title: 'Mi viaje en Carpooling UAL',
      text: SHARE_TEXT,
    });
  });

  it('opens the phone app with the emergency number', () => {
    expect(buttonWithText('Llamar al 112').getAttribute('href')).toBe('tel:112');
  });

  it('offers the live link to the passenger instead of the text', () => {
    fixture.componentRef.setInput('liveShareTripId', 't1');
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('app-trip-live-share')).not.toBeNull();
    expect(root.textContent).not.toContain('Compartir viaje');
    expect(buttonWithText('Llamar al 112').getAttribute('href')).toBe('tel:112');
  });
});
