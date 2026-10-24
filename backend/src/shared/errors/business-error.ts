// Tipo de fallo en lenguaje de negocio (no HTTP). El filtro TMF630 de la capa
// API lo traduce al status HTTP: invalid → 400, unauthorized → 401,
// forbidden → 403, not_found → 404, conflict → 409
export type BusinessErrorKind =
  'invalid' | 'unauthorized' | 'forbidden' | 'not_found' | 'conflict';

// Base de todos los errores de negocio de los services. Cada error declara su
// código (el "code" de TMF630, documentado en docs/api/errors.md) y su tipo de
// fallo; así un error nuevo funciona sin tocar el filtro
export abstract class BusinessError extends Error {
  protected constructor(
    readonly code: string,
    readonly kind: BusinessErrorKind,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
