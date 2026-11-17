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

  it('offers passenger and driver as radio buttons, with the chosen one marked', () => {
    const { root } = render();

    const inputs = root.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    expect(inputs).toHaveLength(2);
    expect(inputs[0].checked).toBe(true);
    expect(root.querySelectorAll('.audience-picker__option--selected')).toHaveLength(1);
  });

  it('chooses the other one when it is picked', () => {
    const { root, audience } = render();

    root.querySelectorAll<HTMLInputElement>('input[type="radio"]')[1].click();

    expect(audience()).toBe('driver');
  });
});
