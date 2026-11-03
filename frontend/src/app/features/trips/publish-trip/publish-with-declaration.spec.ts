import { ModalController } from '@ionic/angular';
import { vi } from 'vitest';
import { ApiError } from '../../../core/models/api-error.model';
import { PublishTripRequest } from '../../../core/models/driver.model';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { publishWithVehicleDeclaration } from './publish-with-declaration';

const REQUEST = { vehicleId: 'v1' } as PublishTripRequest;
const TRIP = { id: 't1' };

function apiError(code: string): ApiError {
  return new ApiError(code, 409);
}

describe('publishWithVehicleDeclaration', () => {
  let driver: Record<string, ReturnType<typeof vi.fn>>;
  let create: ReturnType<typeof vi.fn>;

  function publishWith(role: string): Promise<unknown> {
    create = vi.fn().mockResolvedValue({
      present: vi.fn().mockResolvedValue(undefined),
      onWillDismiss: () => Promise.resolve({ role }),
    });
    return publishWithVehicleDeclaration(
      {
        driver: driver as unknown as DriverService,
        modalController: { create } as unknown as ModalController,
      },
      REQUEST,
    );
  }

  beforeEach(() => {
    driver = {
      publishTrip: vi.fn().mockResolvedValue(TRIP),
      acceptVehicleDeclaration: vi.fn().mockResolvedValue({ id: 'v1', isDeclared: true }),
    };
  });

  it('publishes directly when the vehicle declaration is up to date', async () => {
    await expect(publishWith('accept')).resolves.toBe(TRIP);
    expect(create).not.toHaveBeenCalled();
  });

  it('asks for the vehicle declaration, records it and publishes again', async () => {
    driver['publishTrip'].mockRejectedValueOnce(apiError('VEHICLE_DECLARATION_REQUIRED'));

    await expect(publishWith('accept')).resolves.toBe(TRIP);
    expect(driver['acceptVehicleDeclaration']).toHaveBeenCalledWith('v1');
    expect(driver['publishTrip']).toHaveBeenCalledTimes(2);
  });

  it('keeps the error when the driver closes the declaration', async () => {
    driver['publishTrip'].mockRejectedValueOnce(apiError('VEHICLE_DECLARATION_REQUIRED'));

    await expect(publishWith('backdrop')).rejects.toBeInstanceOf(ApiError);
    expect(driver['acceptVehicleDeclaration']).not.toHaveBeenCalled();
  });

  it('does not open the declaration for other errors', async () => {
    driver['publishTrip'].mockRejectedValueOnce(apiError('TRIP_OVERLAP'));

    await expect(publishWith('accept')).rejects.toBeInstanceOf(ApiError);
    expect(create).not.toHaveBeenCalled();
  });
});
