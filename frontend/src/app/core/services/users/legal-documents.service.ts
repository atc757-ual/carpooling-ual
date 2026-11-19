import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiError } from '../../models/api-error.model';
import { lazyLabels } from '../../i18n/lazy-labels';

export type LegalDocumentType =
  'terms' | 'privacy' | 'driver_declaration' | 'vehicle_declaration' | 'location';

// El español es el que vale; el inglés es una traducción
export type LegalLang = 'es' | 'en';

// major: hay que volver a aceptarla; minor: solo se avisa
export type LegalChangeType = 'major' | 'minor';

// La versión vigente de un documento (HTML ya saneado por el backend), con
// su tipo de cambio y «Qué ha cambiado»
export interface LegalDocumentView {
  type: LegalDocumentType;
  version: string;
  // El idioma del texto: el de la app o, si aún no está traducido, es
  lang: LegalLang;
  content: string;
  changeType: LegalChangeType;
  summary: string | null;
  publishedAt: string | null;
}

export interface PendingLegalDocument {
  type: LegalDocumentType;
  version: string;
}

export const LEGAL_DOCUMENT_TITLES: Readonly<Record<LegalDocumentType, string>> = lazyLabels({
  terms: 'screens.legalDocuments.terms',
  privacy: 'screens.legalDocuments.privacy',
  driver_declaration: 'screens.legalDocuments.driverDeclaration',
  vehicle_declaration: 'screens.legalDocuments.vehicleDeclaration',
  location: 'screens.legalDocuments.location',
});

// Documentos legales con versiones: el texto vigente (también sin sesión, al
// registrarse) y las versiones nuevas que el usuario tiene que aceptar.
// Lanza ApiError
@Injectable({ providedIn: 'root' })
export class LegalDocumentsService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;
  private readonly transloco = inject(TranslocoService, { optional: true });

  // En el idioma de la app (el backend da el español si no hay traducción)
  getCurrent(type: LegalDocumentType): Promise<LegalDocumentView> {
    const lang: LegalLang = this.transloco?.getActiveLang() === 'en' ? 'en' : 'es';
    return this.call(
      this.http.get<LegalDocumentView>(`${this.api}/legal-documents/${type}`, {
        params: { lang },
      }),
    );
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
