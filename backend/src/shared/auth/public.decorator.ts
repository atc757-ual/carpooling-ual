import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// Toda la API exige token de acceso por defecto (guard JWT global). @Public()
// marca una ruta como abierta: registro, login, health… Así, si a un endpoint
// nuevo se le olvida indicarlo, queda protegido y no abierto
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);
