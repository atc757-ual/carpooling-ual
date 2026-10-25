import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { environment } from '../../../environments/environment';

// Correo de un dominio admitido (environment.allowedEmailDomains). Solo mira
// el dominio: el formato lo comprueba Validators.email y el vacío,
// Validators.required. Devuelve { ualEmail: true } si el dominio no vale.
// Mismo criterio que el backend: el dominio entero, sin subdominios ajenos
// («fakeual.es» o «ual.es.otro.com» no pasan)
export function ualEmailValidator(
  allowedDomains: readonly string[] = environment.allowedEmailDomains,
): ValidatorFn {
  return (control: AbstractControl<string>): ValidationErrors | null => {
    const email = control.value?.trim() ?? '';
    const at = email.lastIndexOf('@');
    if (at < 0) {
      return null;
    }
    const domain = email.slice(at + 1).toLowerCase();
    return allowedDomains.includes(domain) ? null : { ualEmail: true };
  };
}
