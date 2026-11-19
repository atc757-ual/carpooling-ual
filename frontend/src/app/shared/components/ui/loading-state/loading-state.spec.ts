import { TestBed } from '@angular/core/testing';
import { LoadingState } from './loading-state';

describe('LoadingState', () => {
  function render(inputs: Record<string, unknown>): HTMLElement {
    const fixture = TestBed.createComponent(LoadingState);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the spinner and the text in a row, announced by an output', () => {
    const root = render({ label: 'Cargando viaje…' });
    const output = root.querySelector('output.loading-state');

    expect(output?.querySelector('ion-spinner')?.getAttribute('aria-hidden')).toBe('true');
    expect(output?.textContent?.trim()).toBe('Cargando viaje…');
    expect(output?.classList).not.toContain('loading-state--centered');
  });

  it('is centered when it takes the place of a list', () => {
    const root = render({ label: 'Cargando…', isCentered: true });

    expect(root.querySelector('.loading-state--centered')).not.toBeNull();
    expect(root.querySelector('.loading-state__heading')).toBeNull();
  });

  it('is centered with the title above the text', () => {
    const root = render({ label: 'Miramos los viajes de hoy.', heading: 'Buscando viajes' });

    expect(root.querySelector('.loading-state--centered')).not.toBeNull();
    expect(root.querySelector('.loading-state__heading')?.textContent).toBe('Buscando viajes');
  });
});
