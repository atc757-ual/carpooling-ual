import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiError } from '../../models/api-error.model';
import { LegalDocumentType } from '../users/legal-documents.service';

// Una versión de un documento legal en el panel (borrador o publicada)
export interface AdminLegalDocument {
  id: string;
  type: LegalDocumentType;
  version: string;
  content: string;
  status: 'draft' | 'published';
  publishedAt: string | null;
  updatedAt: string;
}

// Documentos legales en el panel: el historial de versiones y un borrador por
// documento que se edita y se publica. Lanza ApiError
@Injectable({ providedIn: 'root' })
export class AdminLegalDocumentsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/admin/legal-documents`;

  // Todas las versiones del documento, la más reciente primero
  versions(type: LegalDocumentType): Promise<AdminLegalDocument[]> {
    return this.call(
      this.http.get<AdminLegalDocument[]>(this.url, { params: { type, limit: 100 } }),
    );
  }

  saveDraft(type: LegalDocumentType, content: string): Promise<AdminLegalDocument> {
    return this.call(this.http.put<AdminLegalDocument>(`${this.url}/${type}/draft`, { content }));
  }

  publish(type: LegalDocumentType): Promise<AdminLegalDocument> {
    return this.call(this.http.post<AdminLegalDocument>(`${this.url}/${type}/draft/publish`, {}));
  }

  private async call<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw ApiError.fromHttpError(error);
    }
  }
}
