import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { provideAppTransloco } from '../../../../core/i18n/testing-transloco';
import { UsualTrip } from '../../../../core/models/usual-trip.model';
import { ToastService } from '../../../../core/services/ui/toast.service';
import { UsualTripService } from '../usual-trip.service';
import { UsualTripModal } from './usual-trip-modal';

const TRIP: UsualTrip = {
  place: { id: 'p1', name: 'Roquetas de Mar', locality: 'Roquetas', coordinates: [-2.6, 36.76] },
  parking: { id: 'P1', name: 'Parking P1' },
  weekdays: [3],
  arrivalTime: '08:00',
  returnTime: null,
  margin: 20,
  seats: 1,
};

describe('UsualTripModal', () => {
  let fixture: ComponentFixture<UsualTripModal>;
  const save = vi.fn().mockResolvedValue(undefined);
  const remove = vi.fn().mockResolvedValue(undefined);
  const dismiss = vi.fn().mockResolvedValue(true);
  const showSuccess = vi.fn().mockResolvedValue(undefined);

  function render(trip: UsualTrip, isNew: boolean): HTMLElement {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [UsualTripModal],
      providers: [
        provideAppTransloco(),
        provideIonicAngular(),
        { provide: UsualTripService, useValue: { save, remove } },
        { provide: ModalController, useValue: { dismiss } },
        { provide: ToastService, useValue: { showSuccess } },
      ],
    });
    fixture = TestBed.createComponent(UsualTripModal);
    fixture.componentInstance.trip = trip;
    fixture.componentInstance.isNew = isNew;
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('saves a new route with its days, its arrival and its way back', async () => {
    const root = render(TRIP, true);
    expect(root.textContent).toContain('Roquetas de Mar → Parking P1');
    expect(root.textContent).toContain('solo en este dispositivo');
    expect(root.textContent).not.toContain('Borrar mi trayecto');
    const modal = fixture.componentInstance;

    modal.weekdays.set([1, 3]);
    modal.form.patchValue({ hasReturn: true, returnTime: '15:00' });
    await modal.handleSave();

    expect(save).toHaveBeenCalledWith({ ...TRIP, weekdays: [1, 3], returnTime: '15:00' });
    expect(showSuccess).toHaveBeenCalledWith('Hemos guardado tu trayecto.');
    expect(dismiss).toHaveBeenCalledWith(null, 'saved');
  });

  it('does not save without days or with the way back before arriving', async () => {
    const root = render(TRIP, true);
    const modal = fixture.componentInstance;

    modal.weekdays.set([]);
    fixture.detectChanges();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('al menos un día');
    await modal.handleSave();

    modal.weekdays.set([1]);
    modal.form.patchValue({ hasReturn: true, returnTime: '07:00' });
    fixture.detectChanges();
    expect(modal.isReturnTooEarly()).toBe(true);
    await modal.handleSave();

    expect(save).not.toHaveBeenCalled();
  });

  it('edits a saved route and can delete it', async () => {
    const root = render({ ...TRIP, returnTime: '14:00' }, false);
    const modal = fixture.componentInstance;
    expect(modal.form.controls.hasReturn.value).toBe(true);
    expect(root.textContent).toContain('Borrar mi trayecto');

    await modal.handleRemove();

    expect(remove).toHaveBeenCalled();
    expect(dismiss).toHaveBeenCalledWith(null, 'removed');
  });
});
