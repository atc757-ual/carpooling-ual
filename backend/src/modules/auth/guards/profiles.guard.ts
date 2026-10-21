import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedRequest } from '../../../shared/auth/access-token-payload';
import { PROFILES_KEY } from '../../../shared/auth/profiles.decorator';
import type { ProfileType } from '../../users/profile-type';
import { ProfileRequiredError } from '../../../shared/auth/profile-required.error';

// Guard global que se ejecuta DESPUÉS del JWT (RNF-04): si la ruta tiene
// @Profiles(...), exige que el token incluya al menos uno de esos perfiles.
// Los perfiles se leen del token, sin consultar la base de datos: retirar un
// perfil se nota en la siguiente renovación (como mucho 15 minutos)
@Injectable()
export class ProfilesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredProfiles = this.reflector.getAllAndOverride<
      ProfileType[] | undefined
    >(PROFILES_KEY, [context.getHandler(), context.getClass()]);
    if (requiredProfiles === undefined || requiredProfiles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const hasProfile = requiredProfiles.some((profile) =>
      user.profiles.includes(profile),
    );
    if (!hasProfile) {
      throw new ProfileRequiredError(requiredProfiles);
    }
    return true;
  }
}
