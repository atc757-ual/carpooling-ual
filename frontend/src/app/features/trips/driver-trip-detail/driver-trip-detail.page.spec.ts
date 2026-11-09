import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonSpinner,
  provideIonicAngular,
} from '@ionic/angular';
import { vi } from 'vitest';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { DriverTripDetailPage } from './driver-trip-detail.page';

describe('DriverTripDetailPage', () => {
  let fixture: ComponentFixture<DriverTripDetailPage>;
  let listMyTrips: ReturnType<typeof vi.fn>;

  async function render(trips: () => Promise<{ id: string }[]>): Promise<HTMLElement> {
    listMyTrips = vi.fn().mockImplementation(trips);
    TestBed.configureTestingModule({
      imports: [DriverTripDetailPage],
      providers: [provideIonicAngular(), { provide: DriverService, useValue: { listMyTrips } }],
    });
    // La tarjeta completa tiene sus propios tests
    TestBed.overrideComponent(DriverTripDetailPage, {
      set: {
        imports: [IonButton, IonCard, IonCardContent, IonContent, IonSpinner],
        schemas: [CUSTOM_ELEMENTS_SCHEMA],
      },
    });
    fixture = TestBed.createComponent(DriverTripDetailPage);
    fixture.componentRef.setInput('id', 't1');
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the full card of the trip in the route', async () => {
    const root = await render(() => Promise.resolve([{ id: 't2' }, { id: 't1' }]));

    expect(fixture.componentInstance.trip()?.id).toBe('t1');
    expect(root.querySelector('app-driver-trip-card')).not.toBeNull();
  });

  it('says so when the trip is not among those of the driver', async () => {
    const root = await render(() => Promise.resolve([{ id: 't2' }]));

    expect(root.querySelector('app-driver-trip-card')).toBeNull();
    expect(root.textContent).toContain('No hemos podido cargar este viaje');
  });

  it('offers to retry after an error and loads it again', async () => {
    const root = await render(() => Promise.reject(new Error('down')));
    expect(root.textContent).toContain('No hemos podido cargar este viaje');

    listMyTrips.mockResolvedValue([{ id: 't1' }]);
    fixture.componentInstance.handleReload();
    await fixture.whenStable();

    expect(root.querySelector('app-driver-trip-card')).not.toBeNull();
  });
});
