import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HeadingContentService } from '../../core/services/ui/heading-content.service';
import { HeadingContent } from './heading-content.directive';

@Component({
  imports: [HeadingContent],
  template: `@if (isShown()) {
    <ng-template appHeadingContent><h1>Usuarios</h1></ng-template>
  }`,
})
class HostPage {
  readonly isShown = signal(true);
}

describe('HeadingContent', () => {
  it('puts its template in the title strip while it lives and removes it after', () => {
    const fixture = TestBed.createComponent(HostPage);
    const heading = TestBed.inject(HeadingContentService);

    fixture.detectChanges();
    TestBed.tick();
    expect(heading.content()).not.toBeNull();
    // Sin buscador, se desplaza con el contenido
    expect(heading.isFixed()).toBe(false);

    fixture.componentInstance.isShown.set(false);
    fixture.detectChanges();
    expect(heading.content()).toBeNull();
  });
});
