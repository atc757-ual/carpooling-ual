import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { provideAppTransloco } from '../../../../core/i18n/testing-transloco';
import { ScrollHint } from '../../../directives/scroll-hint.directive';
import { ScrollHintButton } from './scroll-hint';

@Component({
  imports: [ScrollHint, ScrollHintButton],
  template: `<div appScrollHint #hint="scrollHint">
    <p>Mario</p>
    <app-scroll-hint [target]="hint" />
  </div>`,
})
class HostComponent {}

describe('ScrollHintButton', () => {
  it('shows «Desliza para ver más» only while there is content below', () => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideAppTransloco(), provideIonicAngular()],
    });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const hint = fixture.debugElement.children[0].injector.get(ScrollHint);
    expect(root.querySelector('.scroll-hint')).toBeNull();

    hint.canScrollDown.set(true);
    fixture.detectChanges();
    const button = root.querySelector<HTMLButtonElement>('.scroll-hint');
    expect(button?.textContent).toContain('Desliza para ver más');

    const scrollDown = vi.spyOn(hint, 'scrollDown').mockImplementation(() => undefined);
    button?.click();
    expect(scrollDown).toHaveBeenCalled();
  });
});
