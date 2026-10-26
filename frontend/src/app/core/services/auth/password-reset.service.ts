import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiError } from '../../models/api-error.model';

// Recuperar la contraseña con el código enviado al correo (RF-26), en tres
// pantallas: correo → código → contraseña nueva. El correo y el código pasan
// de una pantalla a otra solo en memoria (nunca en la URL ni guardados): si se
// recarga la página, se vuelve a empezar. Los métodos lanzan ApiError
@Injectable({ providedIn: 'root' })
export class PasswordResetService {
  private readonly http = inject(HttpClient);
  private readonly resetUrl = `${environment.apiUrl}/auth/password-reset`;

  private readonly emailSignal = signal('');
  // El código ya comprobado, que la API vuelve a pedir con la contraseña nueva
  private readonly code = signal('');

  readonly email = this.emailSignal.asReadonly();
  readonly hasVerifiedCode = computed(() => this.code() !== '');

  // La API responde igual exista o no la cuenta: no se sabe si se ha enviado
  async requestCode(email: string): Promise<void> {
    await this.send(this.http.post<void>(this.resetUrl, { email }));
    this.emailSignal.set(email);
    this.code.set('');
  }

  resendCode(): Promise<void> {
    return this.requestCode(this.email());
  }

  // Comprueba el código sin gastarlo y lo guarda para el último paso
  async checkCode(code: string): Promise<void> {
    await this.send(this.http.post<void>(`${this.resetUrl}/verify`, { email: this.email(), code }));
    this.code.set(code);
  }

  // Cambia la contraseña (la API cierra todas las sesiones) y olvida el correo
  // y el código
  async resetPassword(password: string): Promise<void> {
    await this.send(
      this.http.post<void>(`${this.resetUrl}/confirm`, {
        email: this.email(),
        code: this.code(),
        password,
      }),
    );
    this.emailSignal.set('');
    this.code.set('');
  }

  private async send<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw ApiError.fromHttpError(error);
    }
  }
}
