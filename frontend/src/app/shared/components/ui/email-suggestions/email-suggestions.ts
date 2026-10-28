import { Component, computed, effect, input, signal, untracked } from '@angular/core';
import { FormControl } from '@angular/forms';
import { environment } from '../../../../../environments/environment';
import { ComboboxState } from '../combobox/combobox';

// Para quién es cada dominio (se muestra al lado de la sugerencia)
const DOMAIN_AUDIENCES: Readonly<Record<string, string>> = {
  'inlumine.ual.es': 'Estudiantes',
  'ual.es': 'Personal',
};

// Primero el de los estudiantes, que son la mayoría
const DOMAINS = [...environment.allowedEmailDomains].sort(
  (a, b) => Number(b === 'inlumine.ual.es') - Number(a === 'inlumine.ual.es'),
);

export interface EmailSuggestion {
  email: string;
  audience: string;
}

// Sugerencias del correo de la UAL bajo su campo: mientras se escribe la parte
// de antes de la «@», ofrece completarla con cada dominio admitido (solo los
// que encajan con lo que ya se haya escrito tras la «@»). Al elegir una, o al
// escribir el correo entero, desaparecen. Se usa en el login, el registro y la
// recuperación de la contraseña. El campo lleva autocomplete="off" por
// accesibilidad: el desplegable del navegador se pondría encima de esta lista,
// se quedaría con las flechas y el lector de pantalla anunciaría dos listas a
// la vez (no se puede estilar ni detectar). Las contraseñas conservan el suyo:
// <ion-input [appCombobox]="suggestions.combobox" …>
// <app-email-suggestions #suggestions [control]="form.controls.email" />
@Component({
  selector: 'app-email-suggestions',
  templateUrl: './email-suggestions.html',
  styleUrl: './email-suggestions.scss',
})
export class EmailSuggestions {
  readonly control = input.required<FormControl<string>>();

  // Lo escrito en el campo, como signal (el formulario no lo es)
  private readonly email = signal('');

  readonly suggestions = computed<EmailSuggestion[]>(() => {
    const email = this.email().trim().toLowerCase();
    const at = email.indexOf('@');
    const localPart = at < 0 ? email : email.slice(0, at);
    const typedDomain = at < 0 ? '' : email.slice(at + 1);
    if (localPart === '' || /\s/.test(localPart)) {
      return [];
    }
    const suggestions = DOMAINS.filter((domain) => domain.startsWith(typedDomain)).map(
      (domain) => ({ email: `${localPart}@${domain}`, audience: DOMAIN_AUDIENCES[domain] ?? '' }),
    );
    // Ya está completo: no hay nada que sugerir
    return suggestions.some((suggestion) => suggestion.email === email) ? [] : suggestions;
  });

  constructor() {
    effect((onCleanup) => {
      const control = this.control();
      this.email.set(control.value);
      const subscription = control.valueChanges.subscribe((value) => this.email.set(value));
      onCleanup(() => subscription.unsubscribe());
    });
    // Con sugerencias, el correo está a medio escribir: el campo no se marca
    // en rojo hasta que se complete o se salga de él
    effect(() => {
      if (this.suggestions().length > 0) {
        untracked(() => this.control().markAsUntouched());
      }
    });
  }

  // Para el campo (appCombobox): elegir con el teclado
  readonly combobox = new ComboboxState(
    () => this.suggestions().length,
    (index) => this.handleChoose(this.suggestions()[index].email),
  );

  handleChoose(email: string): void {
    const control = this.control();
    control.setValue(email);
    control.markAsDirty();
  }
}
