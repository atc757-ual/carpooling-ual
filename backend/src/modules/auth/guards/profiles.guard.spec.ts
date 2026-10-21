import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedRequest } from '../../../shared/auth/access-token-payload';
import { Profiles } from '../../../shared/auth/profiles.decorator';
import type { ProfileType } from '../../users/profile-type';
import { ProfileRequiredError } from '../../../shared/auth/profile-required.error';
import { ProfilesGuard } from './profiles.guard';

// Controller de ejemplo: sus métodos llevan las mismas etiquetas que los reales
class SampleController {
  anyUser(this: void): void {}

  @Profiles('admin')
  adminOnly(this: void): void {}

  @Profiles('driver', 'passenger')
  driverOrPassenger(this: void): void {}
}

@Profiles('admin')
class SampleAdminController {
  everything(this: void): void {}
}

describe('ProfilesGuard', () => {
  const guard = new ProfilesGuard(new Reflector());

  function contextFor(
    profiles: ProfileType[],
    handler: () => void,
    controller: object = SampleController,
  ): ExecutionContext {
    const request = { user: { sub: 'user-1', profiles } };
    return {
      switchToHttp: () => ({
        getRequest: () => request as unknown as AuthenticatedRequest,
      }),
      getHandler: () => handler,
      getClass: () => controller,
    } as unknown as ExecutionContext;
  }

  const routes = SampleController.prototype;

  it('lets any authenticated user through a route without @Profiles', () => {
    expect(guard.canActivate(contextFor([], routes.anyUser))).toBe(true);
  });

  it('lets an admin through an admin route', () => {
    expect(guard.canActivate(contextFor(['admin'], routes.adminOnly))).toBe(
      true,
    );
  });

  it('rejects a driver on an admin route with PROFILE_REQUIRED (403)', () => {
    const check = (): boolean =>
      guard.canActivate(contextFor(['driver', 'passenger'], routes.adminOnly));

    expect(check).toThrow(ProfileRequiredError);
    expect(check).toThrow('This action requires one of the profiles: admin');
  });

  it('only requires ONE of the listed profiles', () => {
    expect(
      guard.canActivate(contextFor(['passenger'], routes.driverOrPassenger)),
    ).toBe(true);
    expect(() =>
      guard.canActivate(contextFor(['admin'], routes.driverOrPassenger)),
    ).toThrow(ProfileRequiredError);
  });

  it('applies @Profiles on the controller to all its routes', () => {
    const everything = SampleAdminController.prototype.everything;

    expect(() =>
      guard.canActivate(
        contextFor(['driver'], everything, SampleAdminController),
      ),
    ).toThrow(ProfileRequiredError);
    expect(
      guard.canActivate(
        contextFor(['admin'], everything, SampleAdminController),
      ),
    ).toBe(true);
  });
});
