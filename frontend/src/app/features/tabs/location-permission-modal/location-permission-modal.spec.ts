import { TestBed } from '@angular/core/testing';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { LocationService } from '../../../core/services/location/location.service';
import { LocationPermissionModal } from './location-permission-modal';

describe('LocationPermissionModal', () => {
  const dismiss = vi.fn().mockResolvedValue(true);
  const getCurrentPoint = vi.fn();

  function render(): LocationPermissionModal {
    TestBed.configureTestingModule({
      imports: [LocationPermissionModal],
      providers: [
        provideIonicAngular(),
        { provide: ModalController, useValue: { dismiss } },
        { provide: LocationService, useValue: { getCurrentPoint } },
      ],
    });
    const fixture = TestBed.createComponent(LocationPermissionModal);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('asks for the location (that asks for the permission) and closes, even if denied', async () => {
    getCurrentPoint.mockRejectedValue(new Error('denied'));

    await render().handleAllow();

    expect(getCurrentPoint).toHaveBeenCalled();
    expect(dismiss).toHaveBeenCalledWith(null, 'allowed');
  });

  it('closes for later', async () => {
    await render().handleLater();

    expect(dismiss).toHaveBeenCalledWith(null, 'later');
  });
});
