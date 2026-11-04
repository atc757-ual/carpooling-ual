import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ActiveModeService } from '../../../core/services/users/active-mode.service';
import { PushOpenPage } from './push-open.page';

describe('PushOpenPage', () => {
  it('opens the screen of the pressed push without staying in the history', async () => {
    const navigateByUrl = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      imports: [PushOpenPage],
      providers: [
        provideIonicAngular(),
        { provide: Router, useValue: { navigateByUrl } },
        { provide: AuthService, useValue: { hasProfile: () => true } },
        { provide: ActiveModeService, useValue: { mode: () => 'driver', setMode: vi.fn() } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap({ type: 'chat_message', tripId: 't1' }) },
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(PushOpenPage);
    fixture.detectChanges();

    await vi.waitFor(() =>
      expect(navigateByUrl).toHaveBeenCalledWith('/tabs/messages/t1', { replaceUrl: true }),
    );
  });
});
