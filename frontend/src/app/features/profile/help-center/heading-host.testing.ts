import { NgTemplateOutlet } from '@angular/common';
import { Component, inject } from '@angular/core';
import { HeadingContentService } from '../../../core/services/ui/heading-content.service';

// Solo para los tests: pinta la plantilla que la pantalla pone en la franja
// fija (en la app la pinta la cabecera de las pestañas)
@Component({
  selector: 'app-heading-host',
  imports: [NgTemplateOutlet],
  template: `<ng-container [ngTemplateOutlet]="content()" />`,
})
export class HeadingHost {
  readonly content = inject(HeadingContentService).content;
}
