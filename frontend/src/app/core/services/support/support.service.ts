import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiError } from '../../models/api-error.model';

// De qué trata el mensaje (los mismos que la API)
export type SupportTopic = 'trip' | 'account' | 'bug' | 'suggestion' | 'other';

// Límites del mensaje, los mismos que la API
export const SUPPORT_MESSAGE_MIN_LENGTH = 20;
export const SUPPORT_MESSAGE_MAX_LENGTH = 1000;

// «Ayuda y soporte»: el mensaje llega por correo al equipo de soporte, que
// responde al correo del usuario. Lanza ApiError
@Injectable({ providedIn: 'root' })
export class SupportService {
  private readonly http = inject(HttpClient);

  async sendMessage(topic: SupportTopic, message: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post<void>(`${environment.apiUrl}/support/messages`, { topic, message }),
      );
    } catch (error) {
      throw ApiError.fromHttpError(error);
    }
  }
}
