import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiError } from '../../models/api-error.model';

export type LegalDocumentType = 'terms' | 'privacy';

// La versión vigente de un documento (HTML ya saneado por el backend)
export interface LegalDocumentView {
  type: LegalDocumentType;
  version: string;
  content: string;
  publishedAt: string | null;
}

export interface PendingLegalDocument {
  type: LegalDocumentType;
  version: string;
}

export const LEGAL_DOCUMENT_TITLES: Readonly<Record<LegalDocumentType, string>> = {
  terms: 'Condiciones de uso',
  privacy: 'Política de privacidad',
};

// Documentos legales con versiones: el texto vigente (también sin sesión, al
// registrarse) y las versiones nuevas que el usuario tiene que aceptar.
// Lanza ApiError
@Injectable({ providedIn: 'root' })
export class LegalDocumentsService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  getCurrent(type: LegalDocumentType): Promise<LegalDocumentView> {
    return this.call(this.http.get<LegalDocumentView>(`${this.api}/legal-documents/${type}`));
  }

  // Las vigentes que aún no ha aceptado (tras publicar una versión nueva)
  pending(): Promise<PendingLegalDocument[]> {
    return this.call(
      this.http.get<PendingLegalDocument[]>(`${this.api}/users/me/legal-documents/pending`),
    );
  }

  async accept({ type, version }: PendingLegalDocument): Promise<void> {
    await this.call(
      this.http.post<void>(`${this.api}/users/me/legal-acceptances`, { type, version }),
    );
  }

  private async call<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw ApiError.fromHttpError(error);
    }
  }
}
