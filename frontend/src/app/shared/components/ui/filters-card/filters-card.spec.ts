import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { FiltersCard } from './filters-card';

describe('FiltersCard', () => {
  let fixture: ComponentFixture<FiltersCard>;

  function render(inputs: Record<string, unknown> = {}): HTMLElement {
    TestBed.configureTestingModule({ providers: [provideIonicAngular()] });
    fixture = TestBed.createComponent(FiltersCard);
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value);
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const APPLIED = [
    { key: 'profile', label: 'Conductor' },
    { key: 'status', label: 'Activo' },
  ];

  it('counts the applied filters and lists them while closed', () => {
    const root = render({ activeFilters: APPLIED });

    expect(root.querySelector('.filters-card__count')?.textContent).toContain('2');
    expect(root.querySelectorAll('.filters-card__applied ion-chip')).toHaveLength(2);
  });

  it('removes a filter from the summary', () => {
    const root = render({ activeFilters: APPLIED });
    const removed: string[] = [];
    fixture.componentInstance.removeFilter.subscribe((key) => removed.push(key));

    root.querySelector<HTMLElement>('.filters-card__applied ion-chip')?.click();
    expect(removed).toEqual(['profile']);
  });

  it('opens the panel and hides the summary', () => {
    const root = render({ activeFilters: APPLIED });

    fixture.componentInstance.toggle();
    fixture.detectChanges();
    expect(root.querySelector('.filters-card__toggle')?.getAttribute('aria-expanded')).toBe('true');
    expect(root.querySelector('.filters-card__panel--open')).not.toBeNull();
    expect(root.querySelector('.filters-card__applied')).toBeNull();
  });

  it('offers removing every filter only when there is something to remove', () => {
    const root = render();
    expect(root.querySelector('.filters-card__clear')).toBeNull();

    fixture.componentRef.setInput('hasFilters', true);
    fixture.detectChanges();
    let isCleared = false;
    fixture.componentInstance.clearFilters.subscribe(() => (isCleared = true));
    root.querySelector<HTMLElement>('.filters-card__clear')?.click();
    expect(isCleared).toBe(true);
  });
});
