import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { FilterChips } from './filter-chips';

describe('FilterChips', () => {
  let fixture: ComponentFixture<FilterChips>;

  function render(inputs: Record<string, unknown>): HTMLElement {
    TestBed.configureTestingModule({ providers: [provideIonicAngular()] });
    fixture = TestBed.createComponent(FilterChips);
    fixture.componentRef.setInput('legend', 'Estado');
    fixture.componentRef.setInput('options', [
      { value: 'active', label: 'Activo', tone: 'success' },
      { value: 'deleted', label: 'Cuenta eliminada' },
    ]);
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value);
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function chips(root: HTMLElement): HTMLElement[] {
    return Array.from(root.querySelectorAll<HTMLElement>('ion-chip'));
  }

  it('shows the legend, «Todos» and one chip per option, marking the chosen one', () => {
    const root = render({ value: 'active' });

    expect(root.querySelector('legend')?.textContent).toBe('Estado');
    expect(chips(root).map((chip) => chip.textContent?.trim())).toEqual([
      'Todos',
      'Activo',
      'Cuenta eliminada',
    ]);
    expect(chips(root).map((chip) => chip.getAttribute('aria-pressed'))).toEqual([
      'false',
      'true',
      'false',
    ]);
    expect(root.querySelectorAll('.filter-chips__dot--success')).toHaveLength(1);
  });

  it('emits the chosen value, and null for «Todos»', () => {
    const root = render({ value: null });
    const values: (string | null)[] = [];
    fixture.componentInstance.valueChange.subscribe((value) => values.push(value));

    chips(root)[2].click();
    chips(root)[0].click();
    expect(values).toEqual(['deleted', null]);
  });

  it('leaves out «Todos» when the filter always has a value', () => {
    const root = render({ value: 'active', allLabel: null });

    expect(chips(root)).toHaveLength(2);
  });
});
