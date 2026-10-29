import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { Vehicle } from '../../../core/models/driver.model';
import { PreferencesPlugin } from '../../../core/plugins/preferences-plugin';
import { AuthService } from '../../../core/services/auth/auth.service';
import { DEFAULT_VEHICLE_KEY, VehiclePicker, VehiclePickerControls } from './vehicle-picker';

function vehicle(id: string, capacity = 3): Vehicle {
  return { id, plate: `${id}BCD`, model: 'Seat Ibiza', capacity, status: 'available' };
}

describe('VehiclePicker', () => {
  let fixture: ComponentFixture<VehiclePicker>;
  let picker: VehiclePicker;
  let controls: VehiclePickerControls;
  let preferences: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> };
  let refreshAccessToken: ReturnType<typeof vi.fn>;

  async function render(vehicles: Vehicle[], defaultId: string | null = null): Promise<void> {
    preferences = {
      get: vi.fn().mockResolvedValue(defaultId),
      set: vi.fn().mockResolvedValue(undefined),
    };
    refreshAccessToken = vi.fn().mockResolvedValue('t');
    TestBed.configureTestingModule({
      imports: [VehiclePicker],
      providers: [
        provideIonicAngular(),
        { provide: PreferencesPlugin, useValue: preferences },
        { provide: AuthService, useValue: { hasProfile: () => false, refreshAccessToken } },
      ],
    });
    controls = {
      vehicleId: new FormControl('', { nonNullable: true }),
      seats: new FormControl(1, { nonNullable: true }),
    };
    fixture = TestBed.createComponent(VehiclePicker);
    fixture.componentRef.setInput('vehicles', vehicles);
    fixture.componentRef.setInput('controls', controls);
    picker = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    // La lectura del predeterminado (Preferences) no la espera whenStable
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
  }

  function dismissWith(role: string, data?: Vehicle): void {
    vi.spyOn(TestBed.inject(ModalController), 'create').mockResolvedValue({
      present: vi.fn().mockResolvedValue(undefined),
      onWillDismiss: () => Promise.resolve({ role, data }),
    } as unknown as HTMLIonModalElement);
  }

  it('chooses the first vehicle when there is no default on this device', async () => {
    await render([vehicle('1111'), vehicle('2222')]);

    expect(controls.vehicleId.value).toBe('1111');
  });

  it('chooses the default vehicle saved on this device', async () => {
    await render([vehicle('1111'), vehicle('2222')], '2222');

    expect(controls.vehicleId.value).toBe('2222');
  });

  it('remembers the chosen one as the default and keeps the seats within its own', async () => {
    await render([vehicle('1111', 4), vehicle('2222', 1)]);
    controls.seats.setValue(3);

    picker.handleSelect(vehicle('2222', 1));
    TestBed.tick();

    expect(preferences.set).toHaveBeenCalledWith(DEFAULT_VEHICLE_KEY, '2222');
    expect(picker.maxSeats()).toBe(1);
    expect(controls.seats.value).toBe(1);
  });

  it('registers a vehicle, chooses it and gets the driver profile with the first one', async () => {
    await render([]);
    dismissWith('saved', vehicle('3333'));

    await picker.handleAdd();
    TestBed.tick();

    expect(refreshAccessToken).toHaveBeenCalled();
    expect(picker.vehicles()).toEqual([vehicle('3333')]);
    expect(controls.vehicleId.value).toBe('3333');
  });

  it('updates the seats of an edited vehicle and drops a removed one', async () => {
    await render([vehicle('1111'), vehicle('2222')]);
    dismissWith('saved', vehicle('1111', 2));

    await picker.handleEdit(vehicle('1111'));

    expect(picker.vehicles()[0].capacity).toBe(2);

    dismissWith('removed');
    await picker.handleEdit(vehicle('1111'));
    TestBed.tick();

    expect(picker.vehicles().map(({ id }) => id)).toEqual(['2222']);
    expect(controls.vehicleId.value).toBe('2222');
  });

  it('stops offering to add vehicles at 3', async () => {
    await render([vehicle('1111'), vehicle('2222'), vehicle('3333')]);
    const root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();

    expect(picker.canAdd()).toBe(false);
    expect(root.querySelector('.vehicle-card--add')).toBeNull();
  });
});
