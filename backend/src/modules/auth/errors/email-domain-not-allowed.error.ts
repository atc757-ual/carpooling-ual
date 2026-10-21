import { BusinessError } from '../../../shared/errors/business-error';

// Error de negocio: el correo no pertenece a un dominio permitido (UAL).
// La capa API lo traduce a un 400 con el código EMAIL_DOMAIN_NOT_ALLOWED
export class EmailDomainNotAllowedError extends BusinessError {
  constructor(readonly domain: string) {
    super(
      'EMAIL_DOMAIN_NOT_ALLOWED',
      'invalid',
      `The email domain ${domain} is not allowed`,
    );
  }
}
