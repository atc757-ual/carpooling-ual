import { ModalController } from '@ionic/angular';
import { vi } from 'vitest';
import { ApiError } from '../../core/models/api-error.model';
import { DriverService } from '../../core/services/drivers/driver.service';
import { withDeclarations } from './with-declarations';

const TRIP = { id: 't1' };

function apiError(code: string): ApiError {
  return new ApiError(code, 409);
}

describe('withDeclarations', () => {
  let driver: Record<string, ReturnType<typeof vi.fn>>;
  let create: ReturnType<typeof vi.fn>;
  let action: ReturnType<typeof vi.fn<() => Promise<unknown>>>;

  function runWith(role: string): Promise<unknown> {
    create = vi.fn().mockResolvedValue({
      present: vi.fn().mockResolvedValue(undefined),
      onWillDismiss: () => Promise.resolve({ role }),
    });
    return withDeclarations(
      {
        driver: driver as unknown as DriverService,
        modalController: { create } as unknown as ModalController,
      },
      'v1',
      action,
    );
  }

  beforeEach(() => {
    driver = {
      acceptDeclaration: vi.fn().mockResolvedValue({ hasLicenseDeclared: true }),
      acceptVehicleDeclaration: vi.fn().mockResolvedValue({ id: 'v1', isDeclared: true }),
    };
    action = vi.fn<() => Promise<unknown>>().mockResolvedValue(TRIP);
  });

  it('runs the action directly when the declarations are up to date', async () => {
    await expect(runWith('accept')).resolves.toBe(TRIP);
    expect(create).not.toHaveBeenCalled();
  });

  it('renews the vehicle declaration and tries again', async () => {
    action.mockRejectedValueOnce(apiError('VEHICLE_DECLARATION_REQUIRED'));

    await expect(runWith('accept')).resolves.toBe(TRIP);
    expect(driver['acceptVehicleDeclaration']).toHaveBeenCalledWith('v1');
    expect(action).toHaveBeenCalledTimes(2);
  });

  it('renews both declarations, the driver one first', async () => {
    action
      .mockRejectedValueOnce(apiError('DRIVER_DECLARATION_REQUIRED'))
      .mockRejectedValueOnce(apiError('VEHICLE_DECLARATION_REQUIRED'));

    await expect(runWith('accept')).resolves.toBe(TRIP);
    expect(driver['acceptDeclaration']).toHaveBeenCalled();
    expect(driver['acceptVehicleDeclaration']).toHaveBeenCalledWith('v1');
    expect(create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ componentProps: { document: 'driver_declaration' } }),
    );
    expect(action).toHaveBeenCalledTimes(3);
  });

  it('keeps the error when the driver closes the declaration', async () => {
    action.mockRejectedValueOnce(apiError('DRIVER_DECLARATION_REQUIRED'));

    await expect(runWith('backdrop')).rejects.toBeInstanceOf(ApiError);
    expect(driver['acceptDeclaration']).not.toHaveBeenCalled();
  });

  it('does not open a declaration for other errors nor loop forever', async () => {
    action.mockRejectedValueOnce(apiError('TRIP_OVERLAP'));
    await expect(runWith('accept')).rejects.toBeInstanceOf(ApiError);
    expect(create).not.toHaveBeenCalled();

    action.mockRejectedValue(apiError('VEHICLE_DECLARATION_REQUIRED'));
    await expect(runWith('accept')).rejects.toBeInstanceOf(ApiError);
    expect(driver['acceptVehicleDeclaration']).toHaveBeenCalledTimes(2);
  });
});
