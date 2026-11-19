import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { alertCircleOutline } from 'ionicons/icons';
import { EmptyState, EmptyStateRole, EmptyStateTone } from './empty-state';

@Component({
  imports: [EmptyState],
  template: `
    <app-empty-state
      [icon]="icon"
      [heading]="heading()"
      [hint]="hint()"
      [role]="role()"
      [isCard]="isCard()"
      [tone]="tone()"
      [headingLevel]="headingLevel()"
    >
      @if (hasTop()) {
        <p emptyStateTop class="test-top">Aviso</p>
      }
      @if (hasAction()) {
        <button class="test-action" type="button">Reintentar</button>
      }
    </app-empty-state>
  `,
})
class Host {
  readonly icon = alertCircleOutline;
  readonly heading = signal('No se ha podido cargar');
  readonly hint = signal<string | null>(null);
  readonly role = signal<EmptyStateRole | null>(null);
  readonly isCard = signal(false);
  readonly tone = signal<EmptyStateTone>('info');
  readonly headingLevel = signal<1 | 2 | null>(null);
  readonly hasTop = signal(false);
  readonly hasAction = signal(false);
}

describe('EmptyState', () => {
  function render(changes: (host: Host) => void = () => undefined): HTMLElement {
    const fixture = TestBed.createComponent(Host);
    changes(fixture.componentInstance);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the icon and the title, without hint, card, role or heading', () => {
    const root = render();
    const host = root.querySelector('app-empty-state') as HTMLElement;

    expect(root.querySelector('.empty-state__icon')).not.toBeNull();
    expect(root.querySelector('div.empty-state__title')?.textContent).toBe(
      'No se ha podido cargar',
    );
    expect(root.querySelector('.text-color-muted')).toBeNull();
    expect(root.querySelector('ion-card')).toBeNull();
    expect(root.querySelector('h1, h2')).toBeNull();
    expect(host.hasAttribute('role')).toBe(false);
  });

  it('shows the hint, the projected action and the notice on top', () => {
    const root = render((host) => {
      host.hint.set('Comprueba tu conexión.');
      host.hasAction.set(true);
      host.hasTop.set(true);
    });

    expect(root.querySelector('.text-color-muted')?.textContent).toBe('Comprueba tu conexión.');
    expect(root.querySelector('.empty-state__action .test-action')).not.toBeNull();
    expect(root.querySelector('.empty-state__top .test-top')).not.toBeNull();
  });

  it('puts the role on the host so errors are announced', () => {
    const root = render((host) => host.role.set('alert'));

    expect(root.querySelector('app-empty-state')?.getAttribute('role')).toBe('alert');
  });

  it('renders inside its own card', () => {
    const root = render((host) => host.isCard.set(true));

    expect(root.querySelector('ion-card.empty-state__card .empty-state')).not.toBeNull();
  });

  it('paints the icon in green for a success', () => {
    const root = render((host) => host.tone.set('success'));

    expect(root.querySelector('.empty-state__icon--success')).not.toBeNull();
  });

  it('renders the title as the page heading or a section heading', () => {
    expect(render((host) => host.headingLevel.set(1)).querySelector('h1')?.textContent).toBe(
      'No se ha podido cargar',
    );
    TestBed.resetTestingModule();
    expect(render((host) => host.headingLevel.set(2)).querySelector('h2')).not.toBeNull();
  });
});
