import { TestBed } from '@angular/core/testing';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { provideTestingTransloco } from '../../../../core/i18n/testing-transloco';
import { ProfileSupportModal } from '../../profile-support-modal/profile-support-modal';
import { HelpSupportCard } from './help-support-card';

describe('HelpSupportCard', () => {
  it('opens the support form in a window', async () => {
    const present = vi.fn().mockResolvedValue(undefined);
    const create = vi.fn().mockResolvedValue({ present });
    TestBed.configureTestingModule({
      imports: [HelpSupportCard],
      providers: [
        provideIonicAngular(),
        provideTestingTransloco(),
        { provide: ModalController, useValue: { create } },
      ],
    });
    const fixture = TestBed.createComponent(HelpSupportCard);
    fixture.detectChanges();

    await fixture.componentInstance.handleOpenSupport();

    expect(create).toHaveBeenCalledWith({
      component: ProfileSupportModal,
      cssClass: 'info-dialog',
    });
    expect(present).toHaveBeenCalled();
  });
});
