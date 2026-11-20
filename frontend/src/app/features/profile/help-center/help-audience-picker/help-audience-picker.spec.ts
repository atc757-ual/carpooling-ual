import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { provideTestingTransloco } from '../../../../core/i18n/testing-transloco';
import { HelpAudience } from '../../../../core/models/faq.model';
import { HelpAudienceService } from '../../../../core/services/help/help-audience.service';
import { HelpAudiencePicker } from './help-audience-picker';

describe('HelpAudiencePicker', () => {
  function render(): { root: HTMLElement; audience: ReturnType<typeof signal<HelpAudience>> } {
    const audience = signal<HelpAudience>('passenger');
    TestBed.configureTestingModule({
      imports: [HelpAudiencePicker],
      providers: [
        provideIonicAngular(),
        provideTestingTransloco(),
        {
          provide: HelpAudienceService,
          useValue: { audience, select: (value: HelpAudience) => audience.set(value) },
        },
      ],
    });
    const fixture = TestBed.createComponent(HelpAudiencePicker);
    fixture.detectChanges();
    return { root: fixture.nativeElement as HTMLElement, audience };
  }

  function segment(root: HTMLElement): HTMLIonSegmentElement {
    return root.querySelector('ion-segment') as HTMLIonSegmentElement;
  }

  it('offers passenger and driver as a segment, with the chosen one marked', () => {
    const { root } = render();

    const buttons = root.querySelectorAll<HTMLIonSegmentButtonElement>('ion-segment-button');
    expect([...buttons].map((button) => button.value)).toEqual(['passenger', 'driver']);
    expect(segment(root).value).toBe('passenger');
    expect(segment(root).getAttribute('aria-labelledby')).toBe('help-audience-legend');
  });

  it('chooses the other one when it is picked and ignores anything else', () => {
    const { root, audience } = render();

    segment(root).dispatchEvent(new CustomEvent('ionChange', { detail: { value: 'driver' } }));
    expect(audience()).toBe('driver');

    segment(root).dispatchEvent(new CustomEvent('ionChange', { detail: { value: 'admin' } }));
    expect(audience()).toBe('driver');
  });
});
