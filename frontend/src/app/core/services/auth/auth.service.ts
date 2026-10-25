import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiError } from '../../models/api-error.model';
import { AccessToken, LoginRequest, RegisterRequest, VerifyEmailRequest } from '../../models/auth.model';
import { Profile, User } from '../../models/user.model';
import { PreferencesPlugin } from '../../plugins/preferences-plugin';

const REFRESH_TOKEN_KEY = 'auth.refresh-token';
const REFRESH_LOCK_NAME = 'carpooling-ual.auth-refresh';
const SESSION_ENDED_CODE = 'INVALID_REFRESH_TOKEN';
// Correo pendiente de verificar, entre el registro (o el login) y la pantalla
// del código. En sessionStorage y no en la URL: es un dato personal y la URL
// queda en el historial y en los registros. Dura lo que la pestaña
const PENDING_EMAIL_KEY = 'auth.pending-verification-email';

// Sesión del usuario contra /api/auth.
// - El token de acceso (15 min) solo vive en memoria; el de renovación se
//   guarda (Preferences) para recuperar la sesión al volver a abrir la app.
// - El token de renovación es de un solo uso y el backend cierra la sesión si
//   se reutiliza uno ya usado. Por eso hay una sola renovación a la vez: las
//   peticiones simultáneas comparten la misma y, en la web, las pestañas se
//   turnan con la Web Locks API y cada una lee el último token guardado.
// Los métodos lanzan ApiError (ver shared/utils/error-message.util.ts).
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly preferences = inject(PreferencesPlugin);
  private readonly authUrl = `${environment.apiUrl}/auth`;

  private readonly user = signal<User | null>(null);
  private accessToken: string | null = null;
  private pendingRefresh: Promise<string> | null = null;

  readonly currentUser = this.user.asReadonly();
  readonly isLoggedIn = computed(() => this.user() !== null);

  hasProfile(profile: Profile): boolean {
    return this.user()?.profiles.includes(profile) ?? false;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  // Crea la cuenta; no inicia sesión: queda el correo pendiente de verificar
  async register(request: RegisterRequest): Promise<User> {
    const user = await this.send(this.http.post<User>(`${this.authUrl}/register`, request));
    this.setPendingVerificationEmail(request.email);
    return user;
  }

  // Verifica el correo con el código enviado; si es correcto, abre la sesión
  async verifyEmail(request: VerifyEmailRequest): Promise<User> {
    const token = await this.send(this.http.post<AccessToken>(`${this.authUrl}/verify-email`, request));
    await this.startSession(token);
    sessionStorage.removeItem(PENDING_EMAIL_KEY);
    return token.user;
  }

  getPendingVerificationEmail(): string | null {
    return sessionStorage.getItem(PENDING_EMAIL_KEY);
  }

  setPendingVerificationEmail(email: string): void {
    sessionStorage.setItem(PENDING_EMAIL_KEY, email);
  }

  // Pide un código nuevo (anula el anterior). La API responde lo mismo exista o
  // no el correo y como mucho envía uno por minuto
  resendVerificationCode(email: string): Promise<void> {
    return this.send(this.http.post<void>(`${this.authUrl}/verify-email/resend`, { email }));
  }

  async login(request: LoginRequest): Promise<User> {
    const token = await this.send(this.http.post<AccessToken>(`${this.authUrl}/login`, request));
    await this.startSession(token);
    return token.user;
  }

  // Cierra la sesión en este dispositivo y anula el token en el servidor. Si
  // el servidor no responde (sin conexión), la sesión local ya está cerrada.
  async logout(): Promise<void> {
    const refreshToken = await this.preferences.get(REFRESH_TOKEN_KEY);
    await this.endSession();
    if (refreshToken) {
      await this.send(this.http.post<void>(`${this.authUrl}/logout`, { refreshToken })).catch(() => undefined);
    }
  }

  // Al arrancar la app: si hay un token de renovación guardado, recupera la
  // sesión (la respuesta trae el usuario). Si no se puede, se sigue sin sesión.
  async restoreSession(): Promise<void> {
    if (await this.preferences.get(REFRESH_TOKEN_KEY)) {
      await this.refreshAccessToken().catch(() => undefined);
    }
  }

  // Devuelve un token de acceso nuevo. Las llamadas simultáneas comparten la
  // misma renovación.
  refreshAccessToken(): Promise<string> {
    this.pendingRefresh ??= this.refreshInTurn().finally(() => {
      this.pendingRefresh = null;
    });
    return this.pendingRefresh;
  }

  private refreshInTurn(): Promise<string> {
    const locks = globalThis.navigator?.locks;
    return locks ? locks.request(REFRESH_LOCK_NAME, () => this.refresh()) : this.refresh();
  }

  private async refresh(): Promise<string> {
    // Se lee dentro del turno: si otra pestaña acaba de renovar, es el suyo
    const refreshToken = await this.preferences.get(REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      await this.endSession();
      throw new ApiError(SESSION_ENDED_CODE, 401);
    }
    try {
      const token = await this.send(this.http.post<AccessToken>(`${this.authUrl}/refresh`, { refreshToken }));
      await this.startSession(token);
      return token.accessToken;
    } catch (error) {
      // Sesión caducada o anulada: hay que volver a iniciar sesión. Con otros
      // errores (p. ej. sin conexión) se conserva para reintentarlo después.
      if (error instanceof ApiError && error.code === SESSION_ENDED_CODE) {
        await this.endSession();
      }
      throw error;
    }
  }

  private async startSession(token: AccessToken): Promise<void> {
    this.accessToken = token.accessToken;
    await this.preferences.set(REFRESH_TOKEN_KEY, token.refreshToken);
    this.user.set(token.user);
  }

  private async endSession(): Promise<void> {
    this.accessToken = null;
    this.user.set(null);
    await this.preferences.remove(REFRESH_TOKEN_KEY);
  }

  private async send<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw ApiError.fromHttpError(error);
    }
  }
}
