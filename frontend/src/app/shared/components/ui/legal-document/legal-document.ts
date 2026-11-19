import {
  Component,
  effect,
  ElementRef,
  inject,
  input,
  OnInit,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { IonSpinner } from '@ionic/angular';
import { translate, TRANSLOCO_TRANSPILER, TranslocoService } from '@jsverse/transloco';
import {
  LegalDocumentsService,
  LegalDocumentType,
  LegalDocumentView,
} from '../../../../core/services/users/legal-documents.service';
import { LegalChanges } from '../legal-changes/legal-changes';

// La versión vigente de un texto legal (del backend), con «Qué ha cambiado»
// encima: en su ventana (LegalModal) o como un paso dentro de otra (p. ej.
// «Uso de la ubicación» dentro de «Usar mi ubicación», sin abrir otra hoja)
@Component({
  selector: 'app-legal-document',
  imports: [IonSpinner, LegalChanges],
  templateUrl: './legal-document.html',
  styleUrl: './legal-document.scss',
})
export class LegalDocumentText implements OnInit {
  private readonly legalDocuments = inject(LegalDocumentsService);
  private readonly transpiler = inject(TRANSLOCO_TRANSPILER, { optional: true });
  private readonly transloco = this.transpiler
    ? inject(TranslocoService, { optional: true })
    : null;

  readonly type = input.required<LegalDocumentType>();
  // Solo si a quien lo muestra le importa saber que se ha leído hasta el final
  readonly isEndTracked = input(false);
  readonly reachedEnd = output<void>();

  readonly current = signal<LegalDocumentView | null>(null);
  readonly hasError = signal(false);
  private readonly endMarker = viewChild<ElementRef<HTMLElement>>('endMarker');

  constructor() {
    effect((onCleanup) => {
      const marker = this.endMarker()?.nativeElement;
      if (!marker || !this.isEndTracked()) {
        return;
      }
      const observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          observer.disconnect();
          this.reachedEnd.emit();
        }
      });
      observer.observe(marker);
      onCleanup(() => observer.disconnect());
    });
  }

  changesHeading(version: string): string {
    if (this.transloco) {
      return this.transloco.translate('common.legal.changesInVersion', { version });
    }
    return translate('screens.legalDocument.haCambiadoVersion', { version });
  }

  get errorMessage(): string {
    if (this.transloco) {
      return this.transloco.translate('common.legal.loadError');
    }
    return translate('screens.legalDocument.hemosPodidoCargarTexto');
  }

  get loadingAriaLabel(): string {
    if (this.transloco) {
      return this.transloco.translate('common.legal.loadingAria');
    }
    return translate('screens.legalDocument.cargandoTexto');
  }

  ngOnInit(): void {
    void this.loadContent();
  }

  // Si no se puede cargar (p. ej. sin conexión), se muestra un aviso
  private async loadContent(): Promise<void> {
    try {
      this.current.set(await this.legalDocuments.getCurrent(this.type()));
    } catch {
      this.hasError.set(true);
    }
  }
}
