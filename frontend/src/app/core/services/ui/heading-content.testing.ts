import { TestBed } from '@angular/core/testing';
import { HeadingContentService } from './heading-content.service';

// En los tests de una pantalla: pinta la franja del título que ha dejado en
// HeadingContentService (la cabecera que la pinta de verdad no está en el test)
export function renderHeadingContent(): HTMLElement {
  const template = TestBed.inject(HeadingContentService).content();
  const host = document.createElement('div');
  if (!template) {
    return host;
  }
  const view = template.createEmbeddedView({});
  view.detectChanges();
  for (const node of view.rootNodes as Node[]) {
    host.appendChild(node);
  }
  return host;
}
