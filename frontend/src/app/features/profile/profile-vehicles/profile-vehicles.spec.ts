import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { Vehicle } from '../../../core/models/driver.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { ProfileVehicles } from './profile-vehicles';
import { ConfirmService } from '../../../core/services/ui/confirm.service';

function vehicle(id: string, status: Vehicle['status'], model: string | null): Vehicle {
  return { id, plate: `${id}BCD`, model, capacity: 3, status };
}

describe('ProfileVehicles', () => {
  let fixture: ComponentFixture<ProfileVehicles>;
  let listVehicles: ReturnType<typeof vi.fn>;
  const deactivateVehicle = vi.fn().mockResolvedValue(undefined);
  const showError = vi.fn().mockResolvedValue(undefined);

  async function render(list: () => Promise<Vehicle[]>): Promise<HTMLElement> {
    listVehicles = vi.fn().mockImplementation(list);
    TestBed.configureTestingModule({
      imports: [ProfileVehicles],
      providers: [
        provideIonicAngular(),
        { provide: DriverService, useValue: { listVehicles, deactivateVehicle } },
        { provide: AuthService, useValue: { hasProfile: () => true } },
        { provide: ToastService, useValue: { showError } },
      ],
    });
    fixture = TestBed.createComponent(ProfileVehicles);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  function dismissWith(role: string): ReturnType<typeof vi.spyOn> {
    return vi.spyOn(TestBed.inject(ModalController), 'create').mockResolvedValue({
      present: vi.fn().mockResolvedValue(undefined),
      onDidDismiss: () => Promise.resolve({ role }),
    } as unknown as HTMLIonModalElement);
  }

  it('lists the vehicles in use with their model and seats', async () => {
    const root = await render(() =>
      Promise.resolve([
        vehicle('1234', 'available', 'Seat León'),
        vehicle('5678', 'on_trip', null),
        vehicle('9999', 'inactive', 'Fiat Punto'),
      ]),
    );

    expect(root.querySelectorAll('.profile-vehicle')).toHaveLength(2);
    expect(root.textContent).toContain('Seat León · hasta 3 pasajeros');
    expect(root.textContent).not.toContain('9999BCD');
  });

  it('invites to register one when there are none', async () => {
    const root = await render(() => Promise.resolve([]));

    expect(root.textContent).toContain('Aún no tienes vehículos');
    expect(root.textContent).toContain('Registrar vehículo');
  });

  it('edits a vehicle and reloads the list when it is saved', async () => {
    await render(() => Promise.resolve([vehicle('1234', 'available', null)]));
    const create = dismissWith('saved');

    await fixture.componentInstance.handleOpen(fixture.componentInstance.activeVehicles()[0]);
    await fixture.whenStable();

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        componentProps: { vehicle: expect.objectContaining({ id: '1234' }) },
      }),
    );
    expect(listVehicles).toHaveBeenCalledTimes(2);
  });

  it('does not reload when the window is closed without saving', async () => {
    await render(() => Promise.resolve([]));
    dismissWith('backdrop');

    await fixture.componentInstance.handleOpen(null);

    expect(listVehicles).toHaveBeenCalledTimes(1);
  });

  it('removes a vehicle after confirming it, and shows the API error', async () => {
    await render(() => Promise.resolve([vehicle('1234', 'available', null)]));
    const [item] = fixture.componentInstance.activeVehicles();
    const confirm = (role: string): void => {
      vi.spyOn(TestBed.inject(ConfirmService), 'ask').mockResolvedValue(role === 'destructive');
    };

    confirm('cancel');
    await fixture.componentInstance.handleRemove(item);
    expect(deactivateVehicle).not.toHaveBeenCalled();

    confirm('destructive');
    await fixture.componentInstance.handleRemove(item);
    expect(deactivateVehicle).toHaveBeenCalledWith('1234');

    deactivateVehicle.mockRejectedValueOnce(new Error('in use'));
    confirm('destructive');
    await fixture.componentInstance.handleRemove(item);
    expect(showError).toHaveBeenCalled();
  });

  it('offers to retry when they cannot be loaded', async () => {
    const root = await render(() => Promise.reject(new Error('down')));

    expect(root.textContent).toContain('No hemos podido cargar tus vehículos');
  });
});
